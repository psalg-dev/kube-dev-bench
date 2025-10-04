#!/bin/sh
# manager.sh - bootstrap kind + kubectl and ensure KinD cluster exists
set -Eeuo pipefail

log() { printf "[kind-manager] %s\n" "$*"; }
err() { printf "[kind-manager][ERROR] %s\n" "$*" >&2; }

if [ "${DEBUG_KEEP_ON_ERROR:-0}" = "1" ]; then
  log "DEBUG_KEEP_ON_ERROR=1: will not exit on first error; errors will drop into infinite tail."
  set +e
  trap 'rc=$?; err "A command failed (exit=$rc). Entering debug hold..."; tail -f /dev/null' ERR
fi

log "Installing required packages (curl bash jq iptables docker-cli)..."
if ! apk add --no-cache curl bash ca-certificates iptables jq docker-cli 2>/dev/null; then
  err "docker-cli package missing in repo – attempting fallback to full docker package"
  apk add --no-cache docker || { err "Failed to install docker client"; exit 12; }
fi

# Resolve kubectl version if set to stable
if [ "${KUBECTL_VERSION:-stable}" = "stable" ]; then
  log "Resolving latest stable kubectl version..."
  KUBECTL_VERSION=$(curl -fsSL https://dl.k8s.io/release/stable.txt) || { err "Failed to resolve stable kubectl"; exit 13; }
fi
log "Using kubectl version $KUBECTL_VERSION"
curl -fsSL -o /usr/local/bin/kubectl "https://dl.k8s.io/release/$KUBECTL_VERSION/bin/linux/amd64/kubectl" || { err "Download kubectl failed"; exit 14; }
chmod +x /usr/local/bin/kubectl

log "Using kind version ${KIND_VERSION}"
curl -fsSL -o /usr/local/bin/kind "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-amd64" || { err "Download kind failed"; exit 15; }
chmod +x /usr/local/bin/kind

command -v docker >/dev/null || { err "docker CLI not found after install"; exit 16; }
command -v kind >/dev/null || { err "kind binary missing"; exit 17; }

log "Docker CLI version:"; docker version --format '{{.Server.Version}}' 2>/dev/null || docker version || true

log "Ensuring output directory exists..."
mkdir -p /kind/output

# Create cluster if absent
if ! kind get clusters 2>/dev/null | grep -q '^dev$'; then
  log "Creating KinD cluster 'dev'..."
  if ! kind create cluster --name dev --config /kind/kind-cluster.yaml; then
    err "Kind cluster creation failed. Dumping docker ps + events for diagnostics.";
    docker ps -a || true
    docker events --since 5m --until 1s 2>/dev/null | tail -n 50 || true
    [ "${DEBUG_KEEP_ON_ERROR:-0}" = "1" ] || exit 20
  fi
else
  log "KinD cluster 'dev' already exists"
fi

# Always export the host‑loopback kubeconfig for host usage
if ! kind get kubeconfig --name dev > /kind/output/kubeconfig 2>/dev/null; then
  err "Failed to write host kubeconfig"; [ "${DEBUG_KEEP_ON_ERROR:-0}" = "1" ] || exit 21;
fi
chmod 600 /kind/output/kubeconfig || true

# Attempt to connect this manager container to the 'kind' docker network so we can use the internal
# API server address (dev-control-plane:6443) instead of a 127.0.0.1:PORT mapping which is NOT reachable
# from inside this container.
if docker network inspect kind >/dev/null 2>&1; then
  # Connect only if not already attached
  if ! docker network inspect kind 2>/dev/null | grep -q 'kind-manager'; then
    log "Connecting manager container to 'kind' network for internal API access"
    docker network connect kind kind-manager 2>/dev/null || log "Could not connect to 'kind' network (will fallback to loopback kubeconfig)"
  fi
else
  log "Docker network 'kind' not found (maybe older kind or creation failed)."
fi

# Try obtaining internal kubeconfig (direct control-plane address) for in‑container kubectl.
INTERNAL_KUBECONFIG=/kind/output/kubeconfig.internal
if kind get kubeconfig --name dev --internal > "$INTERNAL_KUBECONFIG" 2>/dev/null; then
  chmod 600 "$INTERNAL_KUBECONFIG" || true
  # Quick sanity: does server line reference dev-control-plane?
  if grep -q 'server: https://dev-control-plane:6443' "$INTERNAL_KUBECONFIG"; then
    export KUBECONFIG="$INTERNAL_KUBECONFIG"
    log "Using internal kubeconfig for in-container kubectl (dev-control-plane:6443). Host kubeconfig preserved at output/kubeconfig"
  else
    log "Internal kubeconfig did not contain expected control-plane host; falling back to host kubeconfig"
    export KUBECONFIG=/kind/output/kubeconfig
  fi
else
  log "Could not obtain internal kubeconfig; falling back to host kubeconfig (127.0.0.1 mapping may fail inside container)."
  export KUBECONFIG=/kind/output/kubeconfig
fi

log "Cluster is ready (creation finished). Try from host: docker compose exec kind kubectl --kubeconfig /kind/output/kubeconfig get nodes"
log "Kubeconfigs: host=/kind/output/kubeconfig internal=$INTERNAL_KUBECONFIG (if present)"

# Readiness check loop
for i in 1 2 3 4 5; do
  if kubectl get nodes >/dev/null 2>&1; then
    log "kubectl connectivity verified"
    break
  fi
  sleep 2
  if [ "$i" = 5 ]; then
    err "Still no connectivity after initial retries"
  fi
done

# Additional wait: ensure nodes report Ready status (up to 60s)
if ! kubectl wait --for=condition=Ready node --all --timeout=60s >/dev/null 2>&1; then
  err "Some nodes not Ready after timeout (continuing anyway)"
else
  log "All nodes report Ready"
fi

# Wait for API server OpenAPI discovery to be available (avoid validation race)
OPENAPI_READY=0
for i in $(seq 1 30); do
  if kubectl get --raw /openapi/v2 >/dev/null 2>&1; then
    OPENAPI_READY=1
    log "OpenAPI endpoint is available"
    break
  fi
  sleep 2
done
[ $OPENAPI_READY -eq 1 ] || err "OpenAPI not ready after waits; will fallback to --validate=false if needed"

apply_examples() {
  EXAMPLES_FILE="$1"
  [ -f "$EXAMPLES_FILE" ] || { log "No examples file at $EXAMPLES_FILE"; return 0; }

  if kubectl get ns test >/dev/null 2>&1; then
    log "Namespace 'test' exists; reconciling example resources"
  else
    log "'test' namespace absent yet; examples will create it"
  fi

  MAX_ATTEMPTS=4
  attempt=1
  while [ $attempt -le $MAX_ATTEMPTS ]; do
    if [ $OPENAPI_READY -eq 1 ]; then
      log "Applying examples (attempt $attempt/$MAX_ATTEMPTS) with validation"
      if kubectl apply -f "$EXAMPLES_FILE"; then
        log "Example resources applied successfully"
        return 0
      fi
    else
      log "Skipping validation attempts because OpenAPI not ready (attempt $attempt/$MAX_ATTEMPTS)"
    fi
    attempt=$((attempt+1))
    sleep 3
  done

  log "Applying examples with --validate=false fallback"
  if kubectl apply --validate=false -f "$EXAMPLES_FILE"; then
    log "Example resources applied successfully (validation skipped)"
  else
    err "Failed to apply example resources even with --validate=false"
  fi
}

EXAMPLES_FILE="/kind/examples/test-resources.yaml"
apply_examples "$EXAMPLES_FILE"

# Keep container alive for interactive use
tail -f /dev/null

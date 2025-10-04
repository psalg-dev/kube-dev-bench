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

# Export kubeconfig
if ! kind get kubeconfig --name dev > /kind/output/kubeconfig 2>/dev/null; then
  err "Failed to write kubeconfig"; [ "${DEBUG_KEEP_ON_ERROR:-0}" = "1" ] || exit 21;
fi
chmod 600 /kind/output/kubeconfig || true

log "Cluster is ready. Try: docker compose exec kind kubectl get nodes"
log "Kubeconfig stored at kind/output/kubeconfig"

# Readiness check loop
for i in 1 2 3 4 5; do
  if kubectl --kubeconfig /kind/output/kubeconfig get nodes >/dev/null 2>&1; then
    log "kubectl connectivity verified"
    break
  fi
  sleep 2
done

# Keep container alive for interactive use
tail -f /dev/null


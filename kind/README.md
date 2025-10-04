# KinD Environment via Docker Compose

This folder provides a helper container (kind-manager) that installs `kind` + `kubectl` at runtime and manages a local KinD cluster named `dev` using the host Docker Engine socket.

## Quick Start
```
cd kind
copy .env.example .env   (optional – override versions)
docker compose up -d
# Check status
docker compose logs -f kind
# Use kubectl
docker compose exec kind kubectl get nodes
```

## Environment Variables (.env)
- KIND_VERSION: (default v0.23.0) version of kind binary.
- KUBECTL_VERSION: (default stable) set explicit version like v1.31.1 or leave as stable.
- DEBUG_KEEP_ON_ERROR: (default 0). Set to 1 to keep the container running after an error instead of exiting & restarting.

## Common Operations
Recreate cluster:
```
docker compose exec kind kind delete cluster --name dev
# (container will recreate it automatically on next restart) or manually:
docker compose restart kind
```
Fetch kubeconfig locally:
```
# Writes to kind/output/kubeconfig (already mounted on host)
cat output/kubeconfig
```
Use host-side `kubectl` with that kubeconfig (PowerShell example):
```
$env:KUBECONFIG = (Resolve-Path ./output/kubeconfig)
kubectl get ns
```

## Troubleshooting Restart Loops
1. View last logs:
```
docker compose logs --tail=200 kind
```
2. Enable debug hold:
```
# In .env
DEBUG_KEEP_ON_ERROR=1
# Then
docker compose up -d --force-recreate
```
3. Exec into container and inspect:
```
docker compose exec kind sh
ps -ef
ls -l /usr/local/bin/kind /usr/local/bin/kubectl
```
4. Network/DNS Failures:
   - Corporate proxy? Set environment variables in `docker-compose.yml` or `.env`:
     - HTTP_PROXY / HTTPS_PROXY / NO_PROXY
5. Permission on docker socket:
```
ls -l /var/run/docker.sock
# Should show root:docker 0666 or similar; if not, adjust Docker Desktop settings.
```
6. Verify host engine accessible:
```
docker compose exec kind docker info
```
7. Check cluster creation error details (we dump `docker ps` and recent `docker events` on failure).

## When to Use `kind` Directly Instead
If you already have Docker locally, running `kind` directly on the host (outside this helper container) is simpler:
```
kind create cluster --name dev --config kind-cluster.yaml
kind get kubeconfig --name dev > output/kubeconfig
```
You can still use this compose setup if you want an isolated tool container.

## Limitations
- Relies on live downloads each start; for air‑gapped or flaky networks, consider baking a custom image (see below).

## Optional: Pre-Baked Image
Create a Dockerfile:
```
FROM alpine:3.19
ARG KIND_VERSION=v0.23.0
ARG KUBECTL_VERSION=stable
RUN apk add --no-cache curl bash ca-certificates iptables jq docker-cli \
 && if [ "$KUBECTL_VERSION" = "stable" ]; then KUBECTL_VERSION=$(curl -fsSL https://dl.k8s.io/release/stable.txt); fi \
 && curl -fsSL -o /usr/local/bin/kubectl https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl \
 && chmod +x /usr/local/bin/kubectl \
 && curl -fsSL -o /usr/local/bin/kind https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-amd64 \
 && chmod +x /usr/local/bin/kind
ENTRYPOINT ["/bin/sh"]
```
Then build & adjust compose to use the image without runtime downloads.

## Windows + WSL Notes
If Docker Desktop cannot start due to WSL errors (`Wsl/Service/RegisterDistro/...`):
- Fix WSL2 first (enable features, update kernel, unregister corrupt `docker-desktop*` distros) before using this compose.
- The container depends on a healthy Docker engine; WSL issues propagate as restarts.

## Getting More Help
Provide the output of:
```
docker compose ps
docker compose logs --tail=300 kind
```
And (if cluster creation fails):
```
docker compose exec kind kind get clusters || echo "kind list failed"
```

---
Generated helper README.


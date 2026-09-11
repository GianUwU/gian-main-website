#!/bin/bash
# update_frontend_drop.sh - Build drop-app Docker image for registry upload

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/drop-app"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env.deploy}"

if [[ -f "$ENV_FILE" ]]; then
	set -a
	# shellcheck disable=SC1090
	source "$ENV_FILE"
	set +a
fi

REGISTRY_HOST="${REGISTRY_HOST:-registry.gian.ink}"
REGISTRY_USERNAME="${REGISTRY_USERNAME:-}"
REGISTRY_PASSWORD="${REGISTRY_PASSWORD:-}"

IMAGE_NAME="${IMAGE_NAME:-${REGISTRY_HOST}/gian/drop-frontend}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d-%H%M%S)}"
PUSH_IMAGE="${PUSH_IMAGE:-false}"

cd "$APP_DIR"

# Log in to Docker registry
if [[ "$PUSH_IMAGE" == "true" ]]; then
	if [[ -z "$REGISTRY_USERNAME" || -z "$REGISTRY_PASSWORD" ]]; then
	echo "Missing REGISTRY_USERNAME or REGISTRY_PASSWORD in $ENV_FILE"
	exit 1
	fi
	echo "Logging in to Docker registry..."
	echo "$REGISTRY_PASSWORD" | docker login "$REGISTRY_HOST" -u "$REGISTRY_USERNAME" --password-stdin
fi

echo "Building Docker image..."
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"

docker build \
	-t "${IMAGE_NAME}:${IMAGE_TAG}" \
	-t "${IMAGE_NAME}:latest" \
	.

echo "Docker image created successfully."

if [[ "$PUSH_IMAGE" == "true" ]]; then
	echo "Pushing tags to registry..."
	docker push "${IMAGE_NAME}:${IMAGE_TAG}"
	docker push "${IMAGE_NAME}:latest"
	echo "Image pushed to registry."
else
	echo "Skipping push (PUSH_IMAGE=${PUSH_IMAGE})."
	echo "To push manually, run:"
	echo "  docker push ${IMAGE_NAME}:${IMAGE_TAG}"
	echo "  docker push ${IMAGE_NAME}:latest"
fi
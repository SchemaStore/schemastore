#!/bin/bash
# run on Linux

CONTAINER_NAME="xregistry-server"
ARCHIVE_PATH="/tmp/xr_live_data.tar.gz"

# Determine repository root directory
SCRIPT_DIR=$(dirname "$(readlink -f "$PWD/$0")")
REPO_ROOT=$(readlink -f "$SCRIPT_DIR/..")
if [ -n "$GITHUB_ACTIONS" ]; then
  REPO_ROOT="$GITHUB_WORKSPACE"
  echo "Running on GitHub Actions. Using GITHUB_WORKSPACE as repository root: $REPO_ROOT"
fi
DATA_EXPORT_DIR="$REPO_ROOT/src/api/registry"

echo "Script directory: $SCRIPT_DIR"
echo "Repository root directory: $REPO_ROOT"
echo "Data export directory: $DATA_EXPORT_DIR"
echo "Container name: $CONTAINER_NAME"
echo "Archive path: $ARCHIVE_PATH"


# Start or reuse the xregistry server container
if [ "$(docker ps -q -f name="${CONTAINER_NAME}")" ]; then
  echo "Container ${CONTAINER_NAME} is already running."
  exit
else
  CONTAINER_ID=$(docker run -d --name "${CONTAINER_NAME}" -v $REPO_ROOT:/workspace -p 8080:8080 ghcr.io/xregistry/xrserver-all --recreatedb)
fi

# Wait for the server to be ready
echo "Waiting for xregistry server to be ready..."
until curl --silent --get http://localhost:8080 -i | grep "200 OK" > /dev/null; do
  sleep 5
done

# Update the model
echo "Updating model..."
echo "Downloading model.json..."
curl -sSL "https://raw.githubusercontent.com/xregistry/spec/refs/heads/main/schema/model.json" -o "$REPO_ROOT/src/api/registry/model.json"
if [ $? -ne 0 ]; then
    echo "Failed to download model.json"
    exit 1
fi
docker exec "${CONTAINER_ID}" /xr model update /workspace/src/api/registry/model.json -s localhost:8080
if [ $? -ne 0 ]; then
    echo "Failed to update model"
    exit 1
fi

# Apply registry using registry.json
echo "Applying registry from /src/api/registry/registry.json..."
docker exec "${CONTAINER_ID}" /xr import -d @/workspace/src/api/registry/registry.json -s localhost:8080

# Export the live data as a tarball
echo "Exporting live data to $ARCHIVE_PATH..."
docker exec "${CONTAINER_ID}" /bin/sh -c "
  mkdir -p /tmp/live
  /xr download --index index.json -s localhost:8080 /tmp/live -u https://json.schemastore.org/api/registry
  cd /tmp/live
  tar czf $ARCHIVE_PATH .
"

# Copy the archive to the host
echo "Copying archive to $DATA_EXPORT_DIR..."
mkdir -p "$DATA_EXPORT_DIR"
docker cp "${CONTAINER_ID}:$ARCHIVE_PATH" "$DATA_EXPORT_DIR/xr_live_data.tar.gz"
tar xzf "$DATA_EXPORT_DIR/xr_live_data.tar.gz" -C "$DATA_EXPORT_DIR"
rm "$DATA_EXPORT_DIR/xr_live_data.tar.gz"

# Stop and remove the container
echo "Stopping and removing xregistry server..."
docker stop "${CONTAINER_ID}"
docker rm "${CONTAINER_ID}"
echo "xregistry server stopped and removed."


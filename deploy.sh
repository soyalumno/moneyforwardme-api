#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Check for .env file
if [ ! -f .env ]; then
  echo "Error: .env file not found."
  exit 1
fi

# Read variables from .env, filter out comments and empty lines,
# and format them for the --set-env-vars flag (KEY1=VALUE1,KEY2=VALUE2,...).
VARS=$(grep -v '^#' .env | grep -v '^$' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' | tr '\n' ',' | sed 's/,$//')

# Get the package name from package.json to use in the deploy command
PACKAGE_NAME=$(grep "name" package.json | sed 's/.*: "\(.*\)".*/\1/')

echo "Deploying service '$PACKAGE_NAME' to Google Cloud Run..."

# Execute the gcloud deploy command
gcloud run deploy "$PACKAGE_NAME" \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 120s \
  --set-env-vars "$VARS"

echo "Deployment successful."

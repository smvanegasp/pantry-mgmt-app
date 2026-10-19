#!/usr/bin/env bash
# Deploy to AWS: API image -> ECR, Terraform apply, frontend -> S3, CloudFront invalidation.
# Run from Git Bash in the repo root:  scripts/deploy.sh
# Extra arguments go to `terraform apply` (e.g. -auto-approve).
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-pantry}" AWS_REGION=us-east-1
# Git Bash would otherwise rewrite arguments like "/*" into Windows paths.
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."

tf() { terraform -chdir=infra "$@"; }

echo "== Terraform init"
tf init -input=false >/dev/null

# The first deploy needs the image repository before there is anything to push to it.
if ! aws ecr describe-repositories --repository-names pantry-api >/dev/null 2>&1; then
  echo "== Creating the image repository"
  tf apply -input=false -target=aws_ecr_repository.api "$@"
fi

account=$(aws sts get-caller-identity --query Account --output text)
registry="$account.dkr.ecr.$AWS_REGION.amazonaws.com"
image="$registry/pantry-api:latest"

echo "== Building and pushing the API image"
aws ecr get-login-password | docker login --username AWS --password-stdin "$registry" >/dev/null
# Lambda wants a plain single-platform image (no provenance/SBOM attestations).
docker build --platform linux/amd64 --provenance=false --sbom=false --target lambda -t "$image" backend
docker push "$image"

echo "== Terraform apply"
tf apply -input=false "$@"

bucket=$(tf output -raw web_bucket)
distribution=$(tf output -raw distribution_id)

echo "== Building the frontend"
(cd frontend && npm ci --no-audit --no-fund && npm run build)

echo "== Uploading the frontend"
# Hashed bundles never change; older ones stay so open tabs can still load their chunks.
aws s3 sync frontend/dist/assets "s3://$bucket/assets" \
  --cache-control "public,max-age=31536000,immutable" --only-show-errors
aws s3 sync frontend/dist "s3://$bucket" --delete --exclude "assets/*" --exclude index.html \
  --cache-control "public,max-age=3600" --only-show-errors
aws s3 cp frontend/dist/index.html "s3://$bucket/index.html" \
  --cache-control "no-cache" --only-show-errors

aws cloudfront create-invalidation --distribution-id "$distribution" --paths "/*" \
  --query Invalidation.Id --output text >/dev/null

echo "== Done: $(tf output -raw url)"

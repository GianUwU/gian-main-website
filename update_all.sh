#!/bin/bash
# update_all.sh - Build and deploy all components (backend + frontends)

set -e  # Exit on error

echo "=========================================="
echo "🚀 Starting Full Deployment"
echo "=========================================="

# Prompt to push images
read -r -p "Push Docker images after building? [y/N] " _push_answer
if [[ "$_push_answer" =~ ^[Yy]$ ]]; then
    export PUSH_IMAGE=true
else
    export PUSH_IMAGE=false
fi

echo ""
echo "📦 [1/5] Building Backend Docker Image..."
echo "------------------------------------------"
"$(dirname "$0")/update_backend.sh"

echo ""
echo "🌐 [2/5] Building Main Frontend Docker Image..."
echo "------------------------------------------"
"$(dirname "$0")/update_frontend_main.sh"

echo ""
echo "📂 [3/5] Building Drop Frontend Docker Image..."
echo "------------------------------------------"
"$(dirname "$0")/update_frontend_drop.sh"

echo ""
echo "💰 [4/5] Building Finance Frontend Docker Image..."
echo "------------------------------------------"
"$(dirname "$0")/update_frontend_finance.sh"

echo ""
echo "👱 [5/5] Building Flavia Frontend Docker Image..."
echo "------------------------------------------"
"$(dirname "$0")/update_frontend_flavia.sh"

# Summary
echo ""
echo "========================================"
echo "🎉 Full Deployment Complete!"
echo "========================================"
echo "✅ Node Backend: Docker image built"
echo "✅ Main Frontend: Docker image built"
echo "✅ Drop Frontend: Docker image built"
echo "✅ Finance Frontend: Docker image built"
echo "✅ Flavia Frontend: Docker image built"
echo ""
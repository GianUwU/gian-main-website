#!/bin/bash
# update_all.sh - Build and deploy all components (backend + frontends)

set -e  # Exit on error

echo "=========================================="
echo "🚀 Starting Full Deployment"
echo "=========================================="


echo ""
echo "📦 [1/3] Updating Backend..."
echo "------------------------------------------"
"$(dirname "$0")/update_backend.sh"

echo ""
echo "🎨 [2/4] Updating Frontend Apps..."
echo "------------------------------------------"
"$(dirname "$0")/update_frontend_main.sh"
"$(dirname "$0")/update_frontend_drop.sh"

echo ""
echo "💰 [3/4] Updating Finance Frontend..."
echo "------------------------------------------"
"$(dirname "$0")/update_frontend_finance.sh"

echo ""
echo "👱 [4/4] Updating Flavia Frontend..."
echo "------------------------------------------"
"$(dirname "$0")/update_frontend_flavia.sh"

# Summary
echo ""
echo "========================================"
echo "🎉 Full Deployment Complete!"
echo "========================================"
echo "✅ Backend: Updated and restarted"
echo "✅ Main Frontend (gian.ink): Updated"
echo "✅ Finance Frontend (finance.gian.ink): Updated"
echo "✅ Flavia Frontend (flavia.gian.ink): Updated"
echo ""
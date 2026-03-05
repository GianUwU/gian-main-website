#!/bin/bash
# update_nginx.sh - Deploy nginx configuration files to server

echo "🔧 Updating Nginx Configurations"
echo "=================================="

cd ~/gian-webserver/ngnix_configs/ || exit

echo "📤 Copying nginx config files to server..."
scp default bitwarden.gian.ink drop.gian.ink finance.gian.ink flavia.gian.ink gian.ink gian@gian.ink:/tmp/

echo ""
echo "✅ Files copied to /tmp/ on gian.ink"
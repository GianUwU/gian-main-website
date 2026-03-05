#!/bin/bash
# update_frontend_drop.sh - Build and deploy drop-app to drop.gian.ink

# Navigate to the drop-app directory
cd ~/gian-webserver/drop-app/ || exit

npm run build

# Copy the build files directly to the server
scp -r dist/* gian@gian.ink:/var/www/drop.gian.ink/html/

echo "Drop-app updated on drop.gian.ink."
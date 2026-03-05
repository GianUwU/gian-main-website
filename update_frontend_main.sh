#!/bin/bash
# update_frontend_main.sh - Build and deploy main-app to gian.ink

# Navigate to the main-app directory
cd ~/gian-webserver/main-app/ || exit

npm run build

# Copy the build files directly to the server
scp -r dist/* gian@gian.ink:/var/www/gian.ink/html/

echo "Main-app updated on gian.ink."
#!/bin/bash
# update_frontend_flavia.sh - Build and deploy flavia-app to server

# Navigate to the flavia-app directory
cd ~/webserver/flavia-app/ || exit

npm run build

# Copy the build files directly to the server
scp -r dist/* gian@gian.ink:/var/www/flavia.gian.ink/html/

echo "Flavia-app updated on flavia.gian.ink."

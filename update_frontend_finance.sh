#!/bin/bash
# update_frontend_finance.sh - Build and deploy finance-app to server

# Navigate to your React app
cd ~/webserver/finance-app/ || exit

# Build the React app
npm run build

# Copy the build files to your server
scp -r dist/* gian@gian.ink:/var/www/finance.gian.ink/html/

echo "Finance-app updated."

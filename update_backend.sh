#!/bin/bash
# update_backend.sh - Deploy Dockerized Node backends to server

cd ~/gian-webserver/NodeJsBackend/ || exit

echo "Copying Node backend files..."

ssh gian@gian.ink 'mkdir -p ~/NodeJsBackend/Databases ~/NodeJsBackend/uploads'

# Copy all necessary Node backend files to the server
scp authServer.js financeServer.js dropServer.js db.js package.json package-lock.json Dockerfile docker-compose.yml .dockerignore .env.example manage_accounts.sh gian@gian.ink:~/NodeJsBackend/

echo "Restarting Node backend services..."

# Restart Node backend services on the server
ssh gian@gian.ink 'cd ~/NodeJsBackend && docker compose down && docker compose up --build -d'

echo "Node backend services updated."

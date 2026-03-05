#!/bin/bash
# update_backend.sh - Deploy Python backend files to server

cd ~/gian-webserver/PythonBackend/ || exit

echo "Copying backend files..."

# Copy all necessary backend files to the server
scp main.py drop.py finance.py auth.py requirements.txt Dockerfile docker-compose.yml .dockerignore manage_accounts.sh gian@gian.ink:~/PythonBackend/

echo "Restarting backend services..."

# Restart all backend services on the server
ssh gian@gian.ink 'cd ~/PythonBackend && docker compose down && docker compose up --build -d'

echo "Backend services updated."

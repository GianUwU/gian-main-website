# How to Add a New App to Your Server

This guide explains the steps to add a new React app to your gian.ink infrastructure (similar to how flavia-app was added).

## Steps to Add a New App

### 1. Create the React App Locally

Create a new React + Vite + TypeScript app in the workspace:

```bash
cd ~/gian-webserver
```

Create the app directory with the following structure:
- `package.json` - with React, Vite, TypeScript dependencies
- `tsconfig.json`, `tsconfig.node.json`, `tsconfig.app.json` - TypeScript configs
- `vite.config.ts` - Vite configuration
- `eslint.config.js` - ESLint configuration
- `index.html` - HTML entry point
- `src/` directory with:
  - `main.tsx` - React entry point
  - `App.tsx` - Main component
  - `App.css` - Styling
  - `index.css` - Global styles

Reference existing apps: `main-app/`, `drop-app/`, `finance-app/`, `flavia-app/`

### 2. Create Nginx Configuration

Create a new file in `ngnix_configs/` with the domain name as filename (e.g., `flavia.gian.ink`):

```nginx
# Redirect all HTTP traffic to HTTPS
server {
    listen 80;
    server_name <domain>.gian.ink;
    return 301 https://$host$request_uri;
}

# App HTTPS
server {
    listen 443 ssl http2;
    server_name <domain>.gian.ink;
    
    root /var/www/<domain>.gian.ink/html;
    index index.html;
    client_max_body_size 100M;

    ssl_certificate /etc/letsencrypt/live/gian.ink/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gian.ink/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-XSS-Protection "1; mode=block" always;
    server_tokens off;

    # API endpoints (if needed) - proxy to backend on port 800X
    location /api/ {
        proxy_pass http://127.0.0.1:800X/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 3. Update Development Scripts

#### Update `start-dev.sh`:
Add startup command for your new app (use next available port, e.g., 5176, 5177, etc.):

```bash
echo "Starting <app>-app on port 517X..."
cd <app>-app
npm run dev -- --port 517X > /tmp/<app>-app-dev.log 2>&1 &
echo $! > /tmp/<app>-app-dev.pid
cd ..
```

Also add to the "Frontends:" section at the end:
```bash
echo "  <App>:    http://localhost:517X (<domain>.gian.ink)"
```

#### Update `stop-dev.sh`:
Add shutdown command:

```bash
echo "Stopping <app>-app..."
if [ -f /tmp/<app>-app-dev.pid ]; then
    kill $(cat /tmp/<app>-app-dev.pid) 2>/dev/null
    rm /tmp/<app>-app-dev.pid
fi
```

### 4. Create Deployment Script

Create `update_frontend_<app>.sh`:

```bash
#!/bin/bash
# update_frontend_<app>.sh - Build and deploy <app>-app to server

# Navigate to the <app>-app directory
cd ~/gian-webserver/<app>-app/ || exit

npm run build

# Copy the build files directly to the server
scp -r dist/* gian@gian.ink:/var/www/<domain>.gian.ink/html/

echo "<app>-app updated on <domain>.gian.ink."
```

Make it executable:
```bash
chmod +x update_frontend_<app>.sh
```

### 5. Update Main Deployment Script

Edit `update_all.sh` and add your new app to the deployment sequence:

```bash
echo ""
echo "🎨 [X/Y] Updating <App> Frontend..."
echo "------------------------------------------"
"$(dirname "$0")/update_frontend_<app>.sh"
```

Update the summary section and step numbers accordingly.

### 6. Configure DNS in Namecheap

**In Namecheap add another entry:**

1. Go to your domain DNS settings
2. Add an A record:
   - **Type:** A
   - **Host:** `<subdomain>` (e.g., `flavia` for `flavia.gian.ink`)
   - **Value:** Your server's IP address
   - **TTL:** 3600 (or auto)

3. Save changes (DNS propagation may take a few minutes)

### 7. Server Setup

On your server (ssh gian.ink):

```bash
# Create the web directory
sudo mkdir -p /var/www/<domain>.gian.ink/html
sudo chown gian:gian /var/www/<domain>.gian.ink/html

# Enable the nginx config
sudo ln -s /path/to/ngnix_configs/<domain>.gian.ink /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Renew SSL certificates (includes all subdomains)
sudo certbot --nginx -d gian.ink -d <domain>.gian.ink [add other subdomains]
```

### 8. Deploy the App

From your local machine:

```bash
cd ~/gian-webserver

# Build and deploy
./update_frontend_<app>.sh

# Or deploy everything at once
./update_all.sh
```

## Summary Checklist

- [ ] Create React app directory and files
- [ ] Create nginx config file
- [ ] Update `start-dev.sh`
- [ ] Update `stop-dev.sh`
- [ ] Create `update_frontend_<app>.sh` and make executable
- [ ] Update `update_all.sh`
- [ ] Add DNS entry in Namecheap
- [ ] Create server directory
- [ ] Enable nginx config and reload
- [ ] Update SSL certificates
- [ ] Deploy the app

Done! Your new app should now be live at `<domain>.gian.ink`

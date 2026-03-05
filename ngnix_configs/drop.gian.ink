# Redirect all HTTP traffic to HTTPS
server {
    listen 80;
    server_name drop.gian.ink;
    return 301 https://$host$request_uri;
}

# Dropserver HTTPS
server {
    listen 443 ssl http2;
    server_name drop.gian.ink;
    
    root /var/www/drop.gian.ink/html;
    index index.html;
    client_max_body_size 5G;  # Allow large file uploads

    ssl_certificate /etc/letsencrypt/live/gian.ink/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gian.ink/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Enforce HTTPS and security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-XSS-Protection "1; mode=block" always;
    server_tokens off;

    # Dropserver API endpoints - proxy to drop.py backend on port 8001
    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    # File uploads and downloads
    location /uploads/ {
        proxy_pass http://127.0.0.1:8001/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
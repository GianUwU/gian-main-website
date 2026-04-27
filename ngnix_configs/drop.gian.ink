limit_req_zone $binary_remote_addr zone=drop_auth_limit:10m rate=20r/m;
limit_req_zone $binary_remote_addr zone=drop_api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=drop_upload_limit:10m rate=10r/m;

# Redirect all HTTP traffic to HTTPS
server {
    if ($host = drop.gian.ink) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


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
    ssl_certificate /etc/letsencrypt/live/gian.ink/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/gian.ink/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Enforce HTTPS and security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-XSS-Protection "1; mode=block" always;
    server_tokens off;

    # Auth endpoints - proxy to Node auth backend
    location = /token {
        limit_req zone=drop_auth_limit burst=20 nodelay;

        proxy_pass http://127.0.0.1:3000/token;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    location ^~ /users/ {
        limit_req zone=drop_auth_limit burst=20 nodelay;

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    # Drop API endpoints
    location = /upload {
        limit_req zone=drop_upload_limit burst=10 nodelay;

        proxy_pass http://127.0.0.1:3002/upload;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    location = /files {
        limit_req zone=drop_api_limit burst=80 nodelay;

        proxy_pass http://127.0.0.1:3002/files;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    location ^~ /files/ {
        limit_req zone=drop_api_limit burst=80 nodelay;

        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    location = /storage-info {
        limit_req zone=drop_api_limit burst=40 nodelay;

        proxy_pass http://127.0.0.1:3002/storage-info;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    # File downloads and static uploads
    location /uploads/ {
        limit_req zone=drop_api_limit burst=120 nodelay;

        proxy_pass http://127.0.0.1:3002/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    # Optional /api passthrough to drop backend
    location ^~ /api/ {
        limit_req zone=drop_api_limit burst=80 nodelay;

        proxy_pass http://127.0.0.1:3002;
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

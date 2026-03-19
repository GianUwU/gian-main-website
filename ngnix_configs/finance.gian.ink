limit_req_zone $binary_remote_addr zone=finance_auth_limit:10m rate=20r/m;
limit_req_zone $binary_remote_addr zone=finance_api_limit:10m rate=30r/s;

server {
    if ($host = finance.gian.ink) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    server_name finance.gian.ink;
    return 301 https://$host$request_uri;


}

server {
    listen 443 ssl http2;
    server_name finance.gian.ink;
    ssl_certificate /etc/letsencrypt/live/gian.ink-0001/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/gian.ink-0001/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/finance.gian.ink/html;
    index index.html;

    # Enforce HTTPS and security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-XSS-Protection "1; mode=block" always;
    server_tokens off;

    # Auth endpoints - proxy to Node auth backend
    location = /token {
        limit_req zone=finance_auth_limit burst=20 nodelay;

        proxy_pass http://127.0.0.1:3000/token;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    location ^~ /users/ {
        limit_req zone=finance_auth_limit burst=20 nodelay;

        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # Finance transactions endpoints - proxy to Node finance backend
    location ^~ /transactions {
        limit_req zone=finance_api_limit burst=80 nodelay;

        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # Optional /api passthrough - proxy to Node finance backend
    location ^~ /api/ {
        limit_req zone=finance_api_limit burst=80 nodelay;

        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # Frontend - serve React app (must be last)
    location / {
        try_files $uri /index.html;
    }

}

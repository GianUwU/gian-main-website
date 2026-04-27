limit_req_zone $binary_remote_addr zone=bitwarden_proxy_limit:10m rate=20r/s;

server {
    if ($host = bitwarden.gian.ink) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    server_name bitwarden.gian.ink;
    return 301 https://$host$request_uri;


}

server {
    listen 443 ssl http2;
    server_name bitwarden.gian.ink;
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

    location / {
        limit_req zone=bitwarden_proxy_limit burst=80 nodelay;

        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

}


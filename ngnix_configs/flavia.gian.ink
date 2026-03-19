limit_req_zone $binary_remote_addr zone=flavia_site_limit:10m rate=20r/s;

# Redirect all HTTP traffic to HTTPS
server {
    if ($host = flavia.gian.ink) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    server_name flavia.gian.ink;
    return 301 https://$host$request_uri;


}

# Flavia App HTTPS
server {
    listen 443 ssl http2;
    server_name flavia.gian.ink;
    
    root /var/www/flavia.gian.ink/html;
    index index.html;
    client_max_body_size 100M;
    ssl_certificate /etc/letsencrypt/live/gian.ink-0001/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/gian.ink-0001/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Enforce HTTPS and security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-XSS-Protection "1; mode=block" always;
    server_tokens off;

    location / {
        limit_req zone=flavia_site_limit burst=80 nodelay;
        try_files $uri $uri/ /index.html;
    }

}

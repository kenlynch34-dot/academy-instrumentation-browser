FROM node:20-slim AS builder

WORKDIR /app

COPY . .

RUN npm install

ARG HONEYCOMB_API_KEY
ENV HONEYCOMB_API_KEY=$HONEYCOMB_API_KEY

RUN npm run build

FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Add nginx configuration for proxying
RUN cat <<'EOF' > /etc/nginx/conf.d/default.conf
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    rewrite ^/api/(.*)$ /$1 break;
    proxy_pass http://backend-for-frontend:10115;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location / {
        try_files $uri $uri/ /index.html; # Crucial for client-side routing
  }
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
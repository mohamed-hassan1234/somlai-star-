# Production deployment

The canonical application origin is:

```text
https://somalistaracedemy.elivateict.com
```

The public API and WebSocket endpoint share that origin:

```text
https://somalistaracedemy.elivateict.com/api
wss://somalistaracedemy.elivateict.com/api/realtime
```

## Environment

Set these values on the backend host:

```env
HOST=0.0.0.0
PORT=5000
CLIENT_URL=https://somalistaracedemy.elivateict.com
PUBLIC_BASE_URL=https://somalistaracedemy.elivateict.com/api
MONGODB_URI=mongodb://127.0.0.1:27017/somali_star_academy
JWT_SECRET=<unique-random-secret-at-least-32-characters>
SEED_DEFAULT_PASSWORD=<unique-initial-password-12-to-72-bytes>
```

Build the frontend with:

```env
VITE_API_URL=/api
```

Using `/api` keeps browser requests on the exact origin that served the page, including hostname aliases, and avoids unnecessary cross-origin preflights. It resolves publicly to `https://somalistaracedemy.elivateict.com/api` on the canonical domain.

## Reverse proxy

The web server must serve `frontend/dist` for browser routes and proxy `/api` to the Node process on port 5000. WebSocket upgrade headers must be forwarded for `/api/realtime`. Keep TLS enabled at the proxy.

Example Nginx routing:

```nginx
server {
    listen 443 ssl http2;
    server_name somalistaracedemy.elivateict.com;

    root /var/www/somali-star-academy/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Run the seed once after MongoDB is ready:

```bash
npm run seed
```

Running it again is safe: records are keyed by stable IDs or unique business keys and existing data is not overwritten. Every seeded account has `must_change_password` enabled.

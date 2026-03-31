# cURL examples — Auth starter

Replace `YOUR_TOKEN` with the `token` value from register or login. Default base URL: `http://localhost:3010`.

## Health

```bash
curl -s http://localhost:3010/healthz
```

## Register

```bash
curl -s -X POST http://localhost:3010/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "password12",
    "first_name": "Mayank",
    "last_name": "Nauriyal"
  }'
```

## Login

```bash
curl -s -X POST http://localhost:3010/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "password12"
  }'
```

## Me (JWT)

Bearer style:

```bash
curl -s http://localhost:3010/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

JWT scheme (also supported):

```bash
curl -s http://localhost:3010/api/v1/auth/me \
  -H "Authorization: JWT YOUR_TOKEN"
```

## Example protected route

```bash
curl -s http://localhost:3010/api/v1/example/protected/ping \
  -H "Authorization: Bearer YOUR_TOKEN"
```

# cURL — skeleton service

```bash
BASE=http://127.0.0.1:3010

curl -s "$BASE/healthz"
curl -s "$BASE/readyz"
curl -s "$BASE/api/v1/example/ping"
```

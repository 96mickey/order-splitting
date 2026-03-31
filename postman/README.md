# Postman & cURL

## Import into Postman

1. **Import** → **File** → choose `Auth-Starter.postman_collection.json`.
2. Expand the **`Auth Starter`** folder — every request from `curl-examples.md` is there. Each request’s **Docs** tab shows the matching cURL.
3. Collection variables (already set):
   - `base_url` — default `http://localhost:3010`
   - `token` — filled automatically after **Register** / **Login** when Tests run (or paste manually).
3. Start the API (`npm run dev`), ensure Postgres is running and migrations are applied.

## Create the database (once)

```bash
createdb auth_starter
npm run migrate
```

## Same requests as cURL

See `curl-examples.sh` (executable list of curls) or `curl-examples.md` for copy-paste blocks.

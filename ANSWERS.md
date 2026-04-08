What was your approach (thought process)?

-   treated this as a small web service with one main job: take a dollar amount and a list of stocks with weights (like “60% here, 40% there”), check that the input makes sense, split the money across those lines using clear rules (including how to handle fractions of shares), and return a breakdown the client can use.

I split the problem in two: the HTTP layer (URLs, headers, errors, logging) and the business logic (math, validation, storing orders in memory). That way I could test the rules directly and also test the full API end-to-end. I also made retries safe by requiring an idempotency key on the main “split” call so the same request sent twice doesn’t create two different orders by accident.



What assumptions did you make?

-  Orders don’t need to survive a server restart — they live in memory on that one running process. If the app restarts, that data is gone; that matched the “no persistence” style requirement.

-  One server process — I didn’t design this slice of the app for many copies of the service sharing memory; scaling out would need shared storage later. Also for this system to handle 1M RPS, we will have to divide functions even more, like time calculation could happen in different server and update it in shared cache. Instead of our main service doing that action with every request, we can simply refer to cache and take the action(since this action is consistent for all requests. Latency related decisions could be taken for this with load testing).

-  Clients pick the portfolio each time — “different model portfolios” means they send a different list of stocks and weights per request (and can tag it with an optional portfolio id string), not that the server keeps a menu of named templates unless someone asks for that explicitly. Also we have modelled it to accept portfolio Id but for future scope we can have authentication and authorization and have user linked postfolios. This system was designed keeping in mind that this service is an internal service which other services will use to just get the calculations.

-  BUY vs SELL is allowed and checked on the request, but the splitting math is the same for both today — I assumed the requirement was mainly about supporting both labels, not two completely different formulas unless the spec said otherwise.



What challenges did you face?

- Rounding and fairness — When you split money across several stocks and floor fractional shares, tiny leftovers (“dust”) appear. Getting that consistent and testable took time.

- Idempotency — Making sure “same key + same body” returns the same result and doesn’t double-create orders, including when calls overlap, needed clear rules and tests.

- Trust but verify on input — Types in TypeScript help developers, but real requests are JSON from the network, so I needed runtime checks so bad data gets a clear error, not a crash or wrong math.

- Logging — Showing how long each request took in a way that shows up in normal logs, without drowning in noise, needed sensible defaults (e.g. log level).




If you moved this to a real production environment, what would you change?

- Data and reliability

Save orders (and idempotency records) in a real database or a shared cache so multiple servers and restarts don’t lose data or break retries.
Backups, migrations, and monitoring for that store.


- Security

Login / API keys so random people on the internet can’t place orders.

Tighter rate limits and CORS so only real frontends or partners can call the API.

Secrets (passwords, keys) in a proper secrets manager, not only in a file on disk.


- Operations

Centralized logs and metrics (errors, latency, load) so on-call can see problems.

Stricter health checks if you add a database or external price feeds.




If you used LLMs, how did you use them and how did they help?

- I used an AI assistant (for example in Cursor) as a sparring partner, not as a replacement for thinking. It helped me draft tests, outline README sections, and suggest patterns for Express middleware and error handling. I still ran the test suite, read the split logic myself, and fixed mistakes when the suggestions didn’t match how idempotency or rounding actually had to work. So it sped up boilerplate and documentation, but correctness came from my own review and the tests.
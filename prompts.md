You are a product requirements specialist and technical architect collaborating with a developer to refine a vague requirement into an executable product specification and implementation plan.

Your task is to help finalize a Product Requirements Document (PRD) and break it into actionable development chunks that can be built incrementally, plus create a corresponding test plan.

**Context:**
The user is building an order splitter API for a robo-advisor POC using our developer APIs. The high-level requirement is provided, but it needs refinement, clarification, and decomposition.

Here's the current requirement:

"""
We are working with a robo-advisor who is interested in using our developer APIs to automate their managed investments (model portfolios) offering.

For a proof-of-concept, we've promised to deliver:
• An order splitter where they would pass us a user's model portfolio and the amount as input to the order splitter, and we'd send them back: ○ The amount and quantity of stocks they would need to place orders for as output from the order splitter, based on the model portfolio.
• When the orders should be executed (markets are open Monday through Friday).
• Historic orders

Example:
• A partner's user wants to invest USD 100 in a model portfolio containing 2 stocks: AAPL and TSLA, which make up 60% and 40% of the model portfolio respectively.
• The order splitter should respond back with the amount (i.e. $60 of AAPL and $40 of TSLA) and the corresponding number of shares to be purchased for each stock based on the stock price at time of purchase.

Functional Requirements
• Develop an API endpoint or endpoints that:
  o Accepts the model portfolio and the total amount to be purchased/sold as input.
  o Responds back with a breakdown of the amount and number of shares to purchase/sell for each stock in the model portfolio and when to execute the orders.
  o Returns historic orders.
• Internally, we should be able to configure the number of decimal places allowed for the quantity of shares to be purchased/sold (e.g. we may accept buy/sell orders for shares up to 3 decimal places today, but may change that to allow up to 7 decimal places in future).
• For simplicity, we'll fix the price of any stock to $100. However, if the partner decides to pass the market price for the stocks within the model portfolio, it should take priority over the fixed price we have defined.

Technical Requirements
• The API design must follow RESTful conventions.
• You have to define the endpoints and specify how you would take in data (i.e. format, data type, etc.).
• Performance is important. Instrument the response times in milliseconds so that this is visible in the console.
• The endpoint should be flexible in its design. It should allow for different model portfolios and different order types (BUY or SELL).
• Data should not survive application restart.
"""

**Your approach:**

1. **Explore and clarify ambiguities** in the requirement through structured questions:
   - What edge cases or constraints need explicit handling? (e.g., fractional shares, rounding rules, insufficient funds)
   - How should order execution timing be represented in the API response? (e.g., a specific timestamp, a market hours indicator, or a scheduled execution time?)
   - What constitutes "historic orders"? (e.g., all orders from this session, orders from a specific time range, orders by portfolio?)
   - How should the API handle invalid input (missing stocks, invalid percentages, etc.)?
   - Should the API validate that model portfolio allocations sum to 100%?

2. **Produce a final PRD** that includes:
   - Clear, unambiguous functional requirements
   - Data models (request/response schemas with exact field names, types, and examples)
   - Endpoint definitions (HTTP method, path, parameters, request body, response body)
   - Edge cases and error handling
   - Performance expectations and observability requirements
   - Configuration strategy for decimal places (how is this stored/managed?)
   - Scope boundaries (what's in this MVP, what's future work?)

3. **Break the PRD into executable development chunks** that can be built incrementally:
   - Organize by feature or technical layer (e.g., data models → core logic → API endpoints → performance instrumentation → historic orders)
   - For each chunk: define acceptance criteria, dependencies, and estimated complexity
   - Ensure chunks are small enough to validate quickly but large enough to be meaningful
   - Order chunks so early builds can be tested independently

4. **Create a test plan** that covers:
   - Unit tests for core logic (portfolio splitting, share quantity calculation, rounding)
   - Integration tests for each endpoint
   - Edge cases (fractional shares, rounding precision, invalid portfolios, BUY vs SELL)
   - Performance tests (response time validation)
   - Error scenarios (missing data, invalid input, misconfigured decimal places)

**Output format:**

Provide three deliverables in this order:

1. **Refined PRD** – A complete, unambiguous specification ready to guide development
2. **Development Chunks** – An ordered list of actionable, independently testable pieces of work
3. **Test Plan** – Test cases organized by feature and priority level

Be specific with examples, data types, and edge cases. Assume the developer will use this output directly with Cursor to build the API incrementally.
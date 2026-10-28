/**
 * Extra CWA questions (appended after the originals in latrobeBanks.ts, ids -x1, -x2, ...).
 * Format: x(week, difficulty, prompt, correct, [three wrong], explanation, { kind, accept, tolerance, unit, workedExample }).
 * Never reorder or delete entries once shipped: ids are positional and saves remember them. Append only.
 */

import type { RealmKeyTerm } from "../../../types";
import { kt, x, type ExtraQuestion } from "./x";

export const EXTRA_CWA: ExtraQuestion[] = [
  // Week 1: cloud foundations
  x(1, 1, "Name the cloud model where you rent virtual machines, storage and networks, and manage everything from the OS upwards.", "IaaS", ["PaaS", "SaaS", "On-premises"], "With IaaS (e.g. EC2) the provider runs the hardware and hypervisor. The guest OS and up is yours.", { kind: "term", accept: ["Infrastructure as a Service", "infrastructure-as-a-service", "infrastructure as service"] }),
  x(1, 3, "A DNS record has a TTL of 3600 seconds. After you change its IP address, for up to how many minutes might resolvers keep serving the old one?", "60", ["36", "6", "3600"], "3600 s ÷ 60 = 60 minutes. Lower the TTL a day before a planned move so the switch spreads faster.", { kind: "numeric", tolerance: 0, unit: "min" }),
  x(1, 3, "Why must web servers be stateless before you scale them out?", "Any instance may get the next request", ["Load balancers only accept stateless apps", "Stateful servers can't use HTTPS at all", "Cloud providers charge more for state"], "Keep sessions and files in a shared store, such as a database or cache, so any server can answer."),
  x(1, 1, "Which part of an HTTP response tells the client whether the request succeeded?", "The status code", ["The Content-Type header", "The request method", "The body's first line"], "Status codes group outcomes: 2xx success, 3xx redirect, 4xx client error, 5xx server error."),
  x(1, 3, "A ticket site gets 50 times its normal traffic for one hour when sales open. Which cloud property matters most?", "Elasticity: scale out, then back in", ["Durability: copies across many zones", "Vertical scaling: one big server all year", "Edge caching: a CDN for each page"], "Elastic capacity matches the spike, and you pay only while it runs."),

  // Week 2: hosting and full-stack development
  x(2, 3, "The React form checks that a price is positive. Why must the Express API check it again?", "Anyone can call the API without the form", ["React validation only runs in development", "Express ignores fields the form didn't check", "Browsers strip validation from production builds"], "The frontend is untrusted. Rules that matter must be enforced on the server."),
  x(2, 2, "A successful POST should return 201 Created with a ____ header pointing to the new resource.", "Location", ["Content-Location", "Referer", "Host"], "The Location header gives the new resource's URL, such as /api/tasks/42.", { kind: "cloze", accept: ["Location header", "location:"] }),
  x(2, 3, "A Node route runs a 3-second synchronous loop. What happens to other requests meanwhile?", "They wait, as the event loop is blocked", ["They run on spare threads in the pool as normal", "Node spins up a new process for each", "They fail at once with 503 errors"], "Node runs your JavaScript on one thread. Move heavy work to async I/O, a worker thread or a queue."),
  x(2, 2, "Name the response header a server sends to let a page from another origin read the response.", "Access-Control-Allow-Origin", ["Content-Security-Policy", "Cross-Origin-Resource-Policy", "Origin"], "CORS is opt-in by the server. The header names the allowed origin, or * for public data.", { kind: "term", accept: ["ACAO", "Access Control Allow Origin", "AccessControlAllowOrigin", "Access-Control-Allow-Origin header"] }),

  // Week 3: databases
  x(3, 3, "Students and subjects are many-to-many. How do you model this in a relational database?", "A linking table of student and subject IDs", ["A subjects array column on each student row", "A subject_id foreign key on the students table", "One student row copied for every subject taken"], "A junction table such as enrolments holds one row per pairing, with a foreign key to each side."),
  x(3, 2, "Three Node servers behind a load balancer must share one database. Which fits better?", "PostgreSQL, a server they all connect to", ["SQLite, with one file on each server", "SQLite, with the one file kept on a network share", "A JSON file in each server's memory"], "SQLite is a library inside one process. Shared, concurrent access across servers needs a database server."),
  x(3, 3, "An orders table has 2 million rows and filtering by customer_id is slow. What's the best first fix?", "Add an index on customer_id", ["Add more columns to the orders table", "Move the table to a document database", "Fetch every row and filter it in Node"], "An index lets the database find matching rows without scanning the whole table. Confirm with EXPLAIN."),
  x(3, 2, "A transfer's debit and credit must both happen or neither does. This ACID property is ____.", "atomicity", ["consistency", "isolation", "durability"], "Atomicity makes a transaction all or nothing. If any step fails, the whole thing rolls back.", { kind: "cloze", accept: ["atomic", "atomicity property"] }),

  // Week 4: building a full-stack app
  x(4, 2, "An HTTP ____ response means the client is authenticated but not allowed to access the resource.", "403", ["401", "404", "405"], "401 means the server doesn't know who you are. 403 means it does, and the answer is still no.", { kind: "cloze", accept: ["403 Forbidden", "Forbidden", "HTTP 403"] }),
  x(4, 3, "In Express, what turns a middleware function into an error handler?", "Its signature has four parameters", ["It is registered before all the routes", "It is named errorHandler in app.js", "It always sends a 500 status code"], "Express spots error middleware by its (err, req, res, next) signature. Register it after the routes."),
  x(4, 3, "A 500 handler sends err.stack back to the browser. Why is that a problem?", "It shows attackers internal paths and code", ["It makes every response far slower to send", "Browsers block responses that contain stacks", "It stops the error appearing in server logs"], "Log the full error on the server and give the client a safe, generic message."),
  x(4, 3, "A client retries a failed request with exponential backoff, waiting 1 s and doubling each time. How many seconds has it waited in total before its 5th attempt?", "15", ["16", "31", "8"], "Waits before attempts 2 to 5 are 1 + 2 + 4 + 8 = 15 s. Add random jitter so clients don't retry in sync.", { kind: "numeric", tolerance: 0, unit: "s" }),
  x(4, 2, "A POST arrives with a required field missing. Which status code fits best?", "400 Bad Request", ["404 Not Found", "500 Internal Server Error", "401 Unauthorized"], "The client sent invalid input, so it's a 4xx. Return a message naming the missing field."),

  // Week 5: authentication and secure access
  x(5, 2, "Name the cookie attribute that stops page scripts from reading a session cookie.", "HttpOnly", ["Secure", "SameSite=Strict", "Domain"], "HttpOnly blocks document.cookie access, which limits XSS damage. Secure keeps the cookie to HTTPS.", { kind: "term", accept: ["HTTP-only", "Http Only", "httponly flag", "HttpOnly attribute"] }),
  x(5, 3, "Why can a server session be revoked instantly, while a JWT usually can't?", "Sessions live on the server; a JWT is valid until expiry", ["JWTs are encrypted, so the server can't read them back to cancel", "Sessions use HTTPS, but JWTs are sent in plain text", "Browsers cache JWTs and ignore any logout request"], "Delete a session and it's gone. JWTs need short expiry, a deny list or token rotation."),
  x(5, 3, "bcrypt at cost 10 takes 80 ms per hash. About how many milliseconds will cost 12 take?", "320", ["96", "160", "800"], "The cost is a power of two, so each +1 doubles the work. Two steps up is 4 × 80 = 320 ms.", { kind: "numeric", tolerance: 5, unit: "ms" }),

  // Week 6: advanced React and Next.js
  x(6, 3, "A list uses the array index as each item's key. What goes wrong when items are reordered?", "Inputs keep state from the wrong item", ["React throws an error and stops rendering", "The list re-sorts back to its first order", "Every item unmounts and loses its styles"], "Keys tell React which item is which. Use a stable ID, not the position."),
  x(6, 3, "Pages are pre-built as static HTML and quietly rebuilt in the background after a set time. This Next.js strategy is…", "incremental static regeneration", ["server-side rendering per request", "client-side rendering", "static generation at build only"], "ISR serves fast cached pages and refreshes them on a timer, without a full rebuild."),
  x(6, 3, "A Server Component needs a button with an onClick handler. What's the cleanest fix?", "Move the button into a Client Component", ["Add \"use client\" to the root layout file", "Add \"use server\" to the onClick function", "Wrap the button in a React Suspense boundary"], "Keep the client boundary as low as possible, so the rest stays server-rendered and ships less JavaScript."),
  x(6, 2, "When two sibling components need the same state, React advises lifting it up to their nearest common ____.", "parent", ["child", "context", "sibling"], "The shared parent owns the state, passes it down as props and receives changes through callbacks.", { kind: "cloze", accept: ["ancestor", "parent component", "common parent", "common ancestor"] }),

  // Week 7: IoT and MQTT
  x(7, 2, "Name the MQTT message a broker publishes on a client's behalf when it disconnects without warning.", "Last will", ["Retained message", "PINGREQ", "QoS 0 message"], "The last will (and testament) is set at connect time, so dashboards can show the device as offline.", { kind: "term", accept: ["last will and testament", "LWT", "will message", "last will message", "will"] }),
  x(7, 3, "An MQTT client connects with a keep-alive of 60 seconds. By the spec, after how many seconds of silence may the broker drop it?", "90", ["60", "120", "30"], "Brokers allow one and a half keep-alive periods: 1.5 × 60 = 90 s. Then the client's last will is published.", { kind: "numeric", tolerance: 0, unit: "s" }),
  x(7, 3, "A dashboard subscribes at 10:05, but the sensor last published its status at 9:00. How can the dashboard show it straight away?", "The sensor sets the retain flag", ["The dashboard subscribes at QoS 2", "The broker replays the full topic history", "The sensor publishes with a last will"], "A retained message is stored per topic and sent to each new subscriber at once."),
  x(7, 3, "Why give each IoT device its own certificate instead of one shared password?", "One stolen device can be revoked alone", ["Certificates make messages much smaller", "Shared passwords don't work with MQTT", "Certificates remove the need for TLS"], "Per-device identity limits the damage of one compromise and supports topic-level access rules."),

  // Week 8: ASP.NET Core
  x(8, 3, "appsettings.json sets the connection string to A, and an environment variable sets it to B. Which does the app use by default?", "B, as environment variables load later", ["A, as JSON files always take priority", "Neither, so the app throws an error at start-up", "Whichever was edited most recently"], "In the default setup, later configuration sources override earlier ones, and environment variables come after appsettings."),
  x(8, 2, "Name Microsoft's object-relational mapper that lets C# code query a database with LINQ.", "EF Core", ["Dapper", "ADO.NET", "LINQ to Objects"], "Entity Framework Core maps classes to tables and tracks changes through a DbContext.", { kind: "term", accept: ["Entity Framework Core", "Entity Framework", "EFCore", "EF", "Entity Framework (EF) Core"] }),
  x(8, 3, "A singleton service takes a scoped DbContext in its constructor. What's the problem?", "The DbContext outlives its request", ["The DbContext is created twice per request", "Singletons can't take constructor parameters", "Scoped services only work in Razor Pages"], "This is a captive dependency: one context is shared across requests and threads. ASP.NET Core flags it in Development."),
  x(8, 2, "After changing an EF Core model, you run dotnet ef ____ add to create the schema change.", "migrations", ["database", "dbcontext scaffold", "update"], "A migration records the schema change in code. dotnet ef database update then applies it.", { kind: "cloze", accept: ["migration"] }),
  x(8, 2, "A small, form-based site where each page handles its own GET and POST suits…", "Razor Pages", ["MVC with shared views", "Blazor WebAssembly", "SignalR"], "Razor Pages pair each page with its own page model. MVC suits larger apps that share views."),

  // Week 9: the Microsoft family
  x(9, 3, "A nightly job with no user signed in must read every staff calendar through Microsoft Graph. Which permission type fits?", "Application permissions, admin consent", ["Delegated permissions, user consent", "Delegated permissions, admin consent", "Application permissions, any user's consent"], "With no user present, the app acts as itself. Application permissions always need admin consent."),
  x(9, 2, "Which Azure service stores secrets, keys and certificates for apps to read at runtime?", "Key Vault", ["Blob Storage", "App Configuration", "Entra ID"], "Key Vault holds secrets centrally, and apps read them with a managed identity, so nothing sits in config."),
  x(9, 3, "Why deploy to a staging slot on App Service and then swap?", "You test it live, then switch with no downtime", ["Staging slots run your code faster than production", "Swapping copies your database into production", "Slots let you skip the build step in your pipeline"], "The slot is warmed up before the swap, and you can swap back if something breaks."),
  x(9, 2, "A Microsoft Graph call for the signed-in user's own profile is GET /____.", "me", ["users/self", "profile", "whoami"], "/me is shorthand for the signed-in user, as in GET https://graph.microsoft.com/v1.0/me.", { kind: "cloze", accept: ["/me", "v1.0/me", "/v1.0/me"] }),
  x(9, 2, "Azure SQL Database is a managed service. Which job is still yours?", "Designing the schema and tuning queries", ["Patching the database engine every month", "Running and storing nightly backups", "Setting up failover hardware in a zone"], "Microsoft runs patching, backups and high availability. Your data model and queries stay your job."),

  // Week 10: AWS deployment and hosting
  x(10, 3, "A Lambda function runs 2 million times a month for 500 ms each at 1 GB of memory. How many GB-seconds is that?", "1000000", ["2000000", "500000", "1000"], "2,000,000 × 0.5 s × 1 GB = 1,000,000 GB-seconds. Lambda bills compute by the GB-second, plus a fee per request.", { kind: "numeric", tolerance: 0, unit: "GB-s", accept: ["1,000,000", "1e6", "1 million"] }),
  x(10, 3, "What does a Multi-AZ RDS deployment mainly give you?", "Automatic failover to a standby in another zone", ["More read capacity for heavy reporting and analytics", "Lower latency for users in other countries", "Cheaper storage by spreading data across zones"], "The standby takes over if the primary fails. Read replicas, not Multi-AZ, add read capacity."),
  x(10, 2, "Which AWS service is the managed DNS for your domain?", "Route 53", ["CloudFront", "API Gateway", "VPC"], "Route 53 resolves your domain and can point it at a load balancer or CloudFront distribution."),
  x(10, 3, "A Lambda-backed API is slow on the first request after a quiet spell, then fast. What's the cause?", "A cold start", ["A full database", "DNS propagation", "Throttling by API Gateway"], "A new execution environment has to start and load your code. Smaller bundles or provisioned concurrency help."),
  x(10, 2, "Security groups are ____, so replies to allowed inbound traffic go out automatically.", "stateful", ["stateless", "encrypted", "regional"], "Security groups track connections. Network ACLs are stateless and need rules both ways.", { kind: "cloze", accept: ["state-ful", "state ful"] }),

  // Week 11: automation and operations
  x(11, 3, "Why put nginx in front of a Node app listening on port 3000?", "It handles TLS on 443 and proxies to Node", ["It compiles the Node app for faster start-up", "It lets Node skip its own error handling", "It replaces PM2 by restarting crashed apps"], "nginx terminates HTTPS, serves static files and forwards requests to localhost:3000."),
  x(11, 2, "Name the practice of defining servers and networks in version-controlled files instead of clicking in a console.", "Infrastructure as code", ["Continuous deployment pipeline", "Configuration drift", "Platform engineering"], "IaC tools such as Terraform or CloudFormation make environments repeatable and reviewable.", { kind: "term", accept: ["IaC", "infrastructure-as-code", "infrastructure as code (IaC)"] }),
  x(11, 3, "Why let GitHub Actions assume an AWS role through OIDC instead of storing an access key?", "Credentials are short-lived and never stored", ["OIDC makes every workflow run start much faster", "Access keys can't be used from GitHub runners at all", "OIDC encrypts the code it deploys"], "Short-lived tokens leave nothing long-lived to leak. Trust can be limited to one repository and branch."),
  x(11, 3, "A service promises 99.9% uptime over a 30-day month. How many minutes of downtime does that allow?", "43.2", ["4.32", "432", "8.76"], "30 × 24 × 60 = 43,200 minutes, and 0.1% of that is 43.2. Each extra nine cuts it by ten.", { kind: "numeric", tolerance: 0.1, unit: "min" }),
  x(11, 2, "Blue-green deployment lowers risk because…", "traffic can flip back to the old copy at once", ["the new version is only ever tested by real users in production", "both versions run in one container to save cost", "it removes the need for any automated tests"], "Two full environments run side by side. If the new one misbehaves, the router points back to the old one."),

  // Week 12: final integration and professional practice
  x(12, 2, "The testing pyramid recommends…", "many unit tests, fewer integration, few end-to-end", ["mostly end-to-end tests, since they're most realistic", "equal numbers of unit, integration and end-to-end", "manual tests first, then automate whatever fails"], "Unit tests are fast and cheap. End-to-end tests are realistic but slow and brittle, so keep a few."),
  x(12, 2, "Name the release strategy that sends a new version to a small share of users first, then widens it if metrics stay healthy.", "Canary release", ["Blue-green deployment", "Rolling update", "Feature freeze"], "A canary limits the blast radius. If error rates rise, you roll back before most users notice.", { kind: "term", accept: ["canary", "canary deployment", "canary deploy", "canary rollout", "canary releases"] }),
  x(12, 2, "Under semantic versioning, a backward-compatible new feature on version 2.3.1 should ship as ____.", "2.4.0", ["2.3.2", "3.0.0", "2.4.1"], "A new compatible feature bumps MINOR and resets PATCH to 0.", { kind: "cloze", accept: ["2.4", "v2.4.0", "v2.4"] }),
  x(12, 3, "Changing /api/orders/123 to /api/orders/124 shows another customer's order. Which OWASP Top 10 risk is this?", "Broken Access Control", ["Injection", "Security Misconfiguration", "Cryptographic Failures"], "The server must check that the order belongs to the signed-in user, not just that they're signed in."),
  x(12, 3, "Which response header restricts which scripts a page may run, limiting XSS damage?", "Content-Security-Policy", ["Strict-Transport-Security", "Access-Control-Allow-Origin", "X-Content-Type-Options"], "A CSP lists the allowed script sources, so injected inline scripts are blocked."),
  x(12, 2, "A response carries Cache-Control: max-age=86400. For how many hours may the browser reuse it without asking the server?", "24", ["1", "12", "86.4"], "86,400 s ÷ 3600 = 24 hours. Fingerprinted file names let you cache for a year and still ship updates.", { kind: "numeric", tolerance: 0, unit: "h" }),
];

/**
 * Extra CWA key terms, tagged by teaching week (merged after the bank's original 18 terms, deduplicated by term).
 * Format: kt(week, term, definition). One clear sentence, Australian English, no em dashes.
 */
export const EXTRA_CWA_TERMS: RealmKeyTerm[] = [
  // Week 1: cloud web applications
  kt(1, "DNS", "The Domain Name System, which translates domain names into IP addresses, with resolvers caching answers for each record's TTL."),
  kt(1, "Shared responsibility model", "The cloud provider secures the cloud itself, while the customer secures what they put in it, including the guest OS on EC2."),
  kt(1, "Rapid elasticity", "The cloud's ability to add capacity quickly as demand rises and release it when demand falls."),

  // Week 2: hosting and full-stack development
  kt(2, "Static hosting", "Serving the same pre-built files to every visitor, which is cheap and easy to cache, as with a React production build."),
  kt(2, "Origin", "The scheme, host and port of a URL, so a different port means a different origin."),
  kt(2, "useState", "The React hook that returns a state value and a setter, and only the setter triggers a re-render."),
  kt(2, "Event loop", "Node's single-threaded mechanism that serves other requests while slow I/O is awaited, so CPU-heavy code blocks everyone."),

  // Week 3: databases
  kt(3, "Primary key", "A column, or set of columns, whose value uniquely identifies each row in a table."),
  kt(3, "Foreign key", "A column that references another table's primary key to link related rows."),
  kt(3, "Junction table", "A linking table holding pairs of keys from two tables, used to model a many-to-many relationship."),
  kt(3, "ACID", "Atomicity, consistency, isolation and durability: the guarantees that make a transaction all-or-nothing and safe under concurrency."),
  kt(3, "Document database", "A database that stores self-contained, JSON-like documents, so data read together is stored together."),
  kt(3, "Graph database", "A database of nodes and relationships, suited to multi-hop questions such as friends of friends."),

  // Week 4: building a full-stack app
  kt(4, "REST API", "An API that names resources with noun URLs and uses HTTP methods such as GET, POST and DELETE as the verbs."),
  kt(4, "PATCH", "The HTTP method that updates only some fields of a resource, whereas PUT replaces the whole resource."),
  kt(4, "403 Forbidden", "The status for a client that is authenticated but not allowed, unlike 401, which means not authenticated."),
  kt(4, "response.ok", "A fetch response property that is true only for 2xx statuses, which you must check because fetch doesn't reject on 4xx or 5xx."),
  kt(4, "Environment variable", "A setting such as a connection string read at runtime from process.env, which keeps secrets out of the repository."),
  kt(4, "Error-handling middleware", "Express middleware with four parameters (err, req, res, next) that centralises error responses."),

  // Week 5: authentication and secure access
  kt(5, "Authentication", "Proving who a user is, before authorisation decides what they may do."),
  kt(5, "Salt", "A unique random value added to each password before hashing, which defeats precomputed rainbow tables."),
  kt(5, "HttpOnly", "A cookie attribute that stops page scripts reading the cookie, which protects session IDs from XSS."),

  // Week 6: advanced React and Next.js
  kt(6, "Rules of Hooks", "Call hooks only at the top level of components or custom hooks, in the same order on every render."),
  kt(6, "useEffect", "The React hook for side effects after render, whose dependency array controls re-runs and whose cleanup runs before re-runs and on unmount."),
  kt(6, "Lifting state up", "Moving shared state to the closest common parent and passing it down as props."),
  kt(6, "Client Component", "A Next.js component in a file marked \"use client\", which runs in the browser and can use state and event handlers."),
  kt(6, "Incremental static regeneration", "A Next.js strategy that serves pre-built static pages and rebuilds them in the background after a revalidate period."),

  // Week 7: IoT and MQTT
  kt(7, "MQTT broker", "The server that receives published MQTT messages and routes each one to the clients subscribed to its topic."),
  kt(7, "Topic wildcard", "In MQTT, + matches exactly one topic level and # matches any number of levels and must come last."),
  kt(7, "Quality of service (QoS)", "MQTT's delivery levels: 0 at most once, 1 at least once with possible duplicates, and 2 exactly once."),
  kt(7, "Retained message", "The last message on a topic, kept by the broker and sent at once to any new subscriber."),
  kt(7, "Last will", "A message the broker publishes on a client's behalf if that client disconnects without warning."),

  // Week 8: ASP.NET Core
  kt(8, "Service lifetime", "How long ASP.NET Core keeps a registered service: Singleton for the whole app, Scoped per request and Transient per injection."),
  kt(8, "Razor", "The .cshtml syntax that mixes C# into HTML with @ to render pages on the server."),
  kt(8, "Razor Pages", "A page-focused ASP.NET Core model where each page pairs with a page model that handles its own GET and POST."),
  kt(8, "Minimal API", "Endpoints mapped in Program.cs with MapGet or MapPost and a lambda, without controllers."),
  kt(8, "Entity Framework Core", "Microsoft's object-relational mapper that maps C# classes to tables, turns LINQ into SQL and evolves schemas with migrations."),

  // Week 9: the Microsoft family
  kt(9, "Microsoft Entra ID", "Microsoft's cloud identity and access management service, formerly Azure Active Directory."),
  kt(9, "App registration", "The Entra ID entry that gives an app a client ID, redirect URIs and permissions in a tenant."),
  kt(9, "Application permissions", "Permissions that let an app act as itself with no user signed in and need admin consent, unlike delegated permissions."),
  kt(9, "Managed identity", "An Entra ID identity for an Azure resource, letting it reach other Azure resources with no secrets in code or config."),
  kt(9, "Azure Key Vault", "Azure's service for storing secrets, keys and certificates that apps read at runtime."),

  // Week 10: AWS deployment and hosting
  kt(10, "Availability zone", "An isolated data centre location within an AWS region, so spreading across two or more gives high availability."),
  kt(10, "Amazon EC2", "AWS virtual servers (IaaS), where you choose the image, instance type and storage and manage the guest OS upwards."),
  kt(10, "Amazon RDS", "AWS managed relational databases, where AWS handles patching, backups and Multi-AZ failover and you handle schema and access."),
  kt(10, "Load balancer", "A single entry point that spreads traffic across instances and uses health checks to skip unhealthy ones."),
  kt(10, "Auto Scaling group", "A group of EC2 instances kept between a minimum and maximum size, added or removed by scaling policies."),

  // Week 11: automation and operations
  kt(11, "GitHub Actions workflow", "A YAML file in .github/workflows that runs jobs of steps on runners when an event such as a push triggers it."),
  kt(11, "Repository secret", "An encrypted value stored in GitHub, read in workflows as ${{ secrets.NAME }} and masked in logs."),
  kt(11, "PM2", "A Node process manager that runs apps in the background, restarts them after crashes and starts them on boot."),
  kt(11, "Reverse proxy", "A server such as nginx that takes client requests on ports 80 and 443, terminates TLS and forwards them to the app."),
  kt(11, "Infrastructure as code", "Defining servers and networks in version-controlled files, with tools such as CloudFormation, CDK or Terraform."),

  // Week 12: integration and professional practice
  kt(12, "Testing pyramid", "The guideline of many fast unit tests, fewer integration tests and a few end-to-end tests."),
  kt(12, "Smoke test", "A short check of key user flows on the live production URL straight after a deployment."),
  kt(12, "Semantic versioning", "MAJOR.MINOR.PATCH numbering, where major marks a breaking change, minor a compatible feature and patch a fix."),
  kt(12, "Canary release", "Sending a new version to a small share of users first, then widening it only if the metrics stay healthy."),
  kt(12, "Broken access control", "The OWASP Top Ten risk where users can act outside their permissions, such as viewing another customer's order by changing an ID."),
  kt(12, "Content-Security-Policy", "A response header that restricts which scripts and resources a page may load, limiting the damage of XSS."),
];

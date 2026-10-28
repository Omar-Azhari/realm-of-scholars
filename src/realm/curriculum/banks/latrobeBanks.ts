/**
 * Hand-written question banks for the La Trobe subjects UniGame ships with
 * (2026 Semester 2). Questions follow each subject's real weekly module
 * topics (src/data/modules.ts) and test application, not recall of the
 * syllabus: scenarios, calculations, and choosing between close options.
 *
 * Format: q(week, difficulty, prompt, correct, [three wrong], explanation).
 * The correct answer's position is shuffled deterministically when built.
 */

import type { RealmKeyTerm, RealmQuestion } from "../../types";
import type { ExtraQuestion } from "./extra/x";
import { EXTRA_UI } from "./extra/ui";
import { EXTRA_CWA } from "./extra/cwa";
import { EXTRA_PM } from "./extra/pm";
import { EXTRA_PPE } from "./extra/ppe";
import { withExtraTerms } from "./extra/terms";

export interface BankQuestion {
  week: number;
  difficulty: 1 | 2 | 3;
  prompt: string;
  correct: string;
  wrong: [string, string, string];
  explanation: string;
}

function q(week: number, difficulty: 1 | 2 | 3, prompt: string, correct: string, wrong: [string, string, string], explanation: string): BankQuestion {
  return { week, difficulty, prompt, correct, wrong, explanation };
}

export interface SubjectBank {
  match: (code: string, name: string) => boolean;
  keyTerms: RealmKeyTerm[];
  questions: BankQuestion[];
}

const EXTRAS = new Map<string, ExtraQuestion[]>();

/**
 * A bank belongs to one La Trobe subject, matched by its Handbook code (CSE2UI, CSE3CWA, CSE3PM, CSE3PPE).
 * A subject with no code (the saved La Trobe set keeps PM and PPE without one) matches only on the
 * subject's exact full name, so a nursing "Professional Practice" or a business "MGT3PM Project Management" gets no IT bank.
 */
function byCode(code: string, bankCode: string, name: string, exactName: RegExp): boolean {
  // "CSE3PM" and "CSE3PM-2026" match; "CSE3PMX" (a different subject) doesn't.
  if (code) return new RegExp(`^${bankCode}(?![A-Z0-9])`).test(code.toUpperCase().replace(/\s+/g, ""));
  return exactName.test(name.trim().replace(/\s+/g, " "));
}

// ---------------------------------------------------------------------------
// CSE2UI — User Interface Design
// ---------------------------------------------------------------------------

const ui: SubjectBank = {
  match: (code, name) => byCode(code, "CSE2UI", name, /^user interface design$/i),
  keyTerms: [
    { term: "Usability", definition: "The extent to which specified users can achieve specified goals with effectiveness, efficiency and satisfaction in a context of use (ISO 9241-11)." },
    { term: "Human-centred design", definition: "An approach that involves users throughout design and iterates based on evaluation with them." },
    { term: "Double Diamond", definition: "A design process of Discover and Define (first diamond), then Develop and Deliver (second diamond), alternating divergence and convergence." },
    { term: "Persona", definition: "An archetypal user synthesised from research, with goals, behaviours and pain points." },
    { term: "Affinity diagram", definition: "Clustering research notes into themes to find patterns." },
    { term: "Contextual inquiry", definition: "Observing and interviewing people in their real environment while they work." },
    { term: "Prototype fidelity", definition: "How closely a prototype resembles the final product in look, content and interaction." },
    { term: "Wizard of Oz prototype", definition: "A prototype where a hidden person simulates system behaviour that hasn't been built." },
    { term: "Think-aloud protocol", definition: "A usability test in which participants verbalise their thoughts while doing tasks." },
    { term: "Heuristic evaluation", definition: "Experts inspect an interface against usability principles such as Nielsen's ten heuristics." },
    { term: "System Usability Scale", definition: "A 10-item questionnaire producing a 0-100 usability score; about 68 is average." },
    { term: "Thematic analysis", definition: "Coding qualitative data and grouping codes into themes." },
    { term: "Affordance", definition: "The relationship between an object's properties and the actions a person can take with it." },
    { term: "Signifier", definition: "A perceivable cue that indicates where and how to act." },
    { term: "Mental model", definition: "A user's internal understanding of how a system works." },
    { term: "Gulf of execution", definition: "The gap between what a user wants to do and the actions the interface makes available." },
    { term: "Curb-cut effect", definition: "When a feature designed for disabled people benefits everyone." },
    { term: "Fitts's law", definition: "Time to reach a target grows with distance and shrinks with target size." },
  ],
  questions: [
    q(1, 2, "ISO 9241-11 defines usability in terms of which three measures?", "Effectiveness, efficiency and satisfaction", ["Learnability, memorability and error rate", "Efficiency, learnability and satisfaction", "Effectiveness, accessibility and satisfaction"], "ISO 9241-11: users achieving goals with effectiveness, efficiency and satisfaction in a specified context of use."),
    q(1, 2, "Which statement best separates UI design from UX design?", "UI shapes the elements people interact with; UX covers the whole experience", ["UX is the visual layer people see; UI is the research that shapes it", "UI covers the whole experience; UX shapes the screens people interact with", "UI is the front-end code people run; UX is the visual design and colours"], "UI is a part of UX: the interface is one touchpoint within the overall experience, which also includes needs, flows and satisfaction."),
    q(2, 2, "A team designs a hospital kiosk entirely from developers' assumptions and first tests it at launch. Which human-centred design principle did they break most?", "Involve users early and iterate on design using their evaluation", ["Keep the visual design consistent with the hospital's brand guidelines", "Specify every requirement in full before any design work begins", "Minimise the number of screens and steps in each task flow"], "Human-centred design (ISO 9241-210) requires user involvement and iteration throughout, not a test at the end."),
    q(2, 2, "Under WCAG 2.x level AA, what is the minimum contrast ratio for normal-size body text?", "4.5:1", ["3:1", "7:1", "3.5:1"], "AA requires 4.5:1 for normal text and 3:1 for large text; 7:1 is the AAA level."),
    q(2, 1, "WCAG is organised around which four principles?", "Perceivable, Operable, Understandable, Robust", ["Perceivable, Operable, Usable, Reliable", "Predictable, Observable, Understandable, Robust", "Perceivable, Optimised, Understandable, Readable"], "The POUR principles underpin every WCAG success criterion."),
    q(3, 3, "You need to learn how nurses really use a medication app during busy shifts, including workarounds they wouldn't think to mention. Which method fits best?", "Contextual inquiry with nurses on the ward", ["An online survey of nurses across the hospital", "Remote interviews with nurses after their shifts", "A heuristic evaluation of the app by UX experts"], "Workarounds are tacit; people rarely report them. Observing and questioning nurses in context reveals them."),
    q(3, 2, "In the Double Diamond, which two phases are divergent (opening up options)?", "Discover and Develop", ["Discover and Deliver", "Define and Develop", "Discover and Define"], "Discover diverges, Define converges; Develop diverges, Deliver converges."),
    q(3, 2, "Which interview question is least likely to bias the participant?", "\"Tell me about the last time you booked a flight.\"", ["\"Wouldn't one-click booking make this easier?\"", "\"Do you find the current booking process frustrating?\"", "\"Would you use an app that booked flights for you?\""], "Open questions about past behaviour avoid leading the participant, assuming an opinion or asking them to predict the future."),
    q(4, 2, "A persona is best described as…", "a composite user built from research, with goals and pain points", ["a real customer interviewed in depth to stand for every user", "a demographic segment defined by age, income and location", "an imagined ideal user written by the team before any research"], "Personas are research-based composites with goals, behaviours and pain points, not individuals or demographics."),
    q(4, 2, "After 15 interviews you have hundreds of observation notes. Which technique clusters them into themes?", "Affinity diagramming", ["Card sorting with users", "A customer journey map", "A Fitts's law analysis"], "Affinity diagramming groups related notes bottom-up so themes emerge from the data."),
    q(4, 3, "Which is a well-formed \"How might we…\" statement?", "How might we help first-years find today's classes within 30 seconds?", ["How might we build a React timetable dashboard for first-years?", "How might we improve the whole university experience for students?", "How might we add a timetable button to the app's home screen?"], "A good HMW frames a user need and outcome without prescribing a solution, and isn't so broad that nobody knows where to start."),
    q(5, 2, "Why do ideation sessions defer judgement?", "Early criticism cuts the number and variety of ideas people share", ["Judging ideas takes longer than generating them, so it wastes time", "Only the lead designer is qualified to evaluate the ideas later", "Ideas are judged in the Define phase, before any are generated"], "Quantity and diversity first, which raises the chance of strong solutions; convergence comes later."),
    q(5, 1, "The \"Crazy 8s\" technique asks designers to…", "sketch eight distinct ideas in eight minutes", ["test one sketch with eight users in eight minutes", "refine one chosen idea through eight quick versions", "vote on eight ideas and keep the strongest one"], "It forces rapid divergent sketching past the first obvious idea."),
    q(5, 2, "A storyboard is most useful in ideation for…", "showing how a solution fits the user's situation step by step", ["specifying the exact layout, spacing and colours of each screen", "measuring how long users take to complete key tasks", "mapping the site's pages and its navigation hierarchy"], "Storyboards communicate the scenario and sequence of actions over time, not visual detail."),
    q(6, 2, "You want to test whether users understand the navigation structure before any visual design exists. Which prototype fits?", "A low-fidelity paper or wireframe prototype", ["A pixel-perfect high-fidelity mock-up in Figma", "A coded build of the navigation in React", "A five-second test of the home screen design"], "Low fidelity is cheap to change and keeps feedback on structure, not polish."),
    q(6, 3, "What is the main risk of testing with a high-fidelity prototype too early?", "Users focus on polish and hold back criticism, and changes cost more", ["Participants need training before they can use a detailed, clickable prototype", "Prototyping tools can't simulate the interactions users will need", "Results can't be compared with earlier low-fidelity test rounds"], "Polished artefacts look finished, so feedback skews to surface details and sunk cost rises."),
    q(6, 2, "In a \"Wizard of Oz\" prototype…", "a hidden person plays the part of a system that hasn't been built", ["the interface is themed after a fictional world to test appeal", "the prototype is generated automatically from the team's design files", "users test a competitor's product to set a usability benchmark"], "A hidden person might type a chatbot's replies, so you can test complex behaviour before engineering it."),
    q(7, 2, "Nielsen's case for testing with about five users per round is that…", "five users find most problems, so small repeated rounds beat one big test", ["five is the smallest sample that gives statistically significant results", "five users are enough to cover every persona in a typical product", "larger groups make participants act less naturally during testing"], "Diminishing returns: later users mostly repeat problems already found."),
    q(7, 3, "In a think-aloud session a participant goes silent and stares at the screen. The best facilitator response is…", "a neutral prompt such as \"What are you thinking right now?\"", ["a gentle hint pointing out where the right button is", "a short explanation of how the feature is meant to work", "ending that task early and moving on to the next scenario"], "Helping or explaining contaminates the data; a neutral prompt keeps them talking."),
    q(7, 2, "An app shows \"Error 0x80004005\" when an upload fails. Which Nielsen heuristic is most directly violated?", "Help users recognise, diagnose and recover from errors", ["Error prevention", "Consistency and standards", "Aesthetic and minimalist design"], "Error messages should be in plain language, state the problem and suggest a fix."),
    q(7, 2, "A form submits but nothing on screen changes for five seconds. Which heuristic is violated?", "Visibility of system status", ["Match between system and the real world", "Consistency and standards", "User control and freedom"], "The system should keep users informed with timely feedback."),
    q(8, 2, "A System Usability Scale score of 68 is generally interpreted as…", "about average usability", ["good, above-average usability", "a fail below the 85 threshold", "68% of tasks completed"], "Across studies, the average SUS score is about 68; it is not a percentage."),
    q(8, 3, "The same 20 participants complete a task on design A and then design B. Assuming normal data, which test in JASP compares their task times?", "Paired-samples t-test", ["Independent-samples t-test", "Chi-square test of independence", "Pearson correlation"], "Each person provides both measurements (within-subjects), so the samples are paired."),
    q(8, 2, "Responses on a 1-5 agreement Likert item are, strictly speaking…", "ordinal data", ["interval data", "ratio data", "nominal data"], "The categories are ordered, but gaps between them aren't guaranteed equal."),
    q(8, 2, "Tagging interview transcripts with codes like \"navigation confusion\" and grouping them (e.g. in Taguette) is…", "thematic analysis", ["regression analysis", "an open card sort", "heuristic evaluation"], "Coding and theming is the core of thematic analysis of qualitative data."),
    q(9, 2, "In Norman's terms, a signifier is…", "a perceivable cue showing where and how to act", ["the range of actions an object makes possible", "the feedback the system gives you after an action", "the user's mental model of how a control works"], "The affordance is the possible action; the signifier tells you about it."),
    q(9, 3, "Why do people push a \"Norman door\" that has to be pulled?", "Its hardware signals push, though the door needs a pull", ["People ignore the PUSH and PULL signs posted on most doors", "The door lacks enough colour contrast to stand out from the wall", "The handle is too small and too far away, breaking Fitts's law"], "A flat push-bar says push. When design needs a label to work, the signifiers are wrong."),
    q(9, 3, "Flat design that removes shadows and borders from buttons mainly harms usability because…", "it weakens signifiers, so clickable elements look like static text", ["it increases page weight, so interfaces load more slowly", "it hides buttons from screen readers, which rely on shadows", "it removes the affordance, so the buttons can no longer be pressed"], "Visual cues of clickability are signifiers; removing them hides the affordance, which still exists."),
    q(10, 3, "A user sets the thermostat to 30°C to warm the room faster, though it heats at the same rate. This shows…", "an incorrect mental model of how the system works", ["a correct conceptual model of how heating works", "a skeuomorphic metaphor carried over from the dial", "a gulf of evaluation caused by missing feedback"], "Norman's classic example: users model the thermostat like a valve, not an on/off switch."),
    q(10, 1, "Desktop, folders and trash can in an operating system are examples of…", "metaphors that borrow from familiar real-world objects", ["affordances that show what actions each icon allows", "Gestalt principles that group related items on the screen", "signifiers placed to show where users should click"], "Interface metaphors transfer knowledge from the physical world to the interface."),
    q(10, 3, "The gulf of execution is the gap between…", "what the user wants to do and the actions the interface offers", ["what the system displays and how well the user can interpret it", "what the designer intended and what developers actually built", "how fast the user expects a response and how fast it arrives"], "Interpreting system state is the gulf of evaluation; this is its counterpart."),
    q(11, 2, "Video captions were designed for Deaf users but also help people in noisy cafés. This illustrates…", "the curb-cut effect", ["the Hawthorne effect", "the network effect", "the halo effect"], "Designing for disability often benefits everyone."),
    q(11, 3, "In Microsoft's inclusive-design persona spectrum, a parent holding a baby in one arm has which kind of impairment?", "Situational", ["Permanent", "Temporary", "Environmental"], "One arm missing is permanent, an arm in a cast is temporary, and holding a baby is situational."),
    q(11, 2, "Marking form errors only with a red border fails users who…", "have a colour vision deficiency", ["navigate only with a keyboard", "use a slow mobile connection", "read the page in a second language"], "This breaks WCAG's use-of-colour criterion: colour must not be the only way information is conveyed, so add text or icons."),
    q(12, 2, "Voice interfaces have no visible menu, so a key design challenge is…", "discoverability: users don't know which commands exist", ["speed: spoken replies are slower than reading a screen", "privacy: always-on microphones collect personal data", "turn-taking: users talk over the device's replies"], "Without visible options, users must guess what the system can do."),
    q(12, 2, "Fitts's law predicts that the time to hit a target depends on…", "the distance to the target and its size", ["the number of choices shown on the screen", "the target's colour contrast and its size", "the distance to the target and its colour"], "That's why screen edges and large targets are fast to hit."),
    q(12, 2, "Hick's law says decision time increases…", "logarithmically with the number of choices", ["linearly with the number of choices", "exponentially with the number of choices", "logarithmically with distance to the target"], "Fewer, well-grouped options speed up choices."),
  ],
};

// ---------------------------------------------------------------------------
// CSE3CWA — Cloud-Based Web Application Development
// ---------------------------------------------------------------------------

const cwa: SubjectBank = {
  match: (code, name) => byCode(code, "CSE3CWA", name, /^cloud[- ]based web application( development)?$/i),
  keyTerms: [
    { term: "IaaS", definition: "Infrastructure as a Service: you rent virtual machines, storage and networks and manage the OS upwards." },
    { term: "PaaS", definition: "Platform as a Service: the provider runs the OS and runtime; you deploy code and data." },
    { term: "SaaS", definition: "Software as a Service: complete applications delivered over the internet." },
    { term: "Horizontal scaling", definition: "Adding more instances behind a load balancer to handle load." },
    { term: "Middleware", definition: "Functions in a request pipeline (e.g. Express or ASP.NET Core) that process requests before the handler." },
    { term: "CORS", definition: "Browser rule requiring a server's permission headers before a page reads a cross-origin response." },
    { term: "Parameterised query", definition: "SQL with placeholders filled by the driver, preventing SQL injection." },
    { term: "OAuth 2.0", definition: "An authorisation framework that issues access tokens to apps on a user's behalf." },
    { term: "JWT", definition: "A signed, Base64URL-encoded token; its payload is readable, the signature prevents tampering." },
    { term: "bcrypt", definition: "A slow, salted, tunable password-hashing function." },
    { term: "Passkey", definition: "A WebAuthn credential: a device-held private key whose signatures are bound to the site's origin." },
    { term: "React Server Component", definition: "A component rendered on the server, the default in the Next.js App Router." },
    { term: "MQTT", definition: "A lightweight publish/subscribe protocol for IoT, routed through a broker." },
    { term: "Dependency injection", definition: "Supplying a class's dependencies from a container (e.g. AddScoped in ASP.NET Core) instead of creating them inside." },
    { term: "Microsoft Graph", definition: "A unified REST API over Microsoft 365 data such as users, mail, calendars and files." },
    { term: "Security group", definition: "An AWS virtual firewall controlling inbound and outbound traffic for instances." },
    { term: "Amazon S3", definition: "AWS object storage, often used to host static website builds." },
    { term: "CI/CD", definition: "Automatically building, testing and delivering every change through a pipeline." },
  ],
  questions: [
    q(1, 2, "A team deploys code to a service that manages the OS, runtime and scaling; they manage only their app and data. This is…", "PaaS", ["IaaS", "SaaS", "On-premises hosting"], "PaaS (e.g. Azure App Service, Elastic Beanstalk) abstracts the OS and runtime."),
    q(1, 3, "Under the cloud shared responsibility model, who patches the guest operating system of an EC2 instance?", "The customer", ["AWS, as part of the service", "Nobody: it's automatic", "The hardware vendor"], "With IaaS, everything from the guest OS upwards is the customer's responsibility."),
    q(1, 1, "Adding more servers behind a load balancer to handle traffic is…", "horizontal scaling (scaling out)", ["vertical scaling (scaling up)", "failover (adding standby servers)", "database replication (read copies)"], "Vertical scaling makes one machine bigger; horizontal adds machines."),
    q(2, 2, "What does app.use(express.json()) do in an Express app?", "Adds middleware that parses JSON request bodies into req.body", ["Sets every response's Content-Type header to application/json", "Validates request bodies against a JSON schema before routing", "Converts every object passed to res.send() into a JSON string"], "Without it, req.body is undefined for JSON POSTs."),
    q(2, 2, "Which status code best fits a successful POST that creates a resource?", "201 Created", ["200 OK", "204 No Content", "202 Accepted"], "201 signals creation, ideally with a Location header for the new resource."),
    q(2, 3, "A React app on localhost:5173 calls an API on localhost:3000 and the browser blocks the response. What's the cause and fix?", "CORS: the API must allow the app's origin in its response headers", ["Mixed content: the API must use HTTPS when the app is local", "CSRF: the API must check a token before it can answer the app", "Firewall: Windows blocks port 3000 until you allow it in its settings"], "A different port is a different origin; the server has to opt in with an Access-Control-Allow-Origin header."),
    q(2, 2, "Why call setCount(c => c + 1) in React instead of changing count directly?", "Only the setter schedules a re-render; direct mutation is never seen", ["Assigning to state is a syntax error that stops the build", "The setter batches updates, so it runs faster than mutation", "Direct mutation changes the value on the server, not the client"], "React only re-renders when state is set through its updater."),
    q(3, 3, "Which situation most favours a document (NoSQL) database over a relational one?", "Nested records with varying fields, read and written as a whole", ["Many-to-many data needing strict joins and transactions", "A financial ledger needing strong ACID guarantees across tables", "Highly normalised data feeding complex ad hoc reports"], "Document stores shine when the aggregate is read and written as one unit."),
    q(3, 3, "Which Node code prevents SQL injection when querying PostgreSQL?", "client.query('SELECT * FROM users WHERE email = $1', [email])", ["client.query(`SELECT * FROM users WHERE email = '${email}'`)", "client.query('SELECT * FROM users WHERE email = ' + email.trim())", "client.query(`SELECT DISTINCT * FROM users WHERE email = '${email}'`)"], "Parameterised queries send data separately from SQL, so input can't change the query."),
    q(3, 2, "Which query is a graph database such as Neo4j especially suited to?", "Find friends-of-friends within three hops", ["Sum monthly sales by region across all stores", "Store and serve large binary images and video", "Append millions of time-series sensor readings"], "Graph databases traverse relationships efficiently."),
    q(3, 1, "Which REST request replaces an entire existing item?", "PUT /items/:id", ["PATCH /items/:id", "POST /items/:id", "POST /items"], "PUT replaces the resource; PATCH partially updates it."),
    q(4, 2, "A test calls a protected endpoint without logging in. Which status should it expect?", "401 Unauthorized", ["403 Forbidden", "404 Not Found", "500 Internal Server Error"], "401 means not authenticated; 403 means authenticated but not allowed."),
    q(4, 3, "fetch() receives a response with status 500. What happens?", "It resolves; your code must check response.ok", ["It rejects, so the .catch() handler runs", "The browser retries the request up to three times", "It throws to the nearest React error boundary"], "fetch only rejects on network failure, not on HTTP error statuses."),
    q(4, 2, "Why keep the database connection string in an environment variable?", "It keeps secrets out of Git and lets each environment differ", ["Environment variables are read faster than constants in code", "Environment variables are encrypted by the operating system", "It lets the database reject connections from other apps"], "Config belongs in the environment (Twelve-Factor), never in the repository."),
    q(5, 3, "Why store passwords with bcrypt instead of SHA-256?", "bcrypt is slow and salted on purpose; SHA-256 is built for speed", ["SHA-256 can be reversed with the server's key; bcrypt cannot", "bcrypt encrypts passwords, so they can be decrypted at login", "SHA-256 output is too long to store in a typical VARCHAR column"], "bcrypt is also tunable: its cost can rise as hardware gets faster. Fast hashes let attackers test billions of guesses; slow hashes don't."),
    q(5, 3, "In the OAuth 2.0 authorization code flow, how does the app get tokens?", "Its back end swaps the code for tokens at the token endpoint", ["The browser reads tokens straight from the redirect URL's fragment", "It sends the user's password to the token endpoint for tokens", "The authorisation server emails a one-time token to the user"], "The back-channel exchange keeps tokens out of browser URLs, history and logs."),
    q(5, 3, "Why do passkeys (WebAuthn) resist phishing?", "The device signs only for the real site's origin", ["They're long random passwords that attackers can't guess", "The server stores them encrypted, so a breach reveals nothing", "Each sign-in also needs a one-time SMS code"], "The private key never leaves the device, and a fake site has a different origin, so the authenticator won't sign for it."),
    q(5, 2, "A logged-in student requests an admin-only route. The correct status is…", "403 Forbidden", ["401 Unauthorized", "404 Not Found", "302 Found"], "They're authenticated but lack permission."),
    q(5, 2, "A JSON Web Token's payload is…", "encoded but not encrypted, so anyone can read it", ["encrypted with the signing key, so only the server can read it", "hashed, so the claims can be checked but not read", "stored on the server, with only its ID sent to the client"], "The payload is only Base64URL-encoded; the signature prevents tampering, not reading. Never put secrets in a JWT payload unless you use JWE encryption."),
    q(6, 2, "In the Next.js App Router, components are by default…", "Server Components, rendered on the server", ["Client Components, hydrated in the browser on load", "static HTML pages with no React runtime", "Server Actions that run on form submit"], "Add \"use client\" to opt a component into client-side interactivity."),
    q(6, 2, "How do you mark a Next.js component as a Client Component?", "Put \"use client\" at the top of the file", ["Put \"use server\" at the top of the file", "Add export const dynamic = \"force-client\"", "Name the file page.client.tsx in the folder"], "The directive marks the client boundary for that module and its imports."),
    q(6, 2, "A useEffect with an empty dependency array runs…", "once after the first render, with its cleanup on unmount", ["after every render, with cleanup before each new run", "only when the component's props or state change", "once before the first render, so data is ready on mount"], "No dependencies means nothing triggers it again."),
    q(6, 3, "A product page changes rarely but must load fast and rank in search. Best rendering strategy?", "Static generation with periodic revalidation (ISR)", ["Client-side rendering with a loading spinner", "Streaming updates to the page over a WebSocket", "Server-side rendering on every request, with no caching"], "Pre-rendered HTML is fast and crawlable; revalidation keeps it fresh."),
    q(7, 1, "MQTT uses which communication pattern?", "Publish/subscribe through a broker", ["Request/response, the same as HTTP", "Peer-to-peer messaging between devices", "Clients polling a REST endpoint on a timer"], "Devices publish to topics; subscribers receive via the broker."),
    q(7, 3, "MQTT QoS level 1 guarantees…", "at-least-once delivery, so duplicates are possible", ["exactly-once delivery, using a four-step handshake", "at-most-once delivery, with no acknowledgement", "in-order delivery of every message across all topics"], "QoS 0 is at most once, 1 at least once, 2 exactly once."),
    q(7, 3, "Which filter subscribes to temperature in every room, for topics like home/kitchen/temperature?", "home/+/temperature", ["home/#/temperature", "home/*/temperature", "home/temperature/#"], "+ matches one level; # matches many but must be last."),
    q(7, 2, "Why is MQTT preferred over HTTP for battery-powered sensors?", "Small packet headers over one long-lived connection", ["It encrypts every message by default with no TLS cost", "Devices can send without any network connection", "It sends data over UDP, so no connection is kept"], "Less overhead means less radio time and longer battery life."),
    q(8, 3, "In ASP.NET Core, builder.Services.AddScoped<IRepo, Repo>() gives…", "one instance per HTTP request", ["one instance for the app's lifetime", "a new instance on every injection", "an instance only for Razor pages"], "Singleton is app-wide, transient is per injection, scoped is per request."),
    q(8, 3, "Why must UseAuthentication come before UseAuthorization in Program.cs?", "Middleware runs in order; authorisation needs the identity set up first", ["Order only matters for logging; both run on every request anyway", "The compiler checks the order and refuses to build otherwise", "Authorisation runs first by default, so the order you call them is ignored"], "Without an identity, every authorisation check would fail."),
    q(8, 1, "Razor (.cshtml) lets you…", "mix C# into HTML markup to render pages on the server", ["write C# that compiles to JavaScript for the browser", "run SQL queries directly from HTML in the browser", "write CSS rules as C# classes that compile to stylesheets"], "Razor is ASP.NET Core's server-side templating syntax."),
    q(9, 2, "Microsoft Graph is…", "one REST API over Microsoft 365 data such as mail and files", ["a graph database engine hosted in Azure for social data", "a charting library for Power BI and Excel dashboards", "a GraphQL server that Azure apps use to query SQL"], "One endpoint (graph.microsoft.com) covers users, mail, calendars, files and more."),
    q(9, 2, "Microsoft Entra ID (formerly Azure AD) mainly provides…", "identity and access management: sign-in and tokens for apps", ["virtual machines that host directory-aware applications", "object storage for user files and profile photos", "a content delivery network for Microsoft 365 web apps"], "Apps use Entra ID to authenticate users and get tokens for APIs like Graph."),
    q(9, 3, "A managed identity lets an Azure app…", "use other Azure resources with no secrets in its config", ["share one stored password safely across several of your apps", "skip HTTPS for traffic inside Azure's own network", "run without an Azure subscription or a billing account"], "Azure issues and rotates the identity's tokens for you, so no credentials sit in code or config."),
    q(10, 2, "Which AWS service suits hosting a static React build?", "Amazon S3, often with CloudFront", ["Amazon EBS attached to an EC2 instance", "Amazon RDS with a read replica", "AWS Lambda layers behind API Gateway"], "Static files only need object storage and a CDN."),
    q(10, 3, "Your EC2 web server works with curl from inside the instance but times out from your browser. Most likely cause?", "The security group blocks inbound port 80 or 443", ["The instance's DNS name hasn't propagated yet", "The outbound rules block the server's responses", "The S3 bucket holding the site's assets is private"], "A timeout from outside but not inside points to a firewall rule. Security groups are stateful, so replies to allowed traffic go out."),
    q(10, 2, "Why put a load balancer in front of an Auto Scaling group?", "To spread traffic and skip unhealthy instances as the group scales", ["To encrypt traffic between the instances and the database", "To give each instance its own public DNS name and address", "To launch new instances when CPU use passes a threshold"], "Health checks plus scaling give availability under varying load. Launching instances is the Auto Scaling group's job."),
    q(11, 3, "A GitHub Actions workflow needs an AWS access key. Where should it go?", "In repository secrets, read as ${{ secrets.NAME }}", ["In a .env file committed next to the workflow", "In a private branch that only admins can read", "Hard-coded in the workflow YAML as env values"], "Encrypted repository or environment secrets are masked in logs and never stored in the repository."),
    q(11, 2, "ssh refuses your key with \"UNPROTECTED PRIVATE KEY FILE\". The fix is…", "chmod 400 key.pem so only you can read it", ["chmod 777 key.pem so ssh can read it from any account", "chmod 644 key.pem so it matches public keys", "chown root key.pem so only the system owns it"], "SSH rejects private keys readable by other users."),
    q(11, 2, "Why run a Node app on Ubuntu under PM2 or systemd?", "It restarts the app after crashes and reboots", ["It compiles TypeScript to JavaScript at start-up", "It terminates TLS, so Nginx isn't needed in front", "npm needs it to install packages on Ubuntu"], "A bare `node app.js` dies with the SSH session or on any crash. PM2 and systemd also manage the app's logs."),
    q(12, 2, "Under semantic versioning, going from 2.3.1 to 3.0.0 signals…", "a breaking change", ["a backward-compatible bug fix", "a new backward-compatible feature", "documentation only"], "MAJOR.MINOR.PATCH: a major bump means incompatible API changes."),
    q(12, 2, "Before submitting, which check best confirms the deployed app works end to end?", "A smoke test of key user flows on the live URL", ["Running the unit tests locally before you push", "A clean production build on your own laptop", "A lint check with zero warnings across the repo"], "Only the deployed environment proves configuration, secrets and networking are right."),
  ],
};

// ---------------------------------------------------------------------------
// Project Management
// ---------------------------------------------------------------------------

const pm: SubjectBank = {
  match: (code, name) => byCode(code, "CSE3PM", name, /^project management$/i),
  keyTerms: [
    { term: "Triple constraint", definition: "Scope, time and cost are linked; changing one affects the others and quality." },
    { term: "Project charter", definition: "The document that formally authorises a project and the project manager's authority." },
    { term: "Work breakdown structure", definition: "A hierarchical decomposition of all project work into deliverables and work packages." },
    { term: "Work package", definition: "The lowest level of a WBS, which can be estimated, scheduled and assigned." },
    { term: "Critical path", definition: "The longest path through the network; it sets the shortest project duration." },
    { term: "Total float", definition: "How long an activity can slip without delaying the project." },
    { term: "Fast tracking", definition: "Running planned sequential activities in parallel to save time, at more risk." },
    { term: "Crashing", definition: "Adding resources to critical activities to shorten the schedule, at more cost." },
    { term: "Earned value", definition: "The budgeted value of the work actually completed." },
    { term: "CPI", definition: "Cost performance index = EV ÷ AC; below 1 means over budget." },
    { term: "SPI", definition: "Schedule performance index = EV ÷ PV; below 1 means behind schedule." },
    { term: "Risk register", definition: "A log of risks with probability, impact, owner and response." },
    { term: "Expected monetary value", definition: "Probability × impact of a risk." },
    { term: "Product Owner", definition: "The Scrum role accountable for maximising product value and ordering the backlog." },
    { term: "Sprint Retrospective", definition: "The Scrum event where the team inspects its process and plans improvements." },
    { term: "Gold plating", definition: "Adding unrequested features or extras beyond agreed scope." },
    { term: "PRINCE2", definition: "A process-based project method built on principles such as continued business justification." },
    { term: "Incident vs problem (ITIL)", definition: "Incident management restores service fast; problem management finds root causes." },
  ],
  questions: [
    q(1, 2, "A client adds features but keeps the deadline fixed. Under the triple constraint, what usually has to give?", "Cost and resources rise, or quality is put at risk", ["Nothing, as scope is independent of time and cost", "The risk register and the charter are updated instead", "The deadline extends automatically to fit the scope"], "Scope, time and cost are linked; if scope grows with time fixed, cost or quality moves."),
    q(1, 1, "Which of these is a project rather than ongoing operations?", "Moving staff email to a new cloud provider by March", ["Resetting staff passwords at the service desk each day", "Processing the weekly payroll for all university staff", "Monitoring email server uptime and fixing outages"], "Projects are temporary and produce a unique result; operations repeat."),
    q(1, 2, "Which order lists the PMBOK process groups correctly?", "Initiating, Planning, Executing, Monitoring and Controlling, Closing", ["Planning, Initiating, Executing, Monitoring and Controlling, Closing", "Initiating, Planning, Monitoring and Controlling, Executing, Closing", "Initiating, Designing, Executing, Monitoring and Controlling, Closing"], "Monitoring and Controlling runs alongside the others but is listed fourth."),
    q(2, 2, "Which project best suits a predictive (waterfall) approach?", "A bridge built to fixed, well-understood regulations", ["A startup app whose users and needs are still unclear", "A research prototype for an emerging AI technique", "A marketing site whose content and layout change every week"], "Predictive planning works when requirements are stable and change is costly."),
    q(2, 3, "A key weakness of waterfall for software is that…", "users see working software late, so wrong requirements cost more", ["it produces almost no documentation for later maintenance teams", "it can't track progress, since nothing is measured until the end", "it forces daily stand-ups and fixed two-week sprints on the team"], "Late validation means requirement mistakes are discovered after design and build, when they are expensive to fix."),
    q(3, 2, "Who is accountable for maximising product value by ordering the Product Backlog?", "The Product Owner", ["The Scrum Master", "The lead developer", "The project sponsor"], "The Scrum Guide gives backlog ordering to the Product Owner."),
    q(3, 3, "In Scrum, who decides how much work is pulled into a sprint?", "The Developers, during Sprint Planning", ["The Product Owner, when ordering the backlog", "The Scrum Master, based on past velocity", "The stakeholders, at the Sprint Review"], "The people doing the work forecast what they can complete."),
    q(3, 2, "The Sprint Retrospective's purpose is to…", "inspect how the team worked and plan improvements", ["demonstrate the increment to stakeholders for feedback", "re-estimate and re-order the whole product backlog", "review which sprint goals were missed and by whom"], "The retro inspects people, process and tools and plans improvements. Showing the increment is the Sprint Review."),
    q(3, 3, "A team completed 30, 24 and 27 story points in its last three sprints. A reasonable forecast for the next sprint is about…", "27 points", ["81 points", "30 points", "24 points"], "Average velocity (81 ÷ 3) is a forecast, not a commitment."),
    q(4, 1, "Which document formally authorises a project and the project manager's authority?", "The project charter", ["The work breakdown structure", "The risk register", "The lessons-learned report"], "The charter is issued by the sponsor at initiation."),
    q(4, 3, "A stakeholder asks a developer directly to add a feature mid-project. The correct process is…", "log a change request and assess its impact before any work starts", ["add it if it's small enough to fit in the current schedule", "refuse it, since scope is locked once the plan is signed off", "let the developer decide, since they know the effort best"], "Changes go through integrated change control. Uncontrolled changes are how scope creep happens; impacts on time, cost and quality must be assessed."),
    q(4, 2, "Which activity belongs to closing a project?", "Getting formal sign-off and recording lessons learned", ["Creating the WBS and baselining the schedule", "Holding the kick-off meeting and assigning the project team", "Validating each deliverable as it is completed"], "Closing formally ends the work and captures knowledge."),
    q(5, 3, "The WBS \"100% rule\" says…", "the WBS covers all the work in scope and nothing else", ["each work package must be under 100 hours of effort", "the whole budget is allocated to work packages up front", "each level is fully detailed before the next is started"], "Children must add up to exactly 100% of their parent's work."),
    q(5, 3, "A developer adds an unrequested animation to \"delight the client\". This is…", "gold plating", ["scope creep", "fast tracking", "value engineering"], "Gold plating is extra scope the team adds without approval; scope creep usually comes from uncontrolled requests."),
    q(5, 2, "Validate Scope is about…", "the customer formally accepting completed deliverables", ["the project team checking completed deliverables for quality", "agreeing the detailed requirements with the customer", "confirming every work package has a cost estimate"], "Control Quality checks correctness; Validate Scope gets acceptance."),
    q(6, 3, "Activities: A (3 days) then B (4 days) then D (2 days); and A then C (6 days) then D. How long is the critical path?", "11 days, via A-C-D", ["9 days, via A-B-D", "15 days, via A-B-C-D", "8 days, via C-D only"], "A-C-D = 3+6+2 = 11, longer than A-B-D = 9. B and C run in parallel, so they don't add."),
    q(6, 3, "In the same network (A3, B4, C6, D2), how much total float does B have?", "2 days", ["0 days", "4 days", "6 days"], "B's path is 9 days against 11 on the critical path."),
    q(6, 2, "Overlapping design and build that were planned in sequence, to save time, is…", "fast tracking, which adds rework risk", ["crashing, which adds resources to save time", "resource levelling, which smooths workload", "rolling wave planning, which plans in stages"], "Crashing adds resources; fast tracking runs work in parallel."),
    q(6, 2, "Resource levelling usually…", "extends the schedule to fix over-allocated people", ["shortens the critical path by adding more people", "removes float so every task becomes critical", "keeps the end date fixed by working within float"], "Delaying tasks to fit availability often lengthens the project. Keeping the end date by using float is resource smoothing."),
    q(7, 3, "PV = $50,000, EV = $40,000, AC = $45,000. What are CPI and SPI?", "CPI 0.89, SPI 0.80", ["CPI 1.13, SPI 1.25", "CPI 0.80, SPI 0.89", "CPI 0.89, SPI 1.25"], "CPI = EV/AC = 40/45 ≈ 0.89; SPI = EV/PV = 40/50 = 0.80. Both are below 1: over budget and behind schedule."),
    q(7, 3, "With EV = $40,000 and AC = $45,000, the cost variance is…", "−$5,000", ["+$5,000", "−$10,000", "+$10,000"], "CV = EV − AC; negative means over budget."),
    q(7, 2, "Quality assurance differs from quality control because QA…", "improves processes to prevent defects; QC finds them in outputs", ["inspects finished products, while QC improves the processes", "happens only after release, while QC runs during the build", "is done by the customer, while QC is done by the team"], "QA is process-focused and preventive; QC is product-focused and detective."),
    q(7, 2, "Which is a cost of conformance?", "Training staff and running code reviews", ["Rework after a release fails acceptance testing", "Warranty claims and support calls after launch", "Lost customers after a data-loss bug"], "Prevention and appraisal are costs of conformance; failure costs are non-conformance."),
    q(8, 2, "Buying insurance against a supplier failing is which risk response?", "Transfer", ["Avoid", "Mitigate", "Escalate"], "Transfer shifts the financial impact to a third party."),
    q(8, 2, "Changing the plan to drop a risky, unproven technology altogether is…", "avoid", ["transfer", "exploit", "accept"], "Avoidance removes the cause of the risk."),
    q(8, 3, "A risk has a 20% probability and a $50,000 impact. Its expected monetary value is…", "$10,000", ["$50,000", "$40,000", "$12,500"], "EMV = probability × impact = 0.2 × 50,000."),
    q(9, 2, "Six Sigma aims for a defect rate of about…", "3.4 defects per million opportunities", ["6 defects per million opportunities", "1 defect per thousand opportunities", "0.002 defects per million opportunities"], "That is the six-sigma level allowing for a 1.5 sigma long-term shift; without the shift it would be about 0.002 per million."),
    q(9, 2, "Six Sigma's DMAIC cycle stands for…", "Define, Measure, Analyse, Improve, Control", ["Design, Manage, Audit, Implement, Close", "Define, Monitor, Assess, Iterate, Complete", "Define, Measure, Analyse, Implement, Check"], "DMAIC improves an existing process with data."),
    q(9, 2, "A Pareto chart helps a team…", "focus on the few causes behind most defects", ["track defect rates over time against control limits", "find the root cause of a single defect", "show how two variables are correlated"], "The 80/20 rule: bars in descending order, plus a cumulative line, show where to act first."),
    q(9, 1, "Which is a measurable KPI for an IT service desk project?", "Average first response under 2 hours", ["Make users happier with the service desk", "Improve the quality of ticket handling", "Respond to tickets as fast as possible"], "KPIs need a measure and a target."),
    q(10, 3, "PRINCE2's principle of \"continued business justification\" means…", "the project must stay worthwhile, checked at each stage boundary", ["the business case is written once, at the end, for the project records", "the project manager approves every budget change personally", "only the first stage needs a business case to be approved"], "The project must remain viable. If the justification disappears, the project should stop."),
    q(10, 2, "The PMBOK Guide is mainly…", "a body of good practice, not a step-by-step method", ["a mandatory certification exam for project managers", "an Agile framework built on sprints and roles", "the UK government's step-by-step project method"], "PRINCE2 is the prescriptive method; PMBOK describes practices."),
    q(10, 3, "In PRINCE2, the Executive on the Project Board represents…", "the business, and owns the business case", ["the end users who will rely on the outputs", "the suppliers who build the products", "the project manager and the delivery team"], "Senior User and Senior Supplier represent the other two interests."),
    q(11, 2, "An outage takes down email for all staff. Restoring service fast, even with a workaround, is the job of…", "incident management", ["problem management", "change enablement", "availability management"], "Incidents are about restoring service; root cause comes later."),
    q(11, 2, "Finding the root cause of recurring outages is…", "problem management", ["incident management", "the service desk", "release management"], "Problem management prevents incidents from happening again."),
    q(11, 3, "A routine, pre-approved, low-risk change, such as a documented password-reset procedure, is…", "a standard change", ["an emergency change", "a normal change", "a major incident"], "Standard changes skip individual approval because the risk is understood."),
    q(11, 2, "A Service Level Agreement is…", "an agreement with the customer that sets service targets", ["an agreement between internal IT teams on support targets", "a licence setting how many users may use a service", "a contract with an outside supplier for parts of a service"], "Agreements between internal teams are OLAs; contracts with outside suppliers are underpinning contracts."),
    q(12, 3, "BAC = $100,000 and CPI = 0.8. If current performance continues, the estimate at completion is…", "$125,000", ["$80,000", "$100,000", "$120,000"], "EAC = BAC ÷ CPI = 100,000 ÷ 0.8."),
    q(12, 3, "On a power/interest grid, a stakeholder with high power and low interest should be…", "kept satisfied", ["managed closely", "kept informed", "monitored with minimal effort"], "High power with high interest is managed closely; high power with low interest is kept satisfied."),
  ],
};

// ---------------------------------------------------------------------------
// Professional Practices and Entrepreneurship in IT
// ---------------------------------------------------------------------------

const ppe: SubjectBank = {
  match: (code, name) => byCode(code, "CSE3PPE", name, /^professional practices and entrepreneurship in (information technology|it)$/i),
  keyTerms: [
    { term: "Utilitarianism", definition: "Judging actions by their consequences: the greatest overall good for those affected." },
    { term: "Deontology", definition: "Duty-based ethics: some actions are right or wrong regardless of outcomes." },
    { term: "Virtue ethics", definition: "Asking what a person of good character would do." },
    { term: "Primacy of the public interest", definition: "The ACS value that puts the public's interests above personal, employer or business interests." },
    { term: "GDPR", definition: "The EU's data protection regulation, which can apply to organisations anywhere serving or monitoring people in the EU." },
    { term: "Notifiable Data Breaches scheme", definition: "Australian rule requiring notice to individuals and the OAIC for breaches likely to cause serious harm." },
    { term: "Data minimisation", definition: "Collecting only the personal data needed for a stated purpose." },
    { term: "Algorithmic bias", definition: "Systematic unfair outcomes from an AI system, often learned from historical data." },
    { term: "Copyleft", definition: "Licensing (e.g. GPL) requiring derivative works to be shared under the same terms." },
    { term: "Permissive licence", definition: "A licence such as MIT that allows reuse, including closed-source, provided the notice is kept." },
    { term: "Business Model Canvas", definition: "A nine-block template describing how a business creates, delivers and captures value." },
    { term: "Lean Canvas", definition: "A startup adaptation of the Business Model Canvas focused on problem, solution, key metrics and unfair advantage." },
    { term: "Value proposition", definition: "Why a specific customer should choose your offer over alternatives." },
    { term: "MVP", definition: "Minimum viable product: the smallest experiment that tests a key hypothesis with real users." },
    { term: "TAM / SAM / SOM", definition: "Total, serviceable, and realistically obtainable market size." },
    { term: "LTV:CAC", definition: "Customer lifetime value relative to the cost of acquiring a customer." },
    { term: "STAR", definition: "Situation, Task, Action, Result: a structure for behavioural interview answers." },
    { term: "BATNA", definition: "Best alternative to a negotiated agreement." },
  ],
  questions: [
    q(1, 2, "What most distinguishes a profession from an ordinary occupation?", "Specialised knowledge, an ethics code and a professional body", ["Higher salaries and greater job security than other occupations", "Regular working hours set by an industry award or agreement", "A university degree in any field and several years of experience"], "Professions self-regulate around a specialised body of knowledge, an ethical code serving the public, and accountability through a professional body."),
    q(1, 1, "An intrapreneur is…", "an employee who drives new ventures inside an existing company", ["a founder who has started several companies in a row", "an investor who funds startups from inside a large company", "a contractor who sells innovation services to companies"], "Intrapreneurs innovate within a company's resources."),
    q(2, 3, "Which is the strongest sign of a problem worth solving?", "Customers already spend time or money on clumsy workarounds", ["The founder personally finds the problem frustrating", "No competitor offers a similar product yet", "A new technology makes a solution possible for the first time"], "Existing workarounds prove the pain is real and valued."),
    q(2, 3, "Disruptive innovation typically starts by…", "serving overlooked low-end or new customers with simpler products", ["winning incumbents' most profitable customers with better products", "patenting key features so incumbents can't copy them", "cutting the price of premium products to undercut the leaders"], "Christensen: disruptors start where incumbents aren't looking, with simpler, cheaper offerings, then move upmarket."),
    q(3, 3, "In customer discovery, why is \"Would you buy this?\" a weak question?", "People give polite guesses about the future, not evidence", ["It breaks consumer law to ask about buying before launch", "It reveals your pricing to competitors too early", "It biases people towards saying no to new ideas"], "Asking about past behaviour is more reliable. Commitments and past actions are evidence; compliments are not."),
    q(3, 2, "SOM, the serviceable obtainable market, is…", "the slice of your reachable market you can realistically win", ["the total demand for the product across the whole world", "the whole market your business model and channels can reach", "the combined revenue that competitors earn in your market"], "TAM is everything, SAM is what you can serve, SOM is what you can win."),
    q(3, 2, "In Lean Startup, an MVP is…", "the smallest test of a key hypothesis with real users", ["a cheaper, cut-down version of the final product for launch", "the first full release, once all core features are built", "a pitch deck that tests whether investors like the idea"], "An MVP exists to learn, not to be a small product."),
    q(4, 2, "On the Value Proposition Canvas, the customer profile lists…", "customer jobs, pains and gains", ["revenue streams, costs and channels", "key partners, resources and activities", "products, pain relievers and gain creators"], "The value map then answers with products, pain relievers and gain creators."),
    q(4, 2, "A strong value proposition focuses on…", "a specific customer's problem and the gain over alternatives", ["a complete list of the product's features and functions", "the founders' experience and why they started the company", "the technology stack and what makes it innovative"], "Value is defined relative to the customer and their alternatives, ideally as a measurable benefit."),
    q(5, 3, "Which is NOT one of the nine Business Model Canvas blocks?", "Competitive analysis", ["Key partners", "Customer relationships", "Channels"], "The nine are customer segments, value propositions, channels, customer relationships, revenue streams, key resources, key activities, key partners and cost structure."),
    q(5, 3, "Lean Canvas replaces the Business Model Canvas's Key Partners block with…", "Problem", ["Revenue", "Channels", "Unfair advantage"], "Lean Canvas swaps in Problem, Solution, Key Metrics and Unfair Advantage."),
    q(5, 3, "A SaaS startup has an LTV:CAC ratio of 3:1. This suggests…", "each customer returns about three times their acquisition cost", ["it spends three times more to win a customer than it earns", "about a third of its customers cancel each year", "it charges three times what customers think is fair"], "Around 3:1 is a common benchmark for healthy, sustainable growth."),
    q(5, 2, "A two-sided marketplace's biggest early challenge is usually…", "getting buyers and sellers on board at the same time", ["scaling the servers fast enough for early traffic", "protecting the platform's idea with patents", "setting a commission that both sides agree to"], "This is the chicken-and-egg problem: each side only comes if the other is already there."),
    q(6, 2, "What belongs on a pitch deck's traction slide?", "Paying users, growth rates or signed pilots", ["The founders' career history and past startups", "A demo of the product's most impressive features", "The product roadmap for the next three years"], "Traction proves demand with data."),
    q(6, 3, "Fixed costs are $60,000 a year, price is $50 and variable cost is $20 per unit. What is break-even volume?", "2,000 units", ["1,200 units", "3,000 units", "1,714 units"], "Break-even = fixed costs ÷ (price − variable cost) = 60,000 ÷ 30."),
    q(4, 3, "A feasibility study for a startup idea checks…", "whether it can be built, sold and run at a profit", ["whether the founders are passionate about the idea", "what the servers and hosting will cost each month", "whether the idea can be patented before launch"], "Feasibility spans technical, market and financial viability with the resources available."),
    q(6, 2, "Which order follows a typical investor pitch narrative?", "Problem, solution, market, business model, traction, team, ask", ["Team, ask, problem, traction, market, solution, business model", "Ask, solution, team, problem, business model, market, traction", "Market, team, ask, business model, problem, traction, solution"], "Investors need the problem and solution before the market, the money and the people."),
    q(8, 3, "An engineer learns their company is hiding a serious data breach from regulators. Reporting it externally after internal channels fail is…", "whistleblowing, which can be justified to protect the public", ["a breach of confidentiality that the ACS Code forbids", "industrial espionage, since it shares company secrets", "a conflict of interest that must be declared first"], "Professional codes put the public interest first; internal channels should normally be tried first."),
    q(7, 2, "A utilitarian judges whether to release a buggy medical app by…", "weighing the total good and harm for everyone affected", ["asking whether releasing it breaks a duty or rule", "asking what a developer of good character would do", "checking whether the release meets every legal requirement"], "Utilitarianism is consequence-based."),
    q(7, 2, "Refusing to falsify test results even though it would save jobs reflects…", "deontological, duty-based ethics", ["utilitarian, outcome-based ethics", "ethical egoism, based on self-interest", "cultural relativism, based on norms"], "Some duties, such as honesty, hold regardless of the outcome."),
    q(7, 3, "Under the ACS Code of Professional Conduct, what takes priority when your employer's interests conflict with public safety?", "The primacy of the public interest", ["Loyalty to your employer and its clients", "Protecting the company's reputation", "Your own professional development"], "ACS members must put the public interest above personal, business or sectional interests."),
    q(7, 1, "Asking \"What would a person of good character do here?\" is…", "virtue ethics", ["deontology", "utilitarianism", "social contract theory"], "Virtue ethics focuses on character, not rules or outcomes."),
    q(8, 3, "GDPR can apply to an Australian company when…", "it offers services to, or monitors, people in the EU", ["it stores its customers' data on servers in the EU", "it has over 250 staff and handles any personal data", "its shares are listed on a European stock exchange"], "GDPR has extraterritorial reach based on whom you target or monitor."),
    q(8, 3, "Under Australia's Notifiable Data Breaches scheme, an organisation must notify individuals and the OAIC when…", "a breach is likely to result in serious harm", ["any personal information is accessed without permission", "more than one million customer records are exposed", "attackers demand a ransom to return the stolen data"], "The test is likely serious harm, assessed promptly."),
    q(8, 2, "Collecting only the personal data a feature strictly needs is…", "data minimisation", ["purpose limitation", "pseudonymisation", "the right to erasure"], "Less data collected means less to lose in a breach."),
    q(9, 3, "A hiring model trained on past hires rejects more women because most past hires were men. This is…", "historical bias encoded in the training data", ["overfitting to random noise in the data", "automation bias in the recruiters who use it", "a coding error in the model's scoring function"], "Models reproduce the patterns, including the injustices, in their data."),
    q(9, 2, "Which is one of Australia's eight AI Ethics Principles?", "Contestability", ["Profitability", "Data sovereignty", "Efficiency"], "People affected by an AI decision should be able to challenge it."),
    q(9, 2, "Which principle requires that people can understand how an AI system reached a decision about them?", "Transparency and explainability", ["Reliability and safety", "Privacy protection and security", "Human, societal and environmental wellbeing"], "Explanations enable trust, accountability and contestation."),
    q(10, 3, "You distribute software that includes a GPL-licensed library. What obligation applies?", "Release the combined work's source code under the GPL", ["Keep the GPL notice, but your own code can stay closed", "Pay the library's authors a royalty on each copy sold", "Release the source only if you sell the software"], "GPL is copyleft: distributed derivatives must carry the same freedoms."),
    q(10, 2, "The MIT licence mainly requires you to…", "keep the copyright and licence notice", ["publish your own source code under MIT", "use it only in non-commercial projects", "credit the author on your app's home screen"], "MIT is permissive; attribution is the core condition."),
    q(10, 3, "Under Australian copyright law, output generated purely by an AI with no human creative input…", "may not be protected, as there is no human author", ["is owned by the company that built the AI model", "is owned by the AI itself as the legal author", "is protected like any other work for 70 years"], "Australian cases require a human author; the law is still developing."),
    q(11, 1, "In behavioural interviews, STAR stands for…", "Situation, Task, Action, Result", ["Skills, Training, Abilities, References", "Strengths, Talents, Achievements, Roles", "Start, Try, Assess, Repeat"], "STAR structures a concrete, evidence-based answer."),
    q(11, 2, "Which resume bullet is strongest?", "Cut API response time 40% by adding Redis caching in Node.js", ["Responsible for a wide range of backend tasks on a Node.js team", "Hard-working team player with strong Node.js and Redis skills", "Worked on various projects involving APIs, caching and databases"], "Action plus a measurable result plus the technology used."),
    q(12, 2, "In the Thomas-Kilmann model, high assertiveness combined with high cooperativeness is…", "collaborating", ["competing", "compromising", "accommodating"], "Collaborating seeks a solution that fully satisfies both sides."),
    q(12, 2, "In negotiation, BATNA stands for…", "Best Alternative To a Negotiated Agreement", ["Basic Agreement Terms for New Accounts", "Bargaining Approach To Neutral Arbitration", "Best Available Term in Negotiated Arrangement"], "Knowing your BATNA tells you when to walk away."),
    q(12, 1, "Which behaviour shows active listening?", "Paraphrasing their point and asking clarifying questions", ["Preparing your reply while they talk so the meeting moves on", "Offering a solution as soon as you understand the problem", "Sharing a similar story of your own to show you relate"], "Reflecting back confirms understanding."),
  ],
};

const BANKS: SubjectBank[] = [ui, cwa, pm, ppe];
EXTRAS.set("ui", EXTRA_UI);
EXTRAS.set("cwa", EXTRA_CWA);
EXTRAS.set("pm", EXTRA_PM);
EXTRAS.set("ppe", EXTRA_PPE);
const BANK_KEYS = new Map<SubjectBank, string>([[ui, "ui"], [cwa, "cwa"], [pm, "pm"], [ppe, "ppe"]]);

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Built-in questions and key terms for a subject, or null if none exist for it. */
export function builtInBank(code: string, name: string, subjectId: string): { keyTerms: RealmKeyTerm[]; questions: RealmQuestion[] } | null {
  const bank = BANKS.find((b) => b.match(code.trim(), name.trim()));
  if (!bank) return null;
  const questions = bank.questions.map((item, i): RealmQuestion => {
    const position = hash(item.prompt) % 4;
    const choices = [...item.wrong];
    choices.splice(position, 0, item.correct);
    return { id: `${subjectId}-b${i + 1}`, prompt: item.prompt, choices, answerIndex: position, explanation: item.explanation, week: item.week, difficulty: item.difficulty };
  });
  const extras = EXTRAS.get(BANK_KEYS.get(bank) ?? "") ?? [];
  extras.forEach((item, i) => {
    const position = hash(item.prompt) % 4;
    const choices = [...item.wrong];
    choices.splice(position, 0, item.correct);
    const question: RealmQuestion = { id: `${subjectId}-x${i + 1}`, prompt: item.prompt, choices, answerIndex: position, explanation: item.explanation, week: item.week, difficulty: item.difficulty };
    if (item.kind && item.kind !== "choice") question.kind = item.kind;
    if (item.accept?.length) question.accept = item.accept;
    if (item.tolerance !== undefined) question.tolerance = item.tolerance;
    if (item.unit) question.unit = item.unit;
    if (item.workedExample) question.workedExample = item.workedExample;
    questions.push(question);
  });
  return { keyTerms: withExtraTerms(BANK_KEYS.get(bank) ?? "", bank.keyTerms), questions };
}

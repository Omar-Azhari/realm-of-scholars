/**
 * Hand-written content for the subject workshop games. Each item is real
 * subject material, checked against standard references:
 *   - Bug Hunt: JavaScript / React / Node / SQL / HTTP behaviour.
 *   - Usability flaws: Nielsen's 10 usability heuristics.
 *   - Ethics tribunal: the six values of the ACS Code of Professional Conduct.
 * The Critical Path game (project management) is generated, see workshop.ts.
 */

export interface BugHuntItem {
  title: string;
  language: string;
  lines: string[];
  /** 0-based index of the buggy line. */
  bugLine: number;
  explanation: string;
  fix: string;
}

export const BUG_HUNT: BugHuntItem[] = [
  {
    title: "Sum the cart",
    language: "JavaScript",
    lines: ["function cartTotal(items) {", "  let total = 0;", "  for (let i = 0; i <= items.length; i++) {", "    total += items[i].price * items[i].qty;", "  }", "  return total;", "}"],
    bugLine: 2,
    explanation: "Off-by-one: with <= the loop reads items[items.length], which is undefined, so .price throws a TypeError.",
    fix: "for (let i = 0; i < items.length; i++) {",
  },
  {
    title: "Load the user",
    language: "JavaScript",
    lines: ["async function showUser(id) {", "  const res = fetch(`/api/users/${id}`);", "  const user = await res.json();", "  render(user.name);", "}"],
    bugLine: 1,
    explanation: "fetch returns a Promise. Without await, res is a Promise, which has no .json() method.",
    fix: "const res = await fetch(`/api/users/${id}`);",
  },
  {
    title: "Counter component",
    language: "React",
    lines: ["function Counter() {", "  const [count, setCount] = useState(0);", "  const add = () => {", "    count = count + 1;", "  };", "  return <button onClick={add}>{count}</button>;", "}"],
    bugLine: 3,
    explanation: "State must be changed through its setter. Assigning to count (a const) throws, and even a let would not re-render.",
    fix: "setCount((c) => c + 1);",
  },
  {
    title: "Todo list",
    language: "React",
    lines: ["function Todos({ items }) {", "  return (", "    <ul>", "      {items.map((t) => <li>{t.text}</li>)}", "    </ul>", "  );", "}"],
    bugLine: 3,
    explanation: "Each element in a rendered list needs a stable key so React can match items between renders.",
    fix: "{items.map((t) => <li key={t.id}>{t.text}</li>)}",
  },
  {
    title: "Fetch on mount",
    language: "React",
    lines: ["function Profile({ id }) {", "  const [user, setUser] = useState(null);", "  useEffect(() => {", "    getUser(id).then(setUser);", "  });", "  return <p>{user?.name}</p>;", "}"],
    bugLine: 4,
    explanation: "With no dependency array the effect runs after every render; setUser causes a render, so it fetches forever.",
    fix: "}, [id]);",
  },
  {
    title: "Express JSON body",
    language: "Node / Express",
    lines: ["const app = express();", "app.post('/api/notes', (req, res) => {", "  notes.push(req.body.text);", "  res.status(201).json({ ok: true });", "});", "app.listen(3000);"],
    bugLine: 0,
    explanation: "Express doesn't parse JSON bodies by default, so req.body is undefined. The JSON middleware must be registered first.",
    fix: "const app = express(); app.use(express.json());",
  },
  {
    title: "Log in query",
    language: "Node / SQL",
    lines: ["app.post('/login', async (req, res) => {", "  const { email } = req.body;", "  const sql = `SELECT * FROM users WHERE email = '${email}'`;", "  const [rows] = await db.query(sql);", "  res.json(rows[0] ?? null);", "});"],
    bugLine: 2,
    explanation: "Building SQL by string interpolation allows SQL injection (e.g. ' OR '1'='1). Use a parameterised query.",
    fix: "const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);",
  },
  {
    title: "Compare inputs",
    language: "JavaScript",
    lines: ["const input = document.querySelector('#age').value;", "if (input === 18) {", "  showAdultMenu();", "}"],
    bugLine: 1,
    explanation: "An input's .value is always a string, and === doesn't convert types, so '18' === 18 is false.",
    fix: "if (Number(input) === 18) {",
  },
  {
    title: "Wait for all",
    language: "JavaScript",
    lines: ["async function loadAll(ids) {", "  const users = [];", "  ids.forEach(async (id) => {", "    users.push(await getUser(id));", "  });", "  return users;", "}"],
    bugLine: 2,
    explanation: "forEach doesn't wait for async callbacks, so the function returns an empty array before any user arrives.",
    fix: "return Promise.all(ids.map((id) => getUser(id)));",
  },
  {
    title: "Not found handler",
    language: "Node / Express",
    lines: ["app.get('/api/items/:id', (req, res) => {", "  const item = items.find((i) => i.id === req.params.id);", "  if (!item) res.status(404).json({ error: 'Not found' });", "  res.json(item);", "});"],
    bugLine: 2,
    explanation: "After sending the 404 the handler keeps going and calls res.json again: \"Cannot set headers after they are sent\". It needs to return.",
    fix: "if (!item) return res.status(404).json({ error: 'Not found' });",
  },
  {
    title: "Cookie settings",
    language: "Node / Express",
    lines: ["res.cookie('session', token, {", "  httpOnly: false,", "  secure: true,", "  sameSite: 'lax',", "});"],
    bugLine: 1,
    explanation: "A session cookie readable by JavaScript can be stolen by any XSS script. Session cookies should be httpOnly.",
    fix: "httpOnly: true,",
  },
  {
    title: "Copy then change",
    language: "JavaScript",
    lines: ["function withTax(order) {", "  const copy = order;", "  copy.total = order.total * 1.1;", "  return copy;", "}"],
    bugLine: 1,
    explanation: "Assigning an object copies the reference, not the object, so the caller's order is changed too.",
    fix: "const copy = { ...order };",
  },
  {
    title: "Created status",
    language: "HTTP / Express",
    lines: ["app.post('/api/users', async (req, res) => {", "  const user = await createUser(req.body);", "  res.status(200).json(user);", "});"],
    bugLine: 2,
    explanation: "A POST that creates a resource should answer 201 Created (ideally with a Location header), not 200 OK.",
    fix: "res.status(201).location(`/api/users/${user.id}`).json(user);",
  },
];

export interface UsabilityItem {
  screen: string;
  elements: Array<{ label: string; detail: string }>;
  /** 0-based index of the element that breaks a heuristic. */
  flaw: number;
  heuristic: string;
  explanation: string;
}

export const USABILITY: UsabilityItem[] = [
  {
    screen: "File upload page",
    elements: [
      { label: "Title", detail: "\"Upload your assignment\" in large text at the top" },
      { label: "Upload button", detail: "After a click, nothing on screen changes for 40 seconds" },
      { label: "File list", detail: "Shows the name and size of each file you picked" },
      { label: "Help link", detail: "\"Accepted formats: PDF, DOCX\" shown just under the button" },
    ],
    flaw: 1,
    heuristic: "Visibility of system status",
    explanation: "Users need feedback that something is happening: a progress bar or spinner during the upload.",
  },
  {
    screen: "Shopping cart",
    elements: [
      { label: "Item rows", detail: "Each item with photo, name, price and quantity" },
      { label: "Remove item", detail: "Deletes the item straight away, with no undo" },
      { label: "Checkout button", detail: "Large, high-contrast button at the bottom right" },
      { label: "Subtotal", detail: "Updates straight away as quantities change" },
    ],
    flaw: 1,
    heuristic: "User control and freedom",
    explanation: "People remove things by mistake; they need an emergency exit such as an Undo toast.",
  },
  {
    screen: "Settings screen",
    elements: [
      { label: "Save button", detail: "Labelled \"Commit delta to persistence layer\"" },
      { label: "Profile photo", detail: "Click the photo to choose and crop a new one" },
      { label: "Email field", detail: "Pre-filled with your current email address" },
      { label: "Dark mode", detail: "A toggle switch that changes the theme at once" },
    ],
    flaw: 0,
    heuristic: "Match between the system and the real world",
    explanation: "Use the user's language, not internal jargon: \"Save changes\".",
  },
  {
    screen: "Web app with several pages",
    elements: [
      { label: "Home page", detail: "Primary button is blue, in the top right corner" },
      { label: "Profile page", detail: "Primary button is blue, in the top right corner" },
      { label: "Orders page", detail: "Primary button is a grey \"Proceed\" link, bottom left" },
      { label: "Navigation bar", detail: "Same links in the same order at the top of every page" },
    ],
    flaw: 2,
    heuristic: "Consistency and standards",
    explanation: "The same action should look and sit the same everywhere so users don't have to wonder.",
  },
  {
    screen: "Booking form",
    elements: [
      { label: "Date field", detail: "Free text; accepts \"31/02/2026\" until you submit" },
      { label: "Name field", detail: "Labelled \"Full name\" and marked as required" },
      { label: "Submit button", detail: "Clearly labelled \"Book\" at the end of the form" },
      { label: "Confirmation", detail: "Shows the booking reference and the date afterwards" },
    ],
    flaw: 0,
    heuristic: "Error prevention",
    explanation: "A date picker (or constrained input) prevents impossible dates instead of reporting them later.",
  },
  {
    screen: "Photo editor",
    elements: [
      { label: "Toolbar", detail: "Icons only, with no labels or tooltips" },
      { label: "Canvas", detail: "Shows the photo at full width" },
      { label: "Zoom", detail: "Pinch, Ctrl+scroll or the + and - buttons" },
      { label: "Export", detail: "A button labelled \"Export\" in the top bar" },
    ],
    flaw: 0,
    heuristic: "Recognition rather than recall",
    explanation: "Make options visible: labels or tooltips let users recognise tools instead of memorising them.",
  },
  {
    screen: "Email client",
    elements: [
      { label: "Compose", detail: "A Compose button plus the C keyboard shortcut" },
      { label: "Archive", detail: "Three menus deep, with no shortcut or swipe" },
      { label: "Search", detail: "A search bar at the top with recent searches" },
      { label: "Labels", detail: "Drag messages onto a label, or press L" },
    ],
    flaw: 1,
    heuristic: "Flexibility and efficiency of use",
    explanation: "Frequent actions need accelerators (shortcuts, swipes) for experienced users.",
  },
  {
    screen: "Dashboard",
    elements: [
      { label: "Header", detail: "Logo on the left, account menu on the right" },
      { label: "Main area", detail: "14 charts, 6 banners and 3 auto-playing videos" },
      { label: "Search", detail: "A search box in the top right of the header" },
      { label: "Footer", detail: "Contact, help and privacy policy links" },
    ],
    flaw: 1,
    heuristic: "Aesthetic and minimalist design",
    explanation: "Every extra element competes with the important ones; show what matters for the task.",
  },
  {
    screen: "Payment form",
    elements: [
      { label: "Card number", detail: "Accepts spaces between groups of digits" },
      { label: "Error message", detail: "\"Error 0x80070057\" when the card is declined" },
      { label: "Pay button", detail: "Shows the amount to be charged: \"Pay $42.00\"" },
      { label: "Security note", detail: "\"Payments are encrypted\" with a padlock icon" },
    ],
    flaw: 1,
    heuristic: "Help users recognise, diagnose, and recover from errors",
    explanation: "Errors should say in plain language what went wrong and how to fix it: \"Your card was declined. Try another card.\".",
  },
  {
    screen: "Tax return app",
    elements: [
      { label: "Deduction field", detail: "Nothing explains what counts as a deduction" },
      { label: "Progress", detail: "\"Step 3 of 6\" shown at the top of each page" },
      { label: "Save", detail: "Saves your answers automatically every minute" },
      { label: "Back button", detail: "Returns to the previous step with data kept" },
    ],
    flaw: 0,
    heuristic: "Help and documentation",
    explanation: "Complex tasks need help in context: a short explanation or link next to the field.",
  },
];

export const ACS_VALUES = [
  "The primacy of the public interest",
  "The enhancement of quality of life",
  "Honesty",
  "Competence",
  "Professional development",
  "Professionalism",
] as const;

export interface EthicsItem {
  scenario: string;
  /** Index into ACS_VALUES of the value most at stake. */
  value: number;
  /** Three other values offered as choices. */
  others: [number, number, number];
  explanation: string;
}

export const ETHICS: EthicsItem[] = [
  {
    scenario: "Your manager asks you to ship a medical-records system you know has an unfixed flaw that could expose patient data, to meet a launch date.",
    value: 0,
    others: [4, 2, 5],
    explanation: "The public interest (patients' safety and privacy) comes before the employer's deadline.",
  },
  {
    scenario: "A client asks if your team has built a payment gateway before. You haven't, but saying yes would win the contract.",
    value: 2,
    others: [3, 1, 4],
    explanation: "Honesty: don't misrepresent your skills, knowledge or experience to a client.",
  },
  {
    scenario: "You're asked to lead a machine-learning project, though you've never worked with ML and there's no time to learn or bring in help.",
    value: 3,
    others: [2, 0, 5],
    explanation: "Competence: accept only work you can do well, or be upfront and get the right expertise.",
  },
  {
    scenario: "Five years into your career you've stopped learning: you skip training, ignore new security practices and still use deprecated libraries.",
    value: 4,
    others: [3, 5, 1],
    explanation: "Professional development: keep your knowledge current and help others do the same.",
  },
  {
    scenario: "In a team chat you mock a colleague's code publicly and post an insulting meme about a competitor's product.",
    value: 5,
    others: [2, 0, 3],
    explanation: "Professionalism: respect colleagues and others in the industry, and protect the profession's reputation.",
  },
  {
    scenario: "Your app could cut hours of paperwork for disabled users if you add screen-reader support; leadership calls it \"nice to have\".",
    value: 1,
    others: [3, 4, 2],
    explanation: "Enhancing quality of life: consider how your work improves people's lives, including the disadvantaged.",
  },
  {
    scenario: "While testing, you discover the company quietly sells users' location data to advertisers, which the privacy policy doesn't mention.",
    value: 0,
    others: [5, 4, 3],
    explanation: "The public interest: users' rights and privacy come first; raise it through the proper channels.",
  },
  {
    scenario: "You estimate a feature at 3 weeks. Your boss wants you to tell the client \"3 days\" so they sign.",
    value: 2,
    others: [1, 4, 0],
    explanation: "Honesty: give realistic estimates and don't mislead stakeholders.",
  },
  {
    scenario: "A vendor offers you an all-expenses-paid trip if you recommend their product in a tender you're helping to evaluate.",
    value: 2,
    others: [3, 1, 4],
    explanation: "Honesty: reject bribery and anything that could compromise your judgement, and declare the conflict of interest.",
  },
  {
    scenario: "A tired junior developer keeps making avoidable mistakes; nobody mentors them and code reviews are skipped.",
    value: 4,
    others: [2, 0, 1],
    explanation: "Professional development covers helping colleagues grow, not just your own learning.",
  },
];

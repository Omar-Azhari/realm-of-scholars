/**
 * Extra PPE questions (appended after the originals in latrobeBanks.ts, ids -x1, -x2, ...).
 * Format: x(week, difficulty, prompt, correct, [three wrong], explanation, { kind, accept, tolerance, unit, workedExample }).
 * Never reorder or delete entries once shipped: ids are positional and saves remember them. Append only.
 */

import type { RealmKeyTerm } from "../../../types";
import { kt, x, type ExtraQuestion } from "./x";

export const EXTRA_PPE: ExtraQuestion[] = [
  // Week 1: professions, the ACS, entrepreneurship, startups and intrapreneurship
  x(1, 2, "Which body accredits university IT courses in Australia and publishes a Code of Ethics for IT professionals?", "The Australian Computer Society", ["Engineers Australia", "IP Australia", "The Office of the Australian Information Commissioner"], "The ACS is the professional body for IT in Australia; it also assesses skills for IT migration."),
  x(1, 3, "Which venture is a startup rather than a small business?", "A team searching for a repeatable, scalable model for clinic software", ["A local IT repair shop aiming for steady profit in one suburb", "A freelance web designer building sites for local cafes", "A family-run computer store opening a second branch next year"], "A startup is a temporary organisation searching for a repeatable, scalable business model."),
  x(1, 2, "Most IT roles in Australia aren't legally licensed. What follows for IT professionals?", "Professional identity must be built and chosen", ["Anyone in IT may ignore ethics codes without consequence", "Employers alone decide what counts as professional conduct", "Only government IT staff are bound by any code of ethics"], "With no licence to lose, honesty, quality and accountability become a personal choice and a reputation."),
  x(1, 2, "A product needs to be desirable, feasible and ____ to succeed.", "viable", ["scalable", "usable", "profitable"], "Viable means it can sustain itself financially. Technology alone creates no value.", { kind: "cloze", accept: ["viable", "financially viable"] }),
  x(1, 2, "Name the kind of entrepreneurship that puts social or environmental impact ahead of profit.", "Social entrepreneurship", ["Intrapreneurship", "Corporate social responsibility", "Lifestyle business"], "Social entrepreneurs still need a working model, but impact is the main goal.", { kind: "term", accept: ["social entrepreneurship", "social enterprise", "social entrepreneur", "social entrepreneurs"] }),
  x(1, 3, "Compared with a founder, an intrapreneur's main trade-off is…", "more resources and security, but more internal politics", ["less access to customers, but more freedom to pivot", "full ownership, but no use of the company brand", "higher personal risk, but faster approval of budgets"], "Intrapreneurs use the company's resources, brand and customers, but must win internal support."),
  x(1, 2, "Which is the best definition of entrepreneurship?", "Pursuing an opportunity under uncertainty", ["Running any business that turns a steady profit", "Inventing a new technology and patenting it", "Managing a company's existing product lines"], "Uncertainty is the defining feature; profit and invention are neither required nor enough."),

  // Week 2: opportunities, innovation and jobs to be done
  x(2, 3, "A startup builds a faster, pricier laptop aimed at the incumbents' best customers. In Christensen's terms this is…", "a sustaining strategy", ["disruptive innovation", "a low-end disruption", "a new-market disruption"], "Attacking incumbents' best customers head-on with a better product is sustaining, and incumbents usually win that fight."),
  x(2, 2, "Name the idea that customers 'hire' a product to make progress in a particular situation.", "Jobs to be done", ["Value proposition", "Product-market fit", "Design thinking"], "Jobs thinking also reveals hidden competitors such as spreadsheets or doing nothing.", { kind: "term", accept: ["jobs to be done", "jobs-to-be-done", "JTBD", "job to be done", "jobs theory"] }),
  x(2, 3, "Clinics manage bookings with spreadsheets and phone calls. For a booking startup, the spreadsheet is…", "a real competitor, as it's the current alternative", ["irrelevant, since it isn't a software product", "proof that clinics don't want booking software", "a partner the startup should integrate with first"], "Customers compare you with what they do today, including workarounds and doing nothing."),
  x(2, 2, "You can find no competitor at all for your idea. This most likely means…", "you should check the problem is real", ["you have a guaranteed first-mover advantage", "you should patent the idea before building it", "investors will value the company more highly"], "No competition can be a warning sign that nobody values a solution."),
  x(2, 2, "Peter Drucker argued that innovation…", "can be practised systematically", ["depends mainly on rare moments of genius", "comes only from new scientific knowledge", "is best left to large companies with labs"], "His sources of innovation include unexpected events, process needs, regulation and demographics."),
  x(2, 3, "A manager buys a dashboard tool partly so they look competent in front of their boss. That motive is a…", "social job", ["functional job", "emotional job", "core job"], "Jobs have functional, emotional and social dimensions. How others see you is the social one."),
  x(2, 2, "Disruptors usually start with overlooked low-end or new customers, then improve and move ____.", "upmarket", ["offshore", "downmarket", "sideways"], "Incumbents ignore the low end at first, which gives disruptors room to grow.", { kind: "cloze", accept: ["upmarket", "up market", "up-market"] }),

  // Week 3: customer discovery, market sizing and the MVP
  x(3, 3, "Your serviceable market is 8,000 clinics. You expect to win 5% within three years, at $1,200 a year each. What is your SOM in annual revenue?", "480000", ["9600000", "400", "48000"], "SOM = 8,000 × 5% = 400 clinics, × $1,200 = $480,000 a year.", { kind: "numeric", tolerance: 1, unit: "$" }),
  x(3, 2, "Government statistics on the number of small businesses are…", "secondary research", ["primary research", "customer discovery", "a bottom-up estimate"], "Secondary data already exists; primary data is what you collect yourself."),
  x(3, 3, "Which interview question best follows the Mom Test?", "How did you handle this the last time it came up?", ["Would you use an app that solved this problem for you each week?", "How much would you pay for a tool like ours?", "Do you think our idea is a good one?"], "Ask about specific past behaviour. Opinions about the future are polite guesses."),
  x(3, 2, "Name the users who feel a problem most and will try an imperfect product first.", "Early adopters", ["Beachhead market", "Laggards", "Power users"], "Start discovery with early adopters; they give the most honest signal.", { kind: "term", accept: ["early adopters", "early adopter"] }),
  x(3, 3, "Before running a landing page test, the team should first…", "decide what result would count as success", ["build the full product so the page looks real", "pick the founders' favourite feature to show", "ask friends what colours the page should use"], "Define the success signal before the test, or any result can be read as a win."),
  x(3, 2, "In Lean Startup, after building, measuring and learning, a team either perseveres or ____.", "pivots", ["persists", "scales", "exits"], "A pivot changes direction based on what was learned, while keeping what works.", { kind: "cloze", accept: ["pivots", "pivot", "pivot the idea"] }),

  // Week 4: value propositions, fit, feasibility and early planning
  x(4, 3, "A startup has $480,000 in the bank, spends $60,000 a month and earns $20,000 a month. How many months of runway does it have?", "12", ["8", "24", "6"], "Net burn = 60,000 − 20,000 = 40,000; runway = 480,000 ÷ 40,000 = 12 months.", { kind: "numeric", tolerance: 0, unit: "months", workedExample: "ppe-runway" }),
  x(4, 3, "Gross burn is $90,000 a month and revenue is $30,000 a month. Net burn is…", "$60,000 a month", ["$90,000 a month", "$120,000 a month", "$30,000 a month"], "Net burn = spending − revenue. Runway is based on net burn.", { workedExample: "ppe-runway" }),
  x(4, 2, "Fit develops in stages: fit on paper, problem-solution fit, then ____ fit.", "product-market", ["customer-segment", "channel-market", "solution-price"], "Product-market fit means customers actually use and pay for the product.", { kind: "cloze", accept: ["product-market", "product market", "product/market"] }),
  x(4, 2, "In the value map, a backup feature that removes a customer's fear of losing data is a…", "pain reliever", ["gain creator", "customer job", "key resource"], "Pain relievers remove obstacles and risks; gain creators produce desired outcomes."),
  x(4, 3, "Clinics love the prototype and the team can build it, but each sale costs more to deliver than clinics will pay. Which check fails?", "Financial feasibility", ["Technical feasibility", "Market feasibility", "Legal feasibility"], "Built, sold, run: this idea can be built and sold, but not run at a profit."),
  x(4, 2, "Name the narrow first customer segment a startup aims to win before expanding.", "Beachhead", ["Early majority", "Total addressable market", "Persona"], "A narrow beachhead lets a small team win clearly, then expand.", { kind: "term", accept: ["beachhead", "beachhead market", "beachhead customer", "beachhead segment"] }),

  // Week 5: business models, SaaS metrics, platforms, valuation and dilution
  x(5, 3, "A tool earns $50 a month per customer at an 80% gross margin, with 4% monthly churn. What is the customer lifetime value (LTV)?", "1000", ["1250", "2000", "40"], "Gross profit = 50 × 0.8 = $40 a month; lifetime = 1 ÷ 0.04 = 25 months; LTV = 40 × 25 = $1,000.", { kind: "numeric", tolerance: 1, unit: "$", workedExample: "ppe-ltv-cac" }),
  x(5, 3, "A startup spent $24,000 on sales and marketing last quarter and won 60 new customers. What is its CAC?", "400", ["1440000", "40", "4000"], "CAC = acquisition spend ÷ new customers = 24,000 ÷ 60 = $400.", { kind: "numeric", tolerance: 0, unit: "$", workedExample: "ppe-ltv-cac" }),
  x(5, 3, "An investor puts in $2 million at a $6 million pre-money valuation. What share does the investor now own?", "25%", ["33.3%", "20%", "30%"], "Post-money = 6 + 2 = $8 million; ownership = 2 ÷ 8 = 25%."),
  x(5, 2, "Name the rate at which subscribers cancel, usually measured monthly.", "Churn", ["Burn rate", "Attrition cost", "CAC"], "High churn is a leaking bucket: new customers just replace lost ones.", { kind: "term", accept: ["churn", "churn rate", "customer churn", "monthly churn"] }),
  x(5, 3, "In the Lean Canvas, which block replaces the Business Model Canvas's Customer Relationships?", "Unfair advantage", ["Key metrics", "Unique value proposition", "Solution"], "Key partners becomes problem, key activities becomes solution, key resources becomes key metrics."),

  // Week 6: business plans, projections, break-even and pitching
  x(6, 3, "Fixed costs are $84,000 a year. Each subscription sells for $60 and costs $18 to serve. How many subscriptions break even?", "2000", ["1400", "4667", "1000"], "Contribution margin = 60 − 18 = $42; break-even = 84,000 ÷ 42 = 2,000.", { kind: "numeric", tolerance: 0, unit: "subscriptions", workedExample: "ppe-break-even" }),
  x(6, 3, "With the same figures (fixed costs $84,000, price $60, variable cost $18), what is the break-even revenue?", "120000", ["84000", "36000", "100800"], "Break-even revenue = 2,000 units × $60 = $120,000.", { kind: "numeric", tolerance: 1, unit: "$", workedExample: "ppe-break-even" }),
  x(6, 3, "A tool costs $50,000 now and returns $30,000 at the end of each of the next two years. At a 10% discount rate, what is the NPV to the nearest dollar?", "2066", ["10000", "4545", "-2066"], "PV = 30,000 ÷ 1.1 + 30,000 ÷ 1.21 = 27,273 + 24,793 = 52,066, minus 50,000 = $2,066.", { kind: "numeric", tolerance: 2, unit: "$", workedExample: "ppe-npv" }),
  x(6, 3, "A $40,000 project produces $50,000 in benefits. What is its ROI?", "25", ["125", "80", "20"], "ROI = (benefit − cost) ÷ cost = 10,000 ÷ 40,000 = 25%.", { kind: "numeric", tolerance: 0.1, unit: "%" }),
  x(6, 2, "The executive summary of a business plan should be…", "written last, and able to stand alone", ["written first, to guide the rest of the plan", "a list of founder bios", "a short version of the detailed financial model"], "Many readers only read the summary, so it must make the whole case."),
  x(6, 3, "An investor asks something you can't answer during your pitch. The best response is…", "say you don't know, then follow up", ["give your best guess confidently so you look prepared", "move on and come back to it if time allows", "point them to the appendix and hope it covers it"], "Honesty builds trust; a confident wrong answer destroys it."),

  // Week 7: the ACS Code of Ethics, accountability and ethical theories
  x(7, 2, "Name the ACS value that asks you to keep enhancing your own knowledge and support your colleagues' development.", "Professional development", ["Competence", "Professionalism", "The enhancement of quality of life"], "The six values: public interest, quality of life, honesty, competence, professional development and professionalism.", { kind: "term", accept: ["professional development"] }),
  x(7, 3, "A developer takes a contract for medical device firmware with no embedded experience and doesn't mention it. Which ACS value is most directly breached?", "Competence", ["Professional development", "The enhancement of quality of life", "Professionalism"], "Competence means not taking on work beyond your abilities without saying so."),
  x(7, 2, "Name the problem where so many people contributed to a system that nobody feels responsible when it fails.", "Problem of many hands", ["Diffusion of innovation", "Groupthink", "Automation bias"], "If you wrote it, approved it, or stayed silent about a worry, you share responsibility.", { kind: "term", accept: ["problem of many hands", "the problem of many hands", "many hands"] }),
  x(7, 3, "Robodebt raised debts using automated income averaging. What is the clearest professional lesson?", "Technical design choices are ethical choices", ["Automation should never be used in government", "Averaging is always an invalid statistical method", "Only lawyers are accountable for system outcomes"], "A design shortcut became unlawful debts for real people."),
  x(7, 3, "Kant said never treat people merely as a means to an end. Which practice breaks this most clearly?", "Secretly using customers as test subjects", ["Charging customers for a premium tier", "Collecting feedback through optional surveys", "Paying staff a bonus for meeting targets"], "Using people without their knowledge treats them only as tools for your goal."),
  x(7, 2, "The publicity test asks…", "would you be comfortable if your decision were made public?", ["has the decision been approved by the legal team?", "would the decision increase the company's publicity?", "has the decision been announced to every stakeholder?"], "A decision you'd hide from the public is a warning sign."),

  // Week 8: privacy law, data breaches, spam, surveillance and dark patterns
  x(8, 3, "Under the Notifiable Data Breaches scheme, an organisation suspects a breach but isn't sure. It must…", "assess it promptly, within 30 days", ["notify the OAIC within 72 hours regardless", "wait until harm to someone is confirmed", "notify only if over 500 records were involved"], "Seventy-two hours is a GDPR rule. In Australia, the test is likely serious harm, assessed within 30 days."),
  x(8, 2, "Name the design tricks that push users into choices they didn't intend, such as pre-ticked boxes or hard cancellation.", "Dark patterns", ["Nudges", "Growth hacks", "Confirmshaming"], "Dark patterns undermine autonomy and genuine consent.", { kind: "term", accept: ["dark patterns", "dark pattern", "deceptive patterns", "deceptive design"] }),
  x(8, 3, "Under Australia's Spam Act 2003, a commercial email needs…", "consent, a named sender and an unsubscribe option", ["to be sent only between 9 am and 5 pm on weekdays", "to be registered with the OAIC before it is sent", "the recipient's full name and their postal address"], "Consent, identification and a working unsubscribe are the three core rules."),
  x(8, 3, "A device ID linked to location history, with no name attached, is…", "likely personal information, as it can identify someone", ["not personal information, since no name is stored", "only personal information under the GDPR, not the Privacy Act", "sensitive information that can never be collected"], "Personal information covers a reasonably identifiable individual, not just a named one."),
  x(8, 2, "The Privacy Act exempts most small businesses with turnover of $3 million or less, but not…", "health service providers", ["online retailers", "software startups", "hospitality venues"], "Health service providers are covered whatever their size."),
  x(8, 2, "False content spread deliberately to deceive is…", "disinformation", ["misinformation", "a deepfake", "satire"], "Misinformation is false but unintentional; disinformation is deliberate."),

  // Week 9: AI bias, fairness, transparency and regulation
  x(9, 3, "A screening model shortlists 60 of 200 applicants from group A and 30 of 150 from group B. What is group B's selection rate divided by group A's?", "0.67", ["0.5", "1.5", "0.75"], "Group A: 60 ÷ 200 = 0.30. Group B: 30 ÷ 150 = 0.20. Ratio = 0.20 ÷ 0.30 ≈ 0.67, a gap worth investigating.", { kind: "numeric", tolerance: 0.01 }),
  x(9, 2, "Name the tendency to over-trust a machine's decision, even when it's wrong.", "Automation bias", ["Confirmation bias", "Historical bias", "Anchoring"], "Human oversight only works if people are willing to question the system.", { kind: "term", accept: ["automation bias"] }),
  x(9, 3, "A model drops the gender column but still disadvantages women, because it uses hobbies and postcode. This shows…", "proxies can carry a removed attribute", ["the model is overfitting to random noise", "gender data should be collected more often", "the training set is too large to be fair"], "Removing a sensitive attribute doesn't remove the features that correlate with it."),
  x(9, 3, "Under the EU AI Act's risk tiers, an AI system that screens job applicants is generally treated as…", "high risk, so heavily regulated", ["unacceptable risk, so banned", "limited risk, so only transparency rules apply", "minimal risk, so not regulated"], "Employment and recruitment uses are listed as high risk."),
  x(9, 2, "A face recognition model works poorly on darker skin because few such faces were in its training data. This is…", "representation bias", ["historical bias", "measurement bias in the labels", "automation bias"], "Under-represented groups get worse performance. Historical bias copies past injustice instead."),
  x(9, 2, "Before deploying AI that handles personal information, run a privacy ____ assessment.", "impact", ["risk", "threat", "compliance"], "A privacy impact assessment checks collection, use, accuracy and security before launch.", { kind: "cloze", accept: ["impact"] }),

  // Week 10: copyright, open-source licences and other IP
  x(10, 3, "An Apache 2.0 library is added to a GPLv2-only project. This is…", "incompatible, as Apache 2.0 suits GPLv3", ["fine, since both are open-source licences", "fine, if the Apache NOTICE file is kept", "incompatible, since Apache 2.0 is copyleft"], "Apache 2.0 code can go into GPLv3 projects, but not GPLv2-only ones."),
  x(10, 2, "Name the licence that, unlike the GPL, also requires the source to be offered when modified software is used over a network.", "AGPL", ["LGPL", "MPL", "Apache 2.0"], "The AGPL closes the 'software as a service' gap in the GPL.", { kind: "term", accept: ["AGPL", "GNU AGPL", "Affero GPL", "AGPLv3", "Affero General Public License", "Affero General Public Licence"] }),
  x(10, 3, "Your closed-source app links to an LGPL library, which you have modified. What must you share?", "Your changes to the library", ["Your app's source code", "Nothing, since the LGPL is permissive", "Only the library's original licence file"], "The LGPL lets proprietary code link to the library, but changes to the library itself must be shared."),
  x(10, 3, "A startup wants to stop rivals using its product name and logo. The right protection is…", "a registered trade mark", ["copyright in the logo artwork", "a standard patent", "a registered design"], "Trade marks protect brand identifiers; patents protect inventions; designs protect appearance."),
  x(10, 2, "In Australia, code you write is protected as a literary work automatically, with no registration. This protection is…", "copyright", ["a patent", "a trade mark", "a registered design"], "Copyright protects expression, not ideas. Patents, trade marks and designs need registration."),
  x(10, 3, "A contractor builds your app with no written agreement on IP. In Australia, who generally owns the copyright in the code?", "The contractor, unless it's assigned in writing", ["Your company, because it paid for the work", "Both parties equally, as joint authors", "Nobody, since commissioned code has no copyright"], "Employers usually own employees' work, but contractors keep copyright unless a written assignment says otherwise."),
  x(10, 2, "The most reliable way to track every dependency's licence in a large codebase is…", "a software bill of materials", ["a README listing the main libraries", "the package manager's lock file alone", "asking developers before each release"], "An SBOM lists every component and its licence, so compliance can be checked."),

  // Week 11: resumes, cover letters, networking, interviews and contracts
  x(11, 2, "In the SCAR interview structure, the C stands for ____ or challenge.", "complication", ["context", "conflict", "consideration"], "SCAR suits questions about obstacles, failures and difficult situations.", { kind: "cloze", accept: ["complication", "complications"] }),
  x(11, 2, "Name the career profile that is deep in one area and broad across many others.", "T-shaped", ["I-shaped", "Pi-shaped", "Generalist"], "Depth gets you hired; breadth lets you work well with other specialists.", { kind: "term", accept: ["T-shaped", "T shaped", "T-shape", "T shape"] }),
  x(11, 3, "In a STAR answer, where should you spend most of your time?", "Action: what you personally did", ["Situation: the full project background", "Task: the team's goals and deadlines", "Result: the company's overall outcomes"], "Interviewers assess your behaviour, so say 'I', not 'we'."),
  x(11, 2, "A strong cover letter mainly answers…", "why this role, why here, and why you", ["what each job on your resume involved, in order", "what salary and conditions you are hoping for", "which other companies you are applying to"], "Match two or three key requirements with evidence; don't repeat the resume."),
  x(11, 3, "An informational interview is…", "a chat to learn about a role, not to ask for a job", ["a screening call from a recruiter about a vacancy", "a group interview where candidates solve a case together", "a formal test of your technical knowledge for a job"], "It builds a genuine relationship and teaches you about the field."),
  x(11, 2, "Behavioural questions such as \"Tell me about a time when…\" assume that…", "past behaviour predicts future behaviour", ["candidates should describe ideal scenarios", "technical skill matters more than conduct", "the interviewer already knows the answer"], "That is why concrete, true stories beat hypothetical answers."),
  x(11, 3, "A graduate accepts a job offer by email. Besides offer and acceptance, which element makes it a binding contract?", "Consideration, such as pay for work", ["A witness to both signatures", "Registration with the Fair Work Commission", "A probation period of six months"], "A contract needs offer, acceptance, consideration and an intention to create legal relations."),

  // Week 12: communication, negotiation, conflict, decisions and teamwork
  x(12, 2, "In Tuckman's model, the stage where conflict surfaces over roles and approach is…", "storming", ["forming", "norming", "performing"], "Teams move through forming, storming, norming, performing and adjourning."),
  x(12, 3, "A teammate wants to ship with a known security flaw to hit a date. Which Thomas-Kilmann style is justified?", "Competing", ["Accommodating", "Avoiding", "Compromising"], "Compete only on emergencies or ethical and safety lines; this is one."),
  x(12, 3, "A client insists on \"a native iPhone app\". Asking why reveals field staff need offline access. This is…", "focusing on interests, not positions", ["anchoring the negotiation early", "improving your BATNA", "using objective criteria to settle the price"], "Positions are what people ask for; interests are why. Interests open up better options."),
  x(12, 2, "Name the range between the two parties' walk-away points, where a deal is possible.", "ZOPA", ["BATNA", "Anchor", "Reservation point"], "If the walk-away points don't overlap, there is no ZOPA and no deal.", { kind: "term", accept: ["ZOPA", "zone of possible agreement"] }),
  x(12, 2, "On the Eisenhower matrix, important but not urgent tasks should be…", "scheduled", ["done now", "delegated", "dropped"], "Do urgent and important; schedule important; delegate urgent; drop the rest."),
  x(12, 3, "In a high-context culture, a colleague says \"That could be difficult.\" The safest reading is…", "they may mean no, so check gently", ["they agree but expect extra time", "they want you to escalate to their manager", "they need written instructions first"], "High-context cultures imply meaning; silence or softening doesn't always mean agreement."),
  x(12, 2, "Psychological safety in a team means…", "people can raise mistakes and concerns without fear", ["no one is ever criticised for their work", "the team avoids conflict to keep harmony", "managers check in on everyone's wellbeing daily"], "It lets problems surface early, while they are cheap to fix."),
];

/**
 * Extra PPE key terms, tagged by teaching week (merged after the bank's original 18 terms, deduplicated by term).
 * Format: kt(week, term, definition). One clear sentence, Australian English, no em dashes.
 */
export const EXTRA_PPE_TERMS: RealmKeyTerm[] = [
  // Week 1: foundations
  kt(1, "Profession", "An occupation built on specialised knowledge, an ethical code serving the public and a professional body that holds members accountable."),
  kt(1, "Australian Computer Society", "The professional body for IT in Australia, which accredits courses, certifies practitioners and publishes codes of ethics and conduct."),
  kt(1, "Entrepreneurship", "Pursuing an opportunity under uncertainty."),
  kt(1, "Startup", "A temporary organisation searching for a repeatable, scalable business model."),
  kt(1, "Intrapreneur", "An employee who drives entrepreneurial innovation inside an existing organisation."),
  kt(1, "Social entrepreneurship", "Entrepreneurship that puts social or environmental impact ahead of profit."),
  kt(1, "Desirable, feasible, viable", "The three tests of a product idea: people want it, the team can build it, and it can sustain itself financially."),

  // Week 2: opportunity and innovation
  kt(2, "Opportunity", "An idea tied to a real, valued problem for identifiable customers."),
  kt(2, "Sustaining innovation", "Making better products for an incumbent's existing customers, often through incremental improvements."),
  kt(2, "Disruptive innovation", "Starting with simpler, cheaper offerings for overlooked low-end or new markets, then improving and moving upmarket."),
  kt(2, "Jobs to be done", "The idea that customers hire a product to make progress on a job in their lives, with functional, emotional and social sides."),
  kt(2, "Current alternative", "Whatever customers use today, including spreadsheets, workarounds or doing nothing, which is a real competitor."),

  // Week 3: market and customer discovery
  kt(3, "Customer discovery", "Testing the assumptions about customers, pain, price and reach before investing heavily in building."),
  kt(3, "Secondary research", "Existing data collected by others, such as government statistics and industry reports, unlike primary research you collect yourself."),
  kt(3, "Mom Test", "Interview rules for customer discovery: talk about their life, not your idea, and ask about specific past behaviour rather than future opinions."),
  kt(3, "Early adopters", "The customers who feel a problem most and will try an imperfect product first."),
  kt(3, "Pivot", "A change of strategy after the build, measure, learn loop shows a key hypothesis was wrong."),

  // Week 4: planning and value propositions
  kt(4, "Value Proposition Canvas", "A tool pairing a customer profile of jobs, pains and gains with a value map of products, pain relievers and gain creators."),
  kt(4, "Pain reliever", "A part of the offer that removes or reduces a specific customer pain."),
  kt(4, "Product-market fit", "The final stage of fit, after fit on paper and problem-solution fit, where customers in a real market want and pay for the offer."),
  kt(4, "Feasibility study", "A check of whether an idea can be built, sold and run profitably with the resources available."),
  kt(4, "Beachhead", "The narrow first customer segment a startup aims to win before expanding."),
  kt(4, "Runway", "How many months a startup can operate before its cash runs out: cash in the bank divided by monthly net burn."),

  // Week 5: business models
  kt(5, "Churn", "The rate at which customers or revenue leave, usually measured monthly."),
  kt(5, "CAC", "Customer acquisition cost: sales and marketing spend divided by the number of new customers won."),
  kt(5, "LTV", "Customer lifetime value: the gross profit expected from one customer over the whole relationship, roughly monthly gross profit ÷ monthly churn."),
  kt(5, "Post-money valuation", "The pre-money valuation plus the new investment, so the investor's share is the investment ÷ post-money."),

  // Week 6: plan and pitch
  kt(6, "Executive summary", "The business plan's opening overview, written last and able to stand alone."),
  kt(6, "Contribution margin", "Price minus variable cost per unit: what each sale contributes towards fixed costs."),
  kt(6, "Break-even point", "The volume at which revenue covers all costs: fixed costs ÷ contribution margin per unit."),
  kt(6, "Traction", "Evidence of demand, such as paying users, growth rates and signed pilots."),
  kt(6, "ROI", "Return on investment: (benefit − cost) ÷ cost, shown as a percentage."),

  // Week 7: ethics in IT
  kt(7, "ACS Code of Ethics", "The ACS's six values: the primacy of the public interest, the enhancement of quality of life, honesty, competence, professional development and professionalism."),
  kt(7, "Competence", "The ACS value of working only within your expertise and being honest about its limits."),
  kt(7, "Problem of many hands", "When so many people contribute to a system that nobody feels responsible when it fails."),
  kt(7, "Publicity test", "Asking whether you would be comfortable if your decision were made public."),

  // Week 8: privacy, surveillance and manipulation
  kt(8, "Privacy Act 1988", "Australia's main privacy law, regulated by the OAIC, whose 13 Australian Privacy Principles cover agencies and most organisations with turnover above $3 million."),
  kt(8, "Personal information", "Information or an opinion about an identified or reasonably identifiable individual."),
  kt(8, "Dark pattern", "A design that tricks or pressures users into doing something they didn't intend, such as pre-ticked boxes or hard cancellation."),
  kt(8, "Disinformation", "False content spread deliberately to deceive, unlike misinformation, which is spread without intent."),
  kt(8, "Whistleblowing", "Reporting serious wrongdoing to protect the public, ideally after internal channels have been tried."),

  // Week 9: AI ethics and governance
  kt(9, "Automation bias", "Trusting a machine's decision more than it deserves because it seems objective."),
  kt(9, "Historical bias", "Bias that arises when a model learns past injustices from its training data."),
  kt(9, "Representation bias", "Worse model performance for groups that are under-represented in the training data."),
  kt(9, "Contestability", "The principle that people can challenge an AI decision about them and get timely human review."),
  kt(9, "EU AI Act", "The EU's risk-based AI law, which bans unacceptable-risk uses and heavily regulates high-risk ones such as screening job applicants."),

  // Week 10: open source and licensing
  kt(10, "Copyright", "Automatic protection for the expression of ideas, such as code, but not the ideas themselves."),
  kt(10, "LGPL", "A weaker copyleft licence that lets proprietary code link to the library, but changes to the library itself must be shared."),
  kt(10, "AGPL", "A copyleft licence that also requires source to be offered when modified software is used by others over a network."),
  kt(10, "Apache 2.0", "A permissive licence that adds an explicit patent grant and is compatible with GPLv3 but not GPLv2."),
  kt(10, "Software bill of materials", "An inventory of every dependency in a codebase and its licence."),

  // Week 11: career readiness
  kt(11, "SCAR", "Situation, Complication or Challenge, Action, Result: a structure for answers about obstacles and failures."),
  kt(11, "Behavioural interview", "An interview built on tell-me-about-a-time questions, on the assumption that past behaviour predicts future behaviour."),
  kt(11, "T-shaped professional", "Someone with deep expertise in one area and broad understanding across many others."),
  kt(11, "Informational interview", "A conversation to learn about a role or field, not to ask for a job."),
  kt(11, "Consideration", "Something of value exchanged, such as pay for work, that helps make an agreement a binding contract."),

  // Week 12: communication, decisions and conflict
  kt(12, "Active listening", "Concentrating fully, then paraphrasing, clarifying and summarising to show you understood."),
  kt(12, "Interests versus positions", "Positions are what each side says it wants and interests are why it wants them, and deals come from focusing on interests."),
  kt(12, "ZOPA", "The zone of possible agreement: the range between the two parties' walk-away points where a deal can be made."),
  kt(12, "Thomas-Kilmann model", "Five conflict styles placed on assertiveness and cooperativeness: competing, accommodating, avoiding, collaborating and compromising."),
  kt(12, "Eisenhower matrix", "A grid of urgent versus important that sorts tasks into do, schedule, delegate or drop."),
  kt(12, "Psychological safety", "A shared belief that people can raise mistakes and concerns without fear."),
];

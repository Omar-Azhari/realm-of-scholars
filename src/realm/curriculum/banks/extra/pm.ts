/**
 * Extra PM questions (appended after the originals in latrobeBanks.ts, ids -x1, -x2, ...).
 * Format: x(week, difficulty, prompt, correct, [three wrong], explanation, { kind, accept, tolerance, unit, workedExample }).
 * Never reorder or delete entries once shipped: ids are positional and saves remember them. Append only.
 */

import type { RealmKeyTerm } from "../../../types";
import { kt, x, type ExtraQuestion } from "./x";

export const EXTRA_PM: ExtraQuestion[] = [
  // Week 1: projects, process groups, the project manager, stakeholders, the triple constraint
  x(1, 2, "Name the idea that a project's plans and details are refined step by step as more becomes known.", "Progressive elaboration", ["Rolling wave planning", "Scope decomposition", "Iterative baseline refinement"], "Projects are temporary, unique and progressively elaborated: a vague goal becomes requirements, then a detailed design.", { kind: "term", accept: ["progressive elaboration", "progressively elaborated", "progressive-elaboration"] }),
  x(1, 2, "The sponsor wants two weeks cut from the schedule with no change to scope. What should the project manager do first?", "Show the cost or quality impact so the sponsor can choose", ["Agree, and ask the team to work faster on the same budget", "Refuse, since an approved schedule can never be shortened", "Quietly drop low-priority features to protect the new date"], "Time, cost and scope are linked. The project manager makes the trade-off visible; the sponsor decides."),
  x(1, 2, "The person who funds the project, champions it and authorises the charter is the…", "sponsor", ["project manager", "Product Owner", "client"], "The sponsor funds and authorises; the project manager runs the work day to day."),
  x(1, 2, "On the power and interest grid, a stakeholder with low power but high interest should be…", "kept informed", ["kept satisfied", "managed closely", "monitored"], "Low power with high interest: keep them informed. High power with low interest: keep them satisfied."),
  x(1, 3, "A help desk will replace its ticketing tool by June, then keep supporting students with it. Which part is the project?", "Selecting, configuring and rolling out the new tool", ["Answering student tickets with the new tool after June", "Running the help desk every day before and after June", "All of it, since everything the help desk does is a project"], "The rollout has a planned end and a unique result. Daily support afterwards is operations."),
  x(1, 3, "Why do IT projects so often surprise their managers late in the schedule?", "Software progress is hard to see until it runs", ["IT projects rarely have budgets or written schedules", "Developers can't estimate work in any reliable unit", "Most IT work is really operations that never finishes"], "Half-built software looks finished on paper. Requirements also shift once users see working results."),

  // Week 2: predictive, iterative, incremental, adaptive and hybrid approaches
  x(2, 2, "A team ships basic bookings, then payments, then reporting, and each piece is usable on release. This is mainly…", "incremental delivery", ["iterative delivery", "predictive delivery", "rolling wave delivery"], "Incremental delivery adds usable pieces of functionality over time."),
  x(2, 3, "A team rebuilds the same search page three times, refining it after each round of user tests. This is mainly…", "iterative development", ["incremental development", "predictive development", "big-bang delivery"], "Iterative work refines the same solution through repeated cycles; incremental work adds new pieces."),
  x(2, 2, "In an adaptive (Agile) approach with fixed-length sprints, which constraint normally flexes?", "Scope", ["Time", "Cost", "Team size"], "Agile usually fixes time and cost through time-boxes and a stable team, and lets scope flex."),
  x(2, 2, "A bank keeps stage gates and a fixed annual budget, but its teams deliver the software in sprints. This is…", "a hybrid approach", ["a predictive approach", "pure Scrum", "the spiral model"], "Hybrid approaches mix predictive governance with adaptive delivery, common in regulated organisations."),
  x(2, 3, "Which factor argues most strongly AGAINST using Agile on a project?", "The client can only meet the team at the start and the end", ["Requirements will change as users try early versions", "The product can be split into small, useful pieces", "The technology is new and the team expects surprises"], "Agile depends on an engaged, available customer to give feedback every iteration."),
  x(2, 2, "Waterfall's main strengths are…", "predictability, fixed budgets and clear documentation", ["fast feedback from users on working software", "easy handling of requirements that change mid-build", "self-organising teams that set their own scope each week"], "Predictive planning suits stable requirements where change is costly."),
  x(2, 2, "In a predictive project, each phase ends with a formal ____ before the next phase begins.", "sign-off", ["retrospective", "sprint review", "audit"], "Waterfall moves through sequential phases with approval at each gate.", { kind: "cloze", accept: ["sign off", "signoff", "approval", "phase gate", "gate review", "stage gate", "sign-off"] }),

  // Week 3: Agile Manifesto, Scrum accountabilities, events, artefacts, user stories, velocity
  x(3, 2, "Which Agile Manifesto value is stated correctly?", "Responding to change over following a plan", ["Following a plan over responding to change", "Comprehensive documentation over working software", "Contract negotiation over customer collaboration"], "The other values: individuals and interactions over processes and tools; working software over documentation; customer collaboration over contract negotiation."),
  x(3, 3, "A team has 240 story points left and an average velocity of 30 points per sprint. How many more sprints should it forecast?", "8", ["7", "9", "10"], "Sprints = remaining points ÷ velocity = 240 ÷ 30 = 8. A forecast, not a promise.", { kind: "numeric", tolerance: 0, unit: "sprints" }),
  x(3, 2, "Name the shared standard an increment must meet before any work in it counts as complete.", "Definition of Done", ["Acceptance criteria", "Sprint Goal", "Product Goal"], "The Increment is committed to the Definition of Done. Work that doesn't meet it isn't done.", { kind: "term", accept: ["definition of done", "DoD", "the definition of done"] }),
  x(3, 3, "Mid-sprint, a stakeholder asks for an urgent new story that would put the Sprint Goal at risk. The best response is…", "add it to the Product Backlog for the PO to order", ["add it now, since stakeholders outrank the sprint plan", "let the Scrum Master decide whether it fits capacity", "swap it for the biggest story so points stay the same"], "No changes that endanger the Sprint Goal are made during the sprint. The Product Owner orders new work."),
  x(3, 2, "INVEST says a good user story is independent, negotiable, valuable, estimable, small and…", "testable", ["traceable", "timeboxed", "timely"], "Testable stories have acceptance criteria that show when they are done."),

  // Week 4: charter, plan and baselines, directing and monitoring, change control, closing
  x(4, 2, "Who usually issues the project charter, and when?", "The sponsor, during initiating", ["The project manager, during planning", "The change control board, at kick-off", "The Product Owner, at Sprint Planning"], "The charter formally authorises the project and names the project manager."),
  x(4, 2, "The approved scope, schedule and cost plans that performance is measured against are the…", "baselines", ["forecasts", "benchmarks", "work packages"], "Baselines change only through formal change control."),
  x(4, 3, "A delivered module fails its acceptance test, and the team fixes it to meet the agreed spec. This is…", "defect repair", ["corrective action", "preventive action", "a scope change"], "Defect repair fixes a nonconforming product. Corrective action brings the work back in line with the plan."),
  x(4, 3, "The change control board approves a change request. What should happen next?", "Update the affected baselines and plans, then do the work", ["Start the work at once and update the plans at closing", "Ask the sponsor to sign a brand new project charter first", "Log it in the issue log and wait for the next phase"], "Only approved changes are built, and the baselines are updated so performance is measured fairly."),
  x(4, 3, "A new booking system costs $90,000 and saves $30,000 a year. What is its simple payback period?", "3", ["2.5", "4", "0.33"], "Payback = investment ÷ annual saving = 90,000 ÷ 30,000 = 3 years.", { kind: "numeric", tolerance: 0.01, unit: "years" }),
  x(4, 2, "In an Agile project, what plays the role a charter plays in a predictive one?", "A product vision and Product Goal", ["The Sprint Backlog for sprint one", "The Definition of Done", "The first Sprint Retrospective's notes"], "The vision and goal give direction and authority; the Product Backlog absorbs change."),
  x(4, 2, "Which closing activity most helps the organisation's future projects?", "Recording lessons learned", ["Releasing the team to new work", "Paying the final supplier invoices", "Holding a celebration for the team"], "Lessons learned carry knowledge forward; the other steps only wrap up this project."),

  // Week 5: requirements, scope statement, WBS, validate and control scope
  x(5, 3, "Which requirement is non-functional?", "Search results load within 2 seconds for 500 users", ["Students can filter units by campus and semester", "Staff can export enrolment lists to a CSV file", "The system emails a receipt after each payment"], "Non-functional requirements set qualities such as performance, security and usability."),
  x(5, 2, "Name the table that links each requirement to the deliverables and tests that satisfy it.", "Traceability matrix", ["Requirements register", "WBS dictionary", "Scope statement"], "A requirements traceability matrix shows every requirement is built and tested.", { kind: "term", accept: ["traceability matrix", "requirements traceability matrix", "RTM"] }),
  x(5, 2, "The scope baseline is the approved scope statement, the WBS and the…", "WBS dictionary", ["risk register", "work package list", "project charter"], "Scope baseline = scope statement + WBS + WBS dictionary."),
  x(5, 3, "Why does a scope statement list exclusions, such as \"no data migration from the old system\"?", "They stop later disputes over what was promised", ["They are needed before the WBS can be numbered", "They tell the team which features to gold plate", "They shrink the budget by removing contingency"], "Explicit out-of-scope items prevent arguments at acceptance."),
  x(5, 3, "A WBS should be broken down until each work package…", "can be estimated, scheduled, assigned and tracked", ["takes one person-day of effort or less", "fits exactly into one sprint for one developer", "names every task each developer will perform"], "Work packages are the lowest WBS level; activities come later in scheduling."),
  x(5, 2, "Which is product scope rather than project scope?", "Single sign-on with student IDs", ["Training help desk staff before go-live", "Writing weekly status reports for the sponsor", "Running user acceptance tests in week 10"], "Product scope is the features of the result. Project scope is all the work needed to deliver it."),

  // Week 6: dependencies, critical path, float, crashing and fast tracking
  x(6, 2, "Testing can't finish until coding has finished. Which dependency type is this?", "Finish to finish", ["Finish to start", "Start to start", "External dependency"], "FF links two finishes. FS, where one must finish before the next starts, is the most common type."),
  x(6, 3, "A (3 days) starts the project. B (5) and C (2) follow A. D (4) follows C. E (3) follows both B and D. How long is the project?", "12", ["11", "17", "9"], "A-C-D-E = 3 + 2 + 4 + 3 = 12 days, longer than A-B-E = 11. The longest path sets the duration.", { kind: "numeric", tolerance: 0, unit: "days", workedExample: "pm-critical-path" }),
  x(6, 3, "In the same network (A3, B5, C2, D4, E3), how much total float does B have?", "1", ["0", "11", "3"], "B's path A-B-E is 11 days against 12 on the critical path, so B can slip 1 day.", { kind: "numeric", tolerance: 0, unit: "days", workedExample: "pm-critical-path" }),
  x(6, 3, "Crashing activity G from 10 to 7 days raises its cost from $12,000 to $15,600. What is its crash cost per day?", "1200", ["360", "514", "3600"], "Cost slope = (crash cost − normal cost) ÷ days saved = 3,600 ÷ 3 = $1,200 a day.", { kind: "numeric", tolerance: 0, unit: "$ per day", workedExample: "pm-crashing" }),
  x(6, 3, "Go-live must wait 5 days after data migration ends, for a mandatory hold period. In the schedule this is…", "a finish-to-start link with a 5-day lag", ["a finish-to-start link with a 5-day lead", "a start-to-start link with 5 days of float", "a separate 5-day activity on the critical path"], "A lag adds waiting time after the predecessor. A lead lets work overlap."),
  x(6, 2, "Free float is how long an activity can slip without delaying…", "the early start of any successor", ["the project's finish date", "the next milestone on the Gantt chart", "any activity already on the critical path"], "Total float protects the project end date; free float protects the next activity."),

  // Week 7: quality and cost: estimating, PERT, reserves, earned value
  x(7, 3, "An activity is estimated at O = 4, M = 7 and P = 16 days. What is the PERT estimate?", "8", ["9", "7", "8.5"], "PERT = (O + 4M + P) ÷ 6 = (4 + 28 + 16) ÷ 6 = 48 ÷ 6 = 8 days.", { kind: "numeric", tolerance: 0.01, unit: "days", workedExample: "pm-pert" }),
  x(7, 3, "For the same activity (O = 4, M = 7, P = 16), what is the PERT standard deviation?", "2", ["4", "1.5", "12"], "SD = (P − O) ÷ 6 = 12 ÷ 6 = 2 days.", { kind: "numeric", tolerance: 0.01, unit: "days", workedExample: "pm-pert" }),
  x(7, 3, "PV = $80,000, EV = $72,000 and AC = $90,000. What is the SPI?", "0.9", ["0.8", "1.11", "1.25"], "SPI = EV ÷ PV = 72,000 ÷ 80,000 = 0.9, so the project is behind schedule.", { kind: "numeric", tolerance: 0.01, workedExample: "pm-ev-status" }),
  x(7, 3, "With PV = $80,000, EV = $72,000 and AC = $90,000, the schedule variance is…", "−$8,000", ["$8,000", "−$18,000", "−$10,000"], "SV = EV − PV = 72,000 − 80,000. Negative means behind schedule.", { workedExample: "pm-ev-status" }),
  x(7, 3, "A $20,000 allowance for risks already listed in the risk register belongs in…", "the contingency reserve, inside the cost baseline", ["the management reserve, outside the cost baseline", "the management reserve, inside the cost baseline", "the contingency reserve, outside the project budget"], "Contingency covers known risks inside the baseline; management reserve covers unknowns outside it."),
  x(7, 2, "Name the cost-of-quality category that covers rework, warranty claims and support calls caused by defects.", "Failure costs", ["Appraisal costs", "Prevention costs", "Audit costs"], "Internal and external failure costs make up the cost of nonconformance.", { kind: "term", accept: ["failure costs", "failure cost", "cost of nonconformance", "cost of non-conformance", "nonconformance", "non-conformance costs"] }),

  // Week 8: risk identification, analysis, EMV and responses
  x(8, 3, "An opportunity has a 25% chance of saving $36,000. What is its EMV?", "9000", ["27000", "3600", "-9000"], "EMV = 0.25 × 36,000 = +$9,000. Opportunities carry a positive EMV.", { kind: "numeric", tolerance: 0, unit: "$", workedExample: "pm-emv-decision" }),
  x(8, 3, "Option A costs $50,000 with a 20% chance of a $30,000 penalty. What is A's expected cost?", "56000", ["50000", "80000", "6000"], "Expected cost = 50,000 + 0.2 × 30,000 = $56,000.", { kind: "numeric", tolerance: 0, unit: "$", workedExample: "pm-emv-decision" }),
  x(8, 2, "Name the response that makes an opportunity certain to happen, for example by assigning your best developer to it.", "Exploit", ["Enhance", "Share", "Escalate"], "Exploit makes it certain; enhance raises its probability or impact; share partners with a better-placed party.", { kind: "term", accept: ["exploit", "exploiting"] }),
  x(8, 3, "\"The vendor's API is in beta, so it may change, which would delay integration by three weeks.\" This risk statement is good because it…", "states the cause, the event and the effect", ["names the risk owner and the agreed response", "gives the probability and impact as numbers", "describes an issue that has already happened"], "Cause, event and effect make a risk specific enough to own and respond to."),
  x(8, 2, "A risk that has actually happened and now needs action moves to…", "the issue log", ["the lessons-learned register", "the change log", "the risk breakdown structure"], "A risk is uncertain and in the future; an issue is happening now."),
  x(8, 3, "Rating risks high, medium or low on a probability and impact matrix is…", "qualitative risk analysis", ["quantitative risk analysis", "Monte Carlo simulation", "expected monetary value analysis"], "Qualitative analysis ranks risks quickly; quantitative analysis puts numbers on the overall effect."),
  x(8, 2, "Risks that remain after the planned responses are in place are called ____ risks.", "residual", ["secondary", "accepted", "contingent"], "Secondary risks are new risks caused by a response; residual risks are what is left over.", { kind: "cloze", accept: ["residual"] }),

  // Week 9: testing, PDCA, Six Sigma, quality tools, success criteria and KPIs
  x(9, 3, "A team checks 500 forms with 8 fields each and finds 20 field errors. What is the DPMO?", "5000", ["40000", "2500", "50000"], "DPMO = 20 ÷ (500 × 8) × 1,000,000 = 20 ÷ 4,000 × 1,000,000 = 5,000.", { kind: "numeric", tolerance: 0, unit: "DPMO" }),
  x(9, 3, "A control chart shows seven points in a row above the mean, all inside the control limits. This suggests…", "the process may have shifted and needs investigating", ["the process is in control, since no point is outside the limits", "the customer's specification limits need widening", "a one-off special cause that will fix itself next week"], "The rule of seven: a run on one side of the mean signals a shift even inside the limits."),
  x(9, 2, "Name the diagram that groups the possible causes of a problem by category, such as people, process and tools.", "Fishbone", ["Pareto chart", "Control chart", "Scatter diagram"], "A fishbone (Ishikawa) diagram explains a problem; a Pareto chart picks which problem to tackle.", { kind: "term", accept: ["fishbone", "fishbone diagram", "Ishikawa", "Ishikawa diagram", "cause and effect diagram", "cause-and-effect diagram"] }),
  x(9, 2, "Checking the system meets its specification is verification. Checking it meets the users' real needs is…", "validation", ["regression testing", "integration testing", "inspection"], "Verification: built it right. Validation: built the right thing."),
  x(9, 2, "In the PDCA cycle, the Act step means…", "standardise what worked, or rethink what didn't", ["carry out the planned change on a small scale", "measure the results against the expected outcome", "approve the change through the change control board"], "Plan, Do (try it), Check (measure), Act (standardise or adjust)."),

  // Week 10: PMBOK, PRINCE2 and tailoring
  x(10, 3, "Which is one of the eight PMBOK 7 performance domains?", "Delivery", ["Procurement", "Integration", "Scope"], "The domains are stakeholders, team, approach and life cycle, planning, project work, delivery, measurement and uncertainty. The others are older knowledge areas."),
  x(10, 2, "Name the PRINCE2 principle where the Project Board sets tolerances and only hears from the project manager when one is forecast to be exceeded.", "Manage by exception", ["Manage by stages", "Focus on products", "Defined roles and responsibilities"], "Management by exception saves senior time while keeping control.", { kind: "term", accept: ["manage by exception", "management by exception", "by exception", "managing by exception"] }),
  x(10, 2, "On a PRINCE2 Project Board, the Senior User is responsible for…", "user needs and realising the benefits", ["owning the business case and chairing the board", "the technical integrity of what suppliers build", "running the project day to day within tolerances"], "The Executive owns the business case; the Senior Supplier covers delivery and technical integrity."),
  x(10, 3, "Which statement about the PMBOK Guide, seventh edition, is accurate?", "It shifted to 12 principles and 8 performance domains", ["It replaced the knowledge areas with PRINCE2's seven themes", "It prescribes one step-by-step method for every project", "It dropped Agile and hybrid approaches to focus on waterfall"], "The 2021 edition moved from processes to principles, domains and value."),
  x(10, 3, "How many of PRINCE2's principles must be applied for a project to count as using PRINCE2?", "All seven", ["Any five", "Only business justification and stages", "Whichever ones suit the project"], "Pick and mix isn't allowed; tailoring changes how the principles apply, not whether."),
  x(10, 2, "An organisation uses PMBOK techniques inside a PRINCE2 governance structure. This is…", "common, since a guide and a method can be combined", ["not allowed, since PMI and PRINCE2 licences conflict", "only allowed once PMI certifies the project", "a breach of PRINCE2's tailoring principle"], "PMBOK describes good practice; PRINCE2 prescribes governance. Many organisations use both."),

  // Week 11: ITIL 4 and IT service management
  x(11, 2, "Name ITIL's term for a problem whose root cause has been analysed but not yet fixed.", "Known error", ["Workaround", "Open problem", "Major incident"], "Error control manages known errors until a permanent fix goes in.", { kind: "term", accept: ["known error", "a known error", "known-error"] }),
  x(11, 3, "An urgent security patch must go in tonight to close a hole attackers are already using. Under change enablement this is…", "an emergency change", ["a pre-approved standard change", "a normal change", "a major incident"], "Emergency changes are expedited but still assessed and authorised."),
  x(11, 2, "The service desk prioritises incidents by…", "impact and urgency", ["the cost and effort to fix them", "the caller's seniority", "the order they arrive in"], "Impact is how many are affected and how badly; urgency is how fast it hurts."),
  x(11, 2, "An agreement between two internal IT teams that supports a customer SLA is…", "an OLA", ["an SLA", "an MoU", "an underpinning contract"], "Operational level agreements are internal; underpinning contracts are with outside suppliers."),
  x(11, 3, "Where do most projects sit in the ITIL 4 service value chain?", "Design and transition, and obtain or build", ["Engage, and plan", "Deliver and support only", "Deliver and support, and continual improvement"], "Projects design and build the change; operations then deliver and support it."),

  // Week 12: revision: forecasting with earned value, communication channels
  x(12, 3, "BAC = $200,000, EV = $70,000 and AC = $90,000. The overrun came from a one-off licence error that won't recur. What is the EAC?", "220000", ["257143", "200000", "240000"], "Atypical variance: EAC = AC + (BAC − EV) = 90,000 + 130,000 = $220,000.", { kind: "numeric", tolerance: 1, unit: "$", workedExample: "pm-eac-forecast" }),
  x(12, 3, "Same project (BAC $200,000, EV $70,000, AC $90,000), but the overrun is expected to continue. The EAC is about…", "$257,143", ["$220,000", "$233,333", "$180,000"], "Typical variance: CPI = 70 ÷ 90 ≈ 0.78, so EAC = BAC ÷ CPI = 200,000 × 90 ÷ 70 ≈ $257,143.", { workedExample: "pm-eac-forecast" }),
  x(12, 3, "BAC = $150,000, CPI = 0.75 and AC = $60,000. If current performance continues, what is the ETC?", "140000", ["90000", "200000", "50000"], "EAC = 150,000 ÷ 0.75 = 200,000, so ETC = EAC − AC = 200,000 − 60,000 = $140,000.", { kind: "numeric", tolerance: 1, unit: "$", workedExample: "pm-eac-forecast" }),
  x(12, 3, "BAC = $150,000 and EAC = $200,000. The variance at completion is…", "−$50,000", ["$50,000", "−$150,000", "$350,000"], "VAC = BAC − EAC. Negative means the project is forecast to finish over budget.", { workedExample: "pm-eac-forecast" }),
  x(12, 3, "BAC = $100,000, EV = $40,000 and AC = $50,000. What CPI must the remaining work achieve to finish on budget (TCPI)?", "1.2", ["0.8", "1.25", "0.83"], "TCPI = (BAC − EV) ÷ (BAC − AC) = 60,000 ÷ 50,000 = 1.2.", { kind: "numeric", tolerance: 0.01, workedExample: "pm-eac-forecast" }),
  x(12, 3, "A project team grows from 5 to 8 people. How many communication channels does it have now?", "28", ["18", "56", "64"], "Channels = n(n − 1) ÷ 2 = 8 × 7 ÷ 2 = 28, up from 10 with five people.", { kind: "numeric", tolerance: 0, unit: "channels" }),
  x(12, 3, "BAC = $100,000, PV = $50,000, EV = $40,000, AC = $50,000. Using EAC = AC + (BAC − EV) ÷ (CPI × SPI), what is the EAC?", "143750", ["125000", "110000", "137500"], "CPI = 0.8 and SPI = 0.8, so EAC = 50,000 + 60,000 ÷ 0.64 = $143,750. Use this when the schedule also drives cost.", { kind: "numeric", tolerance: 1, unit: "$", workedExample: "pm-eac-forecast" }),
];

/**
 * Extra Project Management key terms, tagged by teaching week (merged after the bank's original 18 terms, deduplicated by term).
 * Format: kt(week, term, definition). One clear sentence, Australian English, no em dashes.
 */
export const EXTRA_PM_TERMS: RealmKeyTerm[] = [
  // Week 1: introduction
  kt(1, "Project", "A temporary endeavour undertaken to create a unique product, service or result."),
  kt(1, "Progressive elaboration", "Refining a project's plans and details step by step as more becomes known."),
  kt(1, "Process groups", "PMBOK's five groups: Initiating, Planning, Executing, Monitoring and Controlling, and Closing."),
  kt(1, "Sponsor", "The person who funds and champions the project and authorises its charter."),
  kt(1, "Power and interest grid", "A stakeholder map: manage closely high power and high interest, keep satisfied high power and low interest, keep informed low power and high interest, and monitor the rest."),

  // Week 2: approaches
  kt(2, "Predictive approach", "Planning scope, time and cost early, then working through sequential phases with sign-off between them, as in waterfall."),
  kt(2, "Iterative development", "Refining the same solution through repeated cycles of building and feedback."),
  kt(2, "Incremental delivery", "Delivering a solution in usable pieces over time, each piece adding functionality."),
  kt(2, "Adaptive approach", "Working in short time-boxes that deliver working increments, with time and cost fixed and scope flexing."),
  kt(2, "Hybrid approach", "Combining predictive governance, such as stage gates and fixed budgets, with adaptive delivery in sprints."),

  // Week 3: Agile and Scrum
  kt(3, "Agile Manifesto", "Four values that prefer individuals and interactions, working software, customer collaboration and responding to change over their counterparts."),
  kt(3, "Empiricism", "Scrum's basis that decisions come from what is observed, through transparency, inspection and adaptation."),
  kt(3, "Definition of Done", "The shared quality standard an increment must meet before any work in it counts as complete."),
  kt(3, "User story", "A requirement written as: as a user, I want a capability, so that I gain a benefit."),
  kt(3, "Velocity", "The story points of done work a team completes per sprint, averaged over recent sprints to forecast, not to commit."),

  // Week 4: integration management
  kt(4, "Integration management", "The knowledge area, owned by the project manager, that makes all the others work together from charter to closure."),
  kt(4, "Project management plan", "The master plan that integrates the subsidiary plans and the scope, schedule and cost baselines."),
  kt(4, "Baseline", "The approved version of the scope, schedule or cost that performance is measured against, changed only through change control."),
  kt(4, "Integrated change control", "The process where every change request is logged, assessed for impact and approved or rejected before any work starts."),
  kt(4, "Lessons learned", "Knowledge recorded during a project and at closing to help future projects."),

  // Week 5: scope management
  kt(5, "Requirements traceability matrix", "A table linking each requirement to the deliverables and tests that satisfy it."),
  kt(5, "100% rule", "The rule that a WBS includes all the work in scope and nothing outside it, with children adding up exactly to their parent."),
  kt(5, "Scope baseline", "The approved scope statement, WBS and WBS dictionary, used to measure and control scope."),
  kt(5, "Validate Scope", "The process in which the customer formally accepts completed deliverables, usually after quality control."),
  kt(5, "Scope creep", "Uncontrolled additions to scope, usually from stakeholder requests that skip change control."),

  // Week 6: schedule and resources
  kt(6, "Free float", "How long an activity can slip without delaying the early start of any successor."),
  kt(6, "Lag", "Waiting time added between linked activities, such as a hold period after a finish-to-start link, while a lead allows overlap."),
  kt(6, "Resource levelling", "Delaying activities to fix over-allocated people, which often extends the schedule."),

  // Week 7: quality and cost
  kt(7, "Quality assurance", "Process-focused work that prevents defects by improving how the work is done."),
  kt(7, "Quality control", "Product-focused inspection that detects defects in deliverables."),
  kt(7, "Cost of quality", "Conformance costs of prevention and appraisal plus non-conformance costs of internal and external failure."),
  kt(7, "PERT estimate", "A weighted three-point estimate: (optimistic + 4 × most likely + pessimistic) ÷ 6."),
  kt(7, "Contingency reserve", "Money inside the cost baseline for identified risks, unlike management reserve, which sits outside it for unknown risks."),

  // Week 8: risk management
  kt(8, "Issue", "A risk that has happened, or any current problem, which needs action now and goes in the issue log."),
  kt(8, "Risk avoidance", "A threat response that removes the cause by changing the plan, such as dropping an unproven technology."),
  kt(8, "Risk transfer", "A threat response that shifts the impact to a third party, such as through insurance or a contract."),
  kt(8, "Risk mitigation", "A threat response that reduces a risk's probability, its impact or both."),
  kt(8, "Exploit", "An opportunity response that makes the opportunity certain to happen."),

  // Week 9: quality control and success
  kt(9, "Validation", "Checking that the right product was built for users' real needs, whereas verification checks it meets the specification."),
  kt(9, "PDCA", "Plan, Do, Check, Act: a cycle of small, repeated improvements where Act standardises what worked."),
  kt(9, "DMAIC", "Six Sigma's improvement cycle of Define, Measure, Analyse, Improve and Control, aiming for about 3.4 defects per million opportunities."),
  kt(9, "Pareto chart", "Sorted bars with a cumulative line that show the few causes behind most defects."),
  kt(9, "Fishbone diagram", "An Ishikawa diagram that groups the possible causes of a problem by category, such as people, process and tools."),
  kt(9, "Control chart", "A chart of a process over time with a mean and control limits, showing whether the process is stable."),
  kt(9, "KPI", "A key performance indicator: a measure plus a target, ideally specific, measurable, achievable, relevant and time-bound."),

  // Week 10: standards
  kt(10, "PMBOK Guide", "PMI's descriptive guide to project management good practice, not a step-by-step method."),
  kt(10, "Performance domains", "The eight focus areas of PMBOK 7: stakeholders, team, approach and life cycle, planning, project work, delivery, measurement and uncertainty."),
  kt(10, "Continued business justification", "The PRINCE2 principle that a project must stay viable and worthwhile, checked at every stage boundary."),
  kt(10, "Manage by exception", "The PRINCE2 principle where the Project Board sets tolerances and hears from the project manager only when one is forecast to be exceeded."),
  kt(10, "Executive", "The PRINCE2 Project Board role that represents the business and owns the business case."),

  // Week 11: ITIL and service management
  kt(11, "Service", "In ITIL 4, a means of enabling outcomes customers want without them managing the specific costs and risks."),
  kt(11, "Service value chain", "ITIL 4's six activities: plan, improve, engage, design and transition, obtain or build, and deliver and support."),
  kt(11, "Known error", "A problem whose root cause has been analysed but not yet fixed."),
  kt(11, "Standard change", "A low-risk, pre-authorised change that follows a documented procedure."),
  kt(11, "Emergency change", "A change that must be expedited, such as an urgent security patch, with faster assessment and authorisation."),
  kt(11, "Service level agreement", "An agreement between a service provider and a customer that sets service targets, supported internally by OLAs."),

  // Week 12: revision and integration
  kt(12, "Estimate at completion", "The forecast final cost, BAC ÷ CPI when current cost performance is expected to continue."),
  kt(12, "Estimate to complete", "The expected cost of the remaining work: EAC − AC."),
  kt(12, "Variance at completion", "BAC − EAC, where a negative result means a forecast overrun."),
  kt(12, "TCPI", "The to-complete performance index: the CPI the remaining work must achieve to finish on budget, (BAC − EV) ÷ (BAC − AC)."),
  kt(12, "Communication channels", "The number of links in a team of n people, n(n − 1) ÷ 2, so 8 people have 28 channels."),
];

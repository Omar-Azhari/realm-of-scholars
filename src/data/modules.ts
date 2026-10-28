/**
 * Structured module content for all 48 modules (4 subjects x 12 modules).
 *
 * Source: docs/UniGame_docs_from_screenshots/docs/*_/Module_01.md .. Module_12.md
 * (see planning/DOCUMENT_AUDIT.md for full provenance).
 *
 * Every module markdown file uses an identical template with five sections:
 * title, Overview, Suggested UniGame tasks, Mini-game ideas, Source note. The
 * task/mini-game/source-note text is verbatim-identical across all 48 files
 * in the source material — that repetition is preserved here rather than
 * collapsed into a shared default, so each module is independently editable
 * later without affecting the others.
 */

import type { ModuleRecord } from "../types/domain";

const STANDARD_SUGGESTED_TASKS = [
  "Open and review the module materials.",
  "Record key concepts and definitions.",
  "Complete any lecture, tutorial, lab, or activity shown in the LMS.",
  "Add unclear points to the subject notes.",
  "Connect the module to any upcoming assessment.",
  "Mark the module complete after reviewing all available material.",
];

const STANDARD_MINI_GAME_IDEAS = [
  "Match key terms to their definitions.",
  "Sort concepts into the correct process or category.",
  "Complete a short memory-card challenge based on this module.",
];

const STANDARD_SOURCE_NOTE =
  "Prepared from the screenshots provided in the conversation. Detailed readings, files, and activities not visible in those screenshots should be added later.";

interface ModuleSourceRow {
  number: number;
  title: string;
  overview: string;
}

function buildModules(subjectId: string, idPrefix: string, rows: ModuleSourceRow[]): ModuleRecord[] {
  return rows.map((row) => ({
    id: `${idPrefix}-module-${String(row.number).padStart(2, "0")}`,
    subjectId,
    moduleNumber: row.number,
    title: row.title,
    overview: row.overview,
    suggestedTasks: [...STANDARD_SUGGESTED_TASKS],
    miniGameIdeas: [...STANDARD_MINI_GAME_IDEAS],
    sourceNote: STANDARD_SOURCE_NOTE,
    readings: [],
    schedule: [],
    outcomes: [],
    prerequisiteModuleIds: [],
    manualOverrides: [],
  }));
}

export const uiModules: ModuleRecord[] = buildModules(
  "user-interface-design",
  "ui",
  [
    { number: 1, title: "Introduction to CSE2UI", overview: "Subject orientation, expectations, assessment overview, and the role of user interface design." },
    { number: 2, title: "Basics of Human-Centred Design", overview: "Human-centred design principles, user needs, usability, accessibility, and designing around real users." },
    { number: 3, title: "Design Process Part 1: Discover", overview: "Researching users and contexts, gathering evidence, observations, interviews, and identifying problems." },
    { number: 4, title: "Design Process Part 2: Define", overview: "Synthesising research, defining the design problem, personas, user needs, and clear problem statements." },
    { number: 5, title: "Design Process Part 3: Develop", overview: "Generating ideas, comparing alternatives, sketching, ideation, and refining possible solutions." },
    { number: 6, title: "Design Process Part 4: Deliver and Prototyping", overview: "Creating prototypes, selecting appropriate fidelity, testing interactions, and preparing designs for evaluation." },
    { number: 7, title: "Evaluation and User Testing", overview: "Planning and conducting usability testing, collecting feedback, identifying usability problems, and improving designs." },
    { number: 8, title: "Quantitative and Qualitative Analysis", overview: "Analysing numerical and qualitative data, using tools such as JASP and Taguette where required, and reporting findings." },
    { number: 9, title: "Affordances", overview: "Understanding how design elements communicate possible actions and how users perceive and use interface controls." },
    { number: 10, title: "Interfaces, Models and Metaphors", overview: "Mental models, conceptual models, interface metaphors, and how familiar patterns support understanding." },
    { number: 11, title: "Design for All", overview: "Inclusive design, accessibility, diverse user needs, and reducing barriers in interfaces." },
    { number: 12, title: "User Interfaces of Tomorrow", overview: "Emerging interfaces, future interaction technologies, and reflection on changing interface design practice." },
  ]
);

export const cwaModules: ModuleRecord[] = buildModules(
  "cloud-based-web-application-development",
  "cwa",
  [
    { number: 1, title: "Introduction to Cloud-Based Web Application Development", overview: "Subject overview and foundations of modern cloud-based web applications." },
    { number: 2, title: "Web Hosting and Full-Stack Development", overview: "Web hosting, frontend and backend responsibilities, HTML, CSS, JavaScript, React, Node.js, and Express." },
    { number: 3, title: "Databases for Modern Web Applications", overview: "SQL, NoSQL, graph databases, PostgreSQL, SQLite, data modelling, and CRUD operations." },
    { number: 4, title: "Building a Full-Stack Web Application", overview: "Connecting frontend, backend, and database layers; testing APIs and application behaviour." },
    { number: 5, title: "Authentication, Identity and Secure Access", overview: "Authentication, protected routes, OAuth, passkeys, multi-factor authentication, and secure access practices." },
    { number: 6, title: "Advanced React, Next.js and Modern Frontend Design", overview: "Advanced React patterns, Next.js, component architecture, and modern frontend application design." },
    { number: 7, title: "Cloud Web Applications for IoT Networks", overview: "IoT-connected web applications, device communication, MQTT, and cloud integration." },
    { number: 8, title: "Microsoft ASP.NET Core and the Microsoft Web Ecosystem", overview: "ASP.NET Core, Razor, API development, and Microsoft web technologies." },
    { number: 9, title: "ASP.NET Core in the Microsoft Family", overview: "Microsoft Graph, Azure integration, identity, and broader Microsoft ecosystem services." },
    { number: 10, title: "AWS Cloud Deployment and Hosting", overview: "Deploying and hosting web applications using AWS and related cloud infrastructure." },
    { number: 11, title: "AWS Cloud Automation and Deployment Operations", overview: "Automation, deployment workflows, GitHub, Ubuntu, secure keys, environment variables, and operations." },
    { number: 12, title: "Final Integration and Professional Practice", overview: "Integrating the complete application, deployment checks, documentation, testing, and professional submission practice." },
  ]
);

export const pmModules: ModuleRecord[] = buildModules(
  "project-management",
  "pm",
  [
    { number: 1, title: "Introduction to Project Management", overview: "What projects are, the role of project management, project lifecycles, project managers, and the triple constraint of scope, time, and cost." },
    { number: 2, title: "Project Management Approaches", overview: "Waterfall, Agile, iterative delivery, when each approach is suitable, strengths, limitations, and comparison." },
    { number: 3, title: "Agile Development and Scrum", overview: "Agile values, Scrum roles, sprints, sprint planning, daily stand-ups, reviews, retrospectives, and backlogs." },
    { number: 4, title: "Project Integration Management", overview: "Project charters, project management plans, directing work, monitoring, integrated change control, and project closure." },
    { number: 5, title: "Project Scope Management", overview: "Requirements, scope statements, work breakdown structures, deliverables, boundaries, and controlling scope creep." },
    { number: 6, title: "Schedule and Resource Management", overview: "Activities, dependencies, critical path, Gantt charts, milestones, people, equipment, software, and resource planning." },
    { number: 7, title: "Quality and Cost Management", overview: "Quality assurance, quality control, cost estimation, budgets, cost baselines, and cost control." },
    { number: 8, title: "Risk Management", overview: "Risk identification, analysis, prioritisation, response strategies, risk registers, likelihood, impact, and monitoring." },
    { number: 9, title: "Quality Control and Project Success", overview: "Testing, continuous improvement, Six Sigma concepts, success factors, success criteria, and KPIs." },
    { number: 10, title: "Project Management Standards", overview: "PMBOK, PRINCE2, structured project management standards, frameworks, and their practical application." },
    { number: 11, title: "ITIL and IT Service Management", overview: "ITIL, ITSM, service delivery, support, incident management, problem management, change management, and continual improvement." },
    { number: 12, title: "Revision and Integration", overview: "Reviewing the full subject, connecting the knowledge areas, and preparing for final assessment or examination." },
  ]
);

export const ppeModules: ModuleRecord[] = buildModules(
  "professional-practices-and-entrepreneurship-in-it",
  "ppe",
  [
    { number: 1, title: "Professional Practice and Entrepreneurship Foundations", overview: "Introduction to professional practice in IT, entrepreneurship, professional identity, and the relationship between technology and business." },
    { number: 2, title: "Opportunity Identification and Innovation", overview: "Recognising problems worth solving, generating ideas, innovation, customer needs, and evaluating opportunities." },
    { number: 3, title: "Market and Customer Discovery", overview: "Market research, customer discovery, target users, competitors, evidence gathering, and validating assumptions." },
    { number: 4, title: "Entrepreneurial Planning and Value Propositions", overview: "Developing the startup concept, defining value propositions, feasibility, positioning, and early planning." },
    { number: 5, title: "Start-up Business Models", overview: "Business models, Business Model Canvas, Lean Canvas, customer segments, value propositions, revenue streams, cost structures, SaaS, platform and marketplace models, validation, valuation, and investor expectations." },
    { number: 6, title: "Structuring and Delivering the Startup Plan and Pitch", overview: "Business plans, problem and solution statements, market and competitor analysis, financial projections, pitch decks, storytelling, public speaking, investor communication, and Q&A." },
    { number: 7, title: "Ethics in Information Technology", overview: "Professional ethics, ACS Code of Ethics, ACS Code of Professional Conduct, utilitarianism, deontology, virtue ethics, accountability, and ethical decision-making." },
    { number: 8, title: "Privacy, Surveillance and Digital Manipulation", overview: "Privacy rights, GDPR, data protection, surveillance, security versus privacy, whistleblowing, data breaches, deepfakes, misinformation, and digital manipulation." },
    { number: 9, title: "Ethics and Governance in Artificial Intelligence", overview: "AI bias, fairness, transparency, accountability, responsible AI, governance frameworks, OECD principles, IEEE guidance, Australian Privacy Principles, and regulation." },
    { number: 10, title: "Open-Source Ethics and Licensing", overview: "Open-source software, licences, copyright, intellectual property, AI-generated content ownership, blockchain governance, VR/AR ethics, IoT ethics, and professional responsibility." },
    { number: 11, title: "Professional Career Readiness", overview: "Resumes, cover letters, LinkedIn, professional identity, networking, personal branding, behavioural interviews, STAR, SCAR, and career planning." },
    { number: 12, title: "Professional Communication, Decision-Making and Conflict Management", overview: "Workplace and cross-cultural communication, active listening, barriers, inclusion, negotiation, conflict management, decision-making, prioritisation, teamwork, and collaboration." },
  ]
);

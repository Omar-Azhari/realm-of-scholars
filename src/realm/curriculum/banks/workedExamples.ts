/**
 * Worked examples for calculation-heavy topics (earned value, float, EAC, break-even, EMV, ...).
 * Shown in full first, then faded: the student types each step's result. Exported to Unity as worked-examples.json.
 * Every number here has been checked. Results are plain numbers where a student types them (no $ or commas).
 */

import type { RealmWorkedExample } from "../../types";

export const WORKED_EXAMPLES: RealmWorkedExample[] = [
  // -------------------------------------------------------------------------
  // Project Management
  // -------------------------------------------------------------------------
  {
    id: "pm-ev-status",
    subject: "PM",
    week: 7,
    title: "Earned value status check",
    problem: "A portal upgrade has a budget (BAC) of $120,000. At the week 6 review: PV = $60,000, EV = $48,000, AC = $54,000. Is the project on budget and on schedule?",
    steps: [
      { action: "Find the cost variance", working: "CV = EV - AC = 48,000 - 54,000", result: "-6000" },
      { action: "Find the schedule variance", working: "SV = EV - PV = 48,000 - 60,000", result: "-12000" },
      { action: "Find CPI", working: "CPI = EV / AC = 48,000 / 54,000", result: "0.89", tolerance: 0.01 },
      { action: "Find SPI", working: "SPI = EV / PV = 48,000 / 60,000", result: "0.8", tolerance: 0.01 },
      { action: "Read the status", working: "CV and SV are negative; CPI and SPI are below 1", result: "Over budget and behind schedule" },
    ],
    takeaway: "EV comes first in every formula. Negative variances and indices below 1 are bad news.",
  },
  {
    id: "pm-eac-forecast",
    subject: "PM",
    week: 12,
    title: "Forecasting: EAC, ETC, VAC and TCPI",
    problem: "BAC = $160,000. So far EV = $64,000 and AC = $80,000. Forecast the final cost if the overrun is typical, then if it was a one-off.",
    steps: [
      { action: "Find CPI", working: "CPI = EV / AC = 64,000 / 80,000", result: "0.8", tolerance: 0.01 },
      { action: "EAC if performance continues (typical)", working: "EAC = BAC / CPI = 160,000 / 0.8", result: "200000" },
      { action: "Find ETC", working: "ETC = EAC - AC = 200,000 - 80,000", result: "120000" },
      { action: "Find VAC", working: "VAC = BAC - EAC = 160,000 - 200,000", result: "-40000" },
      { action: "EAC if the overrun was a one-off (atypical)", working: "EAC = AC + (BAC - EV) = 80,000 + 96,000", result: "176000" },
      { action: "Find TCPI to finish on budget", working: "TCPI = (BAC - EV) / (BAC - AC) = 96,000 / 80,000", result: "1.2", tolerance: 0.01 },
    ],
    takeaway: "Pick the EAC formula from the story: typical variance uses BAC / CPI, a one-off uses AC + (BAC - EV).",
  },
  {
    id: "pm-critical-path",
    subject: "PM",
    week: 6,
    title: "Critical path, total float and free float",
    problem: "A takes 4 days and starts the project. B (6 days) and C (3 days) follow A. D (5 days) follows B. E (4 days) follows C. F (2 days) follows both D and E. Find the critical path and the float on C.",
    steps: [
      { action: "Add up path A-B-D-F", working: "4 + 6 + 5 + 2", result: "17" },
      { action: "Add up path A-C-E-F", working: "4 + 3 + 4 + 2", result: "13" },
      { action: "State the project duration", working: "The longest path, A-B-D-F, is critical", result: "17" },
      { action: "Forward pass: early finish of E", working: "C finishes at 4 + 3 = 7, so E finishes at 7 + 4", result: "11" },
      { action: "Backward pass: total float of C", working: "F late start 15, so E late start 11, C late start 8; float = LS - ES = 8 - 4", result: "4" },
      { action: "Free float of C", working: "ES of E minus EF of C = 7 - 7", result: "0" },
    ],
    takeaway: "C can slip 4 days without delaying the project, but any slip at all delays E. That is total float versus free float.",
  },
  {
    id: "pm-pert",
    subject: "PM",
    week: 7,
    title: "PERT estimate and standard deviation",
    problem: "A data migration is estimated at optimistic 6 days, most likely 9 days and pessimistic 18 days. Find the PERT estimate, its standard deviation and a range with about 95% confidence.",
    steps: [
      { action: "Apply the PERT formula", working: "TE = (O + 4M + P) / 6 = (6 + 36 + 18) / 6", result: "10" },
      { action: "Find the standard deviation", working: "SD = (P - O) / 6 = (18 - 6) / 6", result: "2" },
      { action: "Find the variance", working: "Variance = SD squared = 2 x 2", result: "4" },
      { action: "Lower end of the 95% range", working: "TE - 2 SD = 10 - 4", result: "6" },
      { action: "Upper end of the 95% range", working: "TE + 2 SD = 10 + 4", result: "14" },
    ],
    takeaway: "PERT weights the most likely value four times; the spread (P - O) drives the uncertainty.",
  },
  {
    id: "pm-crashing",
    subject: "PM",
    week: 6,
    title: "Crashing the cheapest way",
    problem: "The critical path A-B-C takes 20 days; the only other path takes 15 days. A: 8 days for $4,000, or 6 days for $6,000. B: 5 days for $3,000, or 4 days for $4,500. C: 7 days for $5,000, or 5 days for $5,800. Cut 3 days at the lowest cost.",
    steps: [
      { action: "Crash cost per day for A", working: "(6,000 - 4,000) / (8 - 6)", result: "1000" },
      { action: "Crash cost per day for B", working: "(4,500 - 3,000) / (5 - 4)", result: "1500" },
      { action: "Crash cost per day for C", working: "(5,800 - 5,000) / (7 - 5)", result: "400" },
      { action: "Crash the cheapest first", working: "C by its full 2 days at $400 a day", result: "800" },
      { action: "Add the next cheapest day and total it", working: "A by 1 day at $1,000; 800 + 1,000", result: "1800" },
    ],
    takeaway: "Crash the critical activity with the lowest cost per day first, and check no other path becomes longer (17 > 15 here).",
  },
  {
    id: "pm-emv-decision",
    subject: "PM",
    week: 8,
    title: "Build or buy with expected monetary value",
    problem: "Build in-house for $80,000 with a 30% chance of a $50,000 overrun, or buy a package for $90,000 with a 10% chance of a $40,000 integration problem. Which has the lower expected cost?",
    steps: [
      { action: "EMV of the build overrun", working: "0.3 x 50,000", result: "15000" },
      { action: "Expected cost of building", working: "80,000 + 15,000", result: "95000" },
      { action: "EMV of the integration problem", working: "0.1 x 40,000", result: "4000" },
      { action: "Expected cost of buying", working: "90,000 + 4,000", result: "94000" },
      { action: "Choose the option", working: "94,000 < 95,000, so buying is cheaper by 1,000", result: "Buy" },
    ],
    takeaway: "Add each branch's cost to its probability-weighted risk, then pick the lowest expected cost.",
  },

  // -------------------------------------------------------------------------
  // Professional Practices and Entrepreneurship in IT
  // -------------------------------------------------------------------------
  {
    id: "ppe-ltv-cac",
    subject: "PPE",
    week: 5,
    title: "LTV to CAC and payback",
    problem: "A SaaS tool charges $40 a month at a 75% gross margin. Monthly churn is 2.5%. Last quarter $30,000 of marketing won 75 customers. Find LTV, CAC, the ratio and the payback period.",
    steps: [
      { action: "Gross profit per customer per month", working: "40 x 0.75", result: "30" },
      { action: "Average customer lifetime in months", working: "1 / 0.025", result: "40" },
      { action: "Find LTV", working: "30 x 40", result: "1200" },
      { action: "Find CAC", working: "30,000 / 75", result: "400" },
      { action: "Find the LTV:CAC ratio", working: "1,200 / 400", result: "3" },
      { action: "Find the payback period in months", working: "CAC / monthly gross profit = 400 / 30", result: "13.3", tolerance: 0.1 },
    ],
    takeaway: "About 3:1 is a healthy benchmark; below 1:1 every new customer loses money.",
  },
  {
    id: "ppe-break-even",
    subject: "PPE",
    week: 6,
    title: "Break-even units and revenue",
    problem: "A booking app has fixed costs of $72,000 a year. Each licence sells for $45 and costs $15 to serve. Find the break-even volume and revenue, and the profit at 3,000 licences.",
    steps: [
      { action: "Find the contribution margin per unit", working: "Price - variable cost = 45 - 15", result: "30" },
      { action: "Find the break-even volume", working: "Fixed costs / contribution margin = 72,000 / 30", result: "2400" },
      { action: "Find the break-even revenue", working: "2,400 x 45", result: "108000" },
      { action: "Find the profit at 3,000 units", working: "3,000 x 30 - 72,000", result: "18000" },
    ],
    takeaway: "Every unit past break-even adds its full contribution margin to profit.",
  },
  {
    id: "ppe-npv",
    subject: "PPE",
    week: 6,
    title: "NPV of a three-year project",
    problem: "A platform costs $100,000 now and returns $40,000, $50,000 and $60,000 at the end of years 1, 2 and 3. The discount rate is 10%. Find the NPV.",
    steps: [
      { action: "Discount year 1", working: "40,000 / 1.1", result: "36364", tolerance: 1 },
      { action: "Discount year 2", working: "50,000 / 1.1^2 = 50,000 / 1.21", result: "41322", tolerance: 1 },
      { action: "Discount year 3", working: "60,000 / 1.1^3 = 60,000 / 1.331", result: "45079", tolerance: 1 },
      { action: "Sum the present values", working: "36,364 + 41,322 + 45,079", result: "122765", tolerance: 2 },
      { action: "Subtract the upfront cost", working: "NPV = 122,765 - 100,000", result: "22765", tolerance: 2 },
    ],
    takeaway: "A positive NPV means the project beats the 10% hurdle; undiscounted, it would look $27,235 better than it is.",
  },
  {
    id: "ppe-runway",
    subject: "PPE",
    week: 4,
    title: "Burn rate and runway",
    problem: "A startup has $600,000 in the bank. It spends $70,000 a month and earns $20,000 a month in revenue. Find its runway, then the runway after hiring a developer for $10,000 a month.",
    steps: [
      { action: "Gross burn per month", working: "Total monthly spending", result: "70000" },
      { action: "Net burn per month", working: "70,000 - 20,000", result: "50000" },
      { action: "Runway in months", working: "Cash / net burn = 600,000 / 50,000", result: "12" },
      { action: "Net burn after the hire", working: "50,000 + 10,000", result: "60000" },
      { action: "Runway after the hire", working: "600,000 / 60,000", result: "10" },
    ],
    takeaway: "Runway uses net burn. Every new monthly cost shortens the time left to prove the model.",
  },
];

/**
 * Extra UI questions (appended after the originals in latrobeBanks.ts, ids -x1, -x2, ...).
 * Format: x(week, difficulty, prompt, correct, [three wrong], explanation, { kind, accept, tolerance, unit, workedExample }).
 * Never reorder or delete entries once shipped: ids are positional and saves remember them. Append only.
 */

import type { RealmKeyTerm } from "../../../types";
import { kt, x, type ExtraQuestion } from "./x";

export const EXTRA_UI: ExtraQuestion[] = [
  // Week 1: why UI design matters, usability
  x(1, 1, "Name the quality of an interface that ISO 9241-11 measures by effectiveness, efficiency and satisfaction for specified users and goals.", "Usability", ["Accessibility", "User experience", "Utility"], "ISO 9241-11 defines usability with those three measures, always within a context of use.", { kind: "term", accept: ["usability", "usable"] }),
  x(1, 2, "In ISO 9241-11 terms, the share of users who complete a task correctly measures ____.", "effectiveness", ["efficiency", "user satisfaction", "learnability"], "Effectiveness is accuracy and completeness. Efficiency is the time or effort spent getting there.", { kind: "cloze", accept: ["task effectiveness"] }),
  x(1, 3, "A booking app passed lab tests, but riders on a crowded tram can't use it one-handed. Which part of the usability definition did the testing ignore?", "The context of use", ["The specified users", "The specified goals", "The satisfaction measure"], "Usability only holds for specified users and goals in a specified context. The lab didn't match the real one."),
  x(1, 3, "Which measure reports efficiency rather than effectiveness?", "Time on task for users who succeed", ["Share of users who finish the task", "Number of errors that block the task", "Post-task rating of ease out of seven"], "Efficiency is the time or effort needed to reach a goal. Completion and blocking errors measure effectiveness."),
  x(1, 2, "Which is a UI decision rather than a wider UX decision?", "Using a toggle, not a checkbox, for a setting", ["Deciding whether students need reminders at all", "Mapping a student's steps from offer to first class", "Interviewing students about why they miss deadlines"], "UI is the interface layer: controls, layout and labels. Needs, journeys and research belong to the wider UX."),
  x(1, 2, "Why does a usability problem found after release usually cost far more to fix than one found in a sketch?", "Code, content and users' habits must all change", ["Released code is locked until the next major version", "Users report fewer problems once an app has shipped", "Late fixes need a full new round of user research first"], "The later a change, the more work it touches. A sketch can be redrawn in minutes."),

  // Week 2: human-centred design, accessibility
  x(2, 2, "Name the ISO standard that sets out the principles and activities of human-centred design for interactive systems.", "ISO 9241-210", ["ISO 9241-11", "ISO 27001", "ISO/IEC 25010"], "ISO 9241-210 covers human-centred design. ISO 9241-11 defines usability itself.", { kind: "term", accept: ["9241-210", "ISO 9241 210", "ISO9241-210", "ISO 9241-210:2019", "9241 210"] }),
  x(2, 2, "WCAG 2.2 Target Size (Minimum), level AA: pointer targets should be at least how many CSS pixels wide and high, unless spaced apart?", "24", ["44", "48", "16"], "Success criterion 2.5.8 sets 24 by 24 CSS pixels. 44 by 44 is the stricter AAA level.", { kind: "numeric", tolerance: 0, unit: "px" }),
  x(2, 3, "White text has relative luminance 1.0 and a grey background 0.2. Using (L1 + 0.05) / (L2 + 0.05), what is the contrast ratio? Enter x for x:1.", "4.2", ["5", "4.5", "3.75"], "(1.0 + 0.05) / (0.2 + 0.05) = 1.05 / 0.25 = 4.2. That fails AA for normal text (4.5:1) but passes for large text (3:1).", { kind: "numeric", tolerance: 0.05, unit: ":1" }),
  x(2, 3, "A sortable to-do list can only be reordered by dragging. Which WCAG 2.2 AA success criterion does it fail?", "Dragging Movements", ["Pointer Gestures", "Target Size (Minimum)", "Focus Not Obscured"], "2.5.7 Dragging Movements needs a single-pointer alternative, such as up and down buttons. Pointer Gestures covers path-based gestures like swipes."),
  x(2, 3, "A student asks for a bigger calendar. Watching her, you see she keeps missing assignment clashes. What should the design do?", "Make clashes obvious, the need behind the ask", ["Build the bigger calendar, since she asked", "Ask more students which calendar size they want", "Add a setting so each user picks a calendar size"], "Users are experts in their problems, not in solutions. Design for the underlying need you observed."),

  // Week 3: Discover
  x(3, 2, "Name the research method in which you observe and question people in their own setting while they do real work.", "Contextual inquiry", ["Focus group", "Diary study", "Cognitive walkthrough"], "Contextual inquiry pairs observation with questions in context, which surfaces tacit workarounds.", { kind: "term", accept: ["contextual enquiry", "contextual inquiries", "contextual interview", "contextual interviews"] }),
  x(3, 2, "Which research note records an observation rather than an interpretation?", "P4 scrolled past the Save button three times", ["P4 didn't notice the Save button on the page at all", "The Save button is in a poor position", "P4 found the edit page confusing to use"], "Observations record what happened. \"Didn't notice\" and \"confusing\" are hypotheses to check."),
  x(3, 3, "You need to estimate how many of 20,000 students commute more than an hour. Which method fits?", "A survey of a random sample of students", ["Contextual inquiry with five long-distance commuters", "A two-week diary study with ten commuting students", "A focus group of eight students who drive in"], "\"How many\" needs a larger, representative sample. Small qualitative methods explain why, not how many."),
  x(3, 2, "Why pair interviews with observation in the Discover phase?", "What people say often differs from what they do", ["Interviews alone need ethics approval, observation doesn't", "Observation is quicker to analyse than interview notes", "Users refuse to answer questions about their workarounds"], "People describe the official process and forget their workarounds. Watching them reveals the tacit steps."),
  x(3, 2, "A ____ study asks participants to log their own experiences over days or weeks, in their normal routine.", "diary", ["usability", "eye-tracking", "card sort"], "Diary studies capture behaviour over time and in context, which a one-off interview misses.", { kind: "cloze", accept: ["diary study", "journal", "journaling", "journalling"] }),

  // Week 4: Define
  x(4, 2, "Name the design-thinking statement that combines a user, their need and an insight, such as \"Commuting students need X because Y\".", "POV statement", ["How might we question", "User story", "Value proposition"], "A point of view statement frames the problem from research. How might we questions then turn it into opportunities.", { kind: "term", accept: ["point of view statement", "point-of-view statement", "POV", "point of view", "problem statement"] }),
  x(4, 3, "Which is a user need rather than a solution in disguise?", "See every subject's deadlines in one place", ["A calendar widget on the home screen", "A push alert sent the day before each deadline", "A dashboard tab that lists every subject"], "Needs describe goals. Widgets, alerts and tabs are features that might meet the need."),
  x(4, 2, "Your team keeps arguing from \"people like me\". What is a persona's main job in that debate?", "Keeping choices tied to researched user goals", ["Showing which age group and income will pay most", "Giving the client a real customer to contact", "Replacing usability testing once it's written"], "Personas replace self-reference with shared, evidence-based goals. They don't replace testing."),
  x(4, 3, "To show where students get frustrated from their offer email to their first class, which artefact fits best?", "A journey map", ["A primary persona with goals", "An empathy map of one student", "A task flow"], "Journey maps lay out stages, actions and emotions over time, so the pain points stand out."),
  x(4, 2, "A map split into Says, Thinks, Does and Feels for one user is called…", "an empathy map", ["a journey map", "an affinity diagram", "a stakeholder map"], "Empathy maps capture one user's inner and outer experience. Journey maps show stages over time."),

  // Week 5: Develop
  x(5, 1, "Generating many options without judging them is which mode of thinking?", "Divergent", ["Convergent", "Critical", "Analytical"], "Divergent thinking opens up options. Convergent thinking evaluates them and chooses."),
  x(5, 3, "On an impact versus effort matrix, which ideas do teams usually build first?", "High impact, low effort", ["High impact, high effort", "Low impact, low effort", "Low impact, high effort"], "Quick wins give the most value for the least work. Big bets need planning, and low-impact work waits."),
  x(5, 2, "Early in Develop, why do sketches often beat prototypes?", "They're cheap to throw away, so you explore more", ["They give more accurate timing data from users", "Stakeholders sign off sketches faster than mock-ups", "They can be handed straight to developers to build"], "Sketches suggest and explore; prototypes test and refine. Cheap ideas are easy to let go."),
  x(5, 3, "After brainstorming, the team votes aloud and everyone copies the manager. What's the better way to converge?", "Silent dot voting, revealed all at once", ["Let the manager decide to save time", "Debate each idea until everyone agrees", "Keep the ideas with the most detail written"], "Silent voting cuts anchoring and groupthink, so the strongest ideas surface rather than the loudest."),
  x(5, 2, "Brainstorming rules say go for ____ first, since more ideas raise the odds of a strong one.", "quantity", ["quality", "consensus", "feasibility"], "Quantity breeds quality. Judging comes later, in the convergent phase.", { kind: "cloze", accept: ["volume", "quantity of ideas", "many ideas", "lots of ideas"] }),

  // Week 6: Deliver and prototyping
  x(6, 3, "A prototype builds one feature, such as checkout, in full working depth, with the rest absent. This is a…", "vertical prototype", ["horizontal prototype", "Wizard of Oz prototype", "paper prototype"], "Vertical prototypes go deep on one slice. Horizontal ones go broad and shallow across the interface."),
  x(6, 3, "Which question can only a high-fidelity prototype answer well?", "Does the swipe animation feel quick enough?", ["Can users find Settings from the home screen?", "Do users understand the menu labels we chose?", "Which order of steps do users expect to take?"], "Timing and feel need realistic interaction. Structure and labels test fine at low fidelity."),
  x(6, 2, "In a paper prototype test, the team member who silently swaps paper screens in response to taps plays the role of…", "the computer", ["the facilitator", "the observer", "the note-taker"], "The \"computer\" acts out the system without explaining it, while the facilitator talks to the participant."),
  x(6, 2, "A quick prototype built only to learn, then discarded, is a ____ prototype.", "throwaway", ["evolutionary", "incremental", "production"], "Throwaway prototypes answer a question fast. Evolutionary prototypes are refined into the final product.", { kind: "cloze", accept: ["throw-away", "throw away", "disposable", "rapid"] }),
  x(6, 3, "Stakeholders keep commenting on colours while you test the navigation flow. What's the best move?", "Switch to greyscale wireframes for this round", ["Finalise the colour palette before testing again", "Ask stakeholders to hold all comments until launch", "Run the test with developers instead of users"], "Low fidelity keeps attention on structure. Save the visual polish for later rounds."),

  // Week 7: evaluation and user testing
  x(7, 3, "Nielsen and Landauer found each test user reveals about 31% of usability problems. Using 1 − (1 − 0.31)^n, what percentage do five users find? Round to a whole number.", "84", ["31", "69", "155"], "1 − 0.69^5 = 1 − 0.156 = 0.844, so about 84%. Nielsen rounds it to 85%, the basis of the five-user rule.", { kind: "numeric", tolerance: 1, unit: "%" }),
  x(7, 2, "Name the Nielsen heuristic that says users shouldn't have to remember information from one part of the interface to another.", "Recognition rather than recall", ["Consistency and standards", "Error prevention", "Flexibility and efficiency of use"], "Make options, actions and needed information visible, so memory load stays low.", { kind: "term", accept: ["recognition over recall", "recognition not recall", "recognition vs recall", "recognition versus recall", "recognition instead of recall", "recognition"] }),
  x(7, 3, "A user deletes a project by mistake and there's no undo. Which heuristic is most directly violated?", "User control and freedom", ["Error prevention", "Visibility of system status", "Flexibility and efficiency of use"], "Users need a clearly marked emergency exit, such as undo. A confirmation step would be error prevention."),
  x(7, 3, "Which task scenario is best for a usability test?", "You start Monday. Find your first class's room.", ["Click the Timetable tab and find Monday's room.", "Tell us what you think of the timetable feature.", "Explore the app freely and describe each screen."], "Good tasks set a realistic goal without naming the UI path or asking for opinions."),

  // Week 8: quantitative and qualitative analysis
  x(8, 3, "After adjusting each item, a participant's ten SUS item contributions add up to 30. What is their SUS score?", "75", ["30", "60", "67.5"], "Multiply the summed contributions (each 0 to 4) by 2.5: 30 × 2.5 = 75, a little above the average of 68.", { kind: "numeric", tolerance: 0 }),
  x(8, 2, "Name the level of measurement with ordered, equal intervals and a true zero, such as task time in seconds.", "Ratio", ["Interval", "Ordinal", "Nominal"], "Ratio data has a true zero, so \"twice as long\" makes sense. Interval data, like °C, doesn't.", { kind: "term", accept: ["ratio data", "ratio scale", "ratio level"] }),
  x(8, 3, "Two separate groups try design A or B, and you record whether each person completed the task (yes or no). Which test compares completion?", "Chi-square test of independence", ["Independent-samples t-test on means", "Paired-samples t-test", "Pearson correlation"], "Completion is categorical, so compare counts with chi-square. t-tests compare means of continuous data."),
  x(8, 2, "A result with a p-value below the usual ____ threshold is reported as statistically significant.", "0.05", ["0.5", "0.95", "0.001"], "By convention, p < .05 means a result this extreme would be unlikely if there were no real difference.", { kind: "cloze", accept: [".05", "5%", "0.05 level", "5 percent", "p < 0.05", "p<0.05"] }),

  // Week 9: affordances
  x(9, 2, "Name the kind of cue that suggests an action the object doesn't support, such as underlined text that isn't a link.", "False affordance", ["Hidden affordance", "Natural mapping", "Forcing function"], "False affordances promise an action that isn't there. Hidden ones are real actions with no cue.", { kind: "term", accept: ["false affordances", "false signifier", "misleading signifier"] }),
  x(9, 3, "Swipe-to-delete on a list with no visible hint is an example of…", "a hidden affordance", ["a false affordance", "a physical constraint", "a natural mapping"], "The action exists, but nothing signals it. Add a signifier or an alternative such as an Edit button."),
  x(9, 3, "Four stove burners sit in a square but their four knobs sit in a row, and people turn on the wrong one. Norman's fix is…", "natural mapping: lay knobs out like burners", ["a stronger signifier: label each knob clearly", "more feedback: a light when a burner is on", "a forcing function: one knob works at a time"], "When controls mirror the layout they affect, users don't need labels to pick the right one."),
  x(9, 2, "A plug that fits its socket only one way stops wrong insertion. Norman calls this design principle…", "a constraint", ["a mapping", "a signifier", "a conceptual model"], "Constraints limit the possible actions, so the error can't happen in the first place."),
  x(9, 2, "A button changes to a pressed state and shows a spinner when tapped. Which of Norman's principles is at work?", "Feedback", ["Mapping", "Constraint", "Affordance"], "Feedback tells users the action registered and the system is responding."),

  // Week 10: interfaces, models and metaphors
  x(10, 3, "The gap between what the system shows and the user's ability to tell whether their goal was met is the…", "gulf of evaluation", ["gulf of execution", "system image gap", "conceptual model gap"], "Clear feedback and visible state bridge the gulf of evaluation. Clear controls bridge the gulf of execution."),
  x(10, 3, "In Norman's model, the designer's conceptual model reaches the user only through…", "the system image", ["the user's mental model", "a shared design document", "the developers' code comments"], "Users never talk to the designer. The interface, its behaviour and its help text must carry the model."),
  x(10, 3, "Early Mac users ejected a disk by dragging it to the Trash. Why did this feel wrong to many?", "The metaphor said delete, but the action was eject", ["Dragging an icon takes longer than using a menu command", "The Trash icon was too small to hit reliably", "Users had no mental model of disks at all"], "Metaphors break at the edges. When an action contradicts the metaphor, users fear the wrong result."),
  x(10, 2, "Design that mimics real objects, like a notes app styled as yellow lined paper, is called ____.", "skeuomorphism", ["flat design", "material design", "neumorphism"], "Skeuomorphism borrows real-world looks to make new interfaces feel familiar.", { kind: "cloze", accept: ["skeuomorphic", "skeuomorphic design", "skeumorphism", "skeuomorphism design", "skeuomorphs"] }),
  x(10, 2, "A conceptual model is best described as…", "the designer's simple account of how it works", ["the user's private belief about how it works", "a full technical diagram of the system's code", "the brand style that sets each screen's look"], "The conceptual model is the intended explanation. The mental model is what the user actually believes."),

  // Week 11: design for all
  x(11, 2, "Under WCAG 2.2 AA, what minimum contrast must a text field's border have against its background when it's the only cue showing the field? Enter x for x:1.", "3", ["4.5", "7", "1.5"], "Non-text Contrast (1.4.11) needs 3:1 for UI components and meaningful graphics. 4.5:1 is for normal text.", { kind: "numeric", tolerance: 0, unit: ":1" }),
  x(11, 2, "Name the model of disability that places it in the mismatch between a person and their environment.", "Social model", ["Medical model", "Moral model", "Universal design"], "Under the social model, designers remove barriers rather than \"fix\" the person.", { kind: "term", accept: ["social model of disability", "the social model", "social"] }),
  x(11, 3, "\"Solve for one, extend to many\" is the motto of which approach?", "Inclusive design", ["Universal design", "Responsive design", "Participatory design"], "Microsoft's inclusive design starts from one excluded group and extends the benefit to everyone."),
  x(11, 3, "A custom dropdown built from divs works with a mouse but not with Tab or Enter. What's the best fix?", "Use a native select element", ["Add a tooltip saying to use a mouse", "Raise the colour contrast of the options", "Add an ARIA label to the outer div"], "Native controls come with keyboard and screen reader support. An ARIA label alone adds no behaviour."),
  x(11, 2, "Every meaningful image needs ____ text so screen reader users get its content.", "alt", ["title", "caption", "tooltip"], "Alt text describes the image's purpose. Decorative images get an empty alt so they're skipped.", { kind: "cloze", accept: ["alternative", "alt text", "alternative text", "alt-text", "alt attribute"] }),

  // Week 12: user interfaces of tomorrow
  x(12, 3, "Using Fitts's index of difficulty, ID = log2(D / W + 1), a target is 300 px away and 20 px wide. What is ID in bits?", "4", ["5", "16", "3.9"], "300 / 20 + 1 = 16, and log2(16) = 4 bits. Doubling the width would drop it to about 3.1.", { kind: "numeric", tolerance: 0.05, unit: "bits" }),
  x(12, 3, "Hick's law gives decision time T = b × log2(n + 1). With b = 0.2 s and 7 equally likely options, what is T in seconds?", "0.6", ["1.4", "0.56", "0.8"], "log2(7 + 1) = 3, and 0.2 × 3 = 0.6 s. Doubling to 15 options only adds another 0.2 s.", { kind: "numeric", tolerance: 0.01, unit: "s" }),
  x(12, 2, "Name Mark Weiser's vision of computers that fade into the background of everyday life.", "Ubicomp", ["Augmented reality", "IoT", "Wearable computing"], "Weiser's ubiquitous computing imagined computers woven into everyday objects and places.", { kind: "term", accept: ["ubiquitous computing", "ubi comp", "pervasive computing", "ubiquitous", "calm technology"] }),
  x(12, 3, "A subscription takes one tap to start but six screens and a phone call to cancel. This is…", "a deceptive pattern that blocks leaving", ["progressive disclosure of advanced account settings", "error prevention for costly actions", "a forcing function for safety"], "Deceptive (dark) patterns trick or trap users. Cancelling should be as easy as signing up."),
  x(12, 2, "A voice assistant isn't sure what it heard. What's the best response?", "Confirm what it heard and offer two options", ["Say \"I didn't understand\" until they rephrase", "Run the most likely command straight away", "Read out every command it supports, then wait"], "Confirming keeps users in control, and short options aid discovery without a long spoken list."),
];

/**
 * Extra UI key terms, tagged by teaching week (merged after the bank's original 18 terms, deduplicated by term).
 * Format: kt(week, term, definition). One clear sentence, Australian English, no em dashes.
 */
export const EXTRA_UI_TERMS: RealmKeyTerm[] = [
  // Week 1: why UI design matters
  kt(1, "User interface", "Where a person and a system meet: everything they see, hear or touch to use it, which to users is the system."),
  kt(1, "User experience (UX)", "The whole experience of using a product, including needs, flows and satisfaction, of which the UI is one part."),
  kt(1, "Effectiveness", "The accuracy and completeness with which users achieve their goals, such as the share who finish a task correctly."),
  kt(1, "Efficiency", "The time or effort users spend reaching a goal, such as time on task for those who succeed."),
  kt(1, "Context of use", "The users, tasks, equipment and physical and social environment in which a product is actually used."),

  // Week 2: human-centred design, accessibility
  kt(2, "ISO 9241-210", "The international standard that sets out the principles and activities of human-centred design for interactive systems."),
  kt(2, "WCAG", "The Web Content Accessibility Guidelines: principles, guidelines and testable success criteria at levels A, AA and AAA."),
  kt(2, "POUR", "WCAG's four principles: content must be perceivable, operable, understandable and robust."),
  kt(2, "Contrast ratio", "The luminance ratio between text and its background, from 1:1 to 21:1, where WCAG AA needs 4.5:1 for normal text and 3:1 for large text."),
  kt(2, "Target Size (Minimum)", "The WCAG 2.2 AA criterion that pointer targets be at least 24 by 24 CSS pixels unless they are spaced apart."),

  // Week 3: Discover
  kt(3, "Tacit behaviour", "Things people do without thinking about them, such as workarounds, so they rarely mention them and you must observe them."),
  kt(3, "Leading question", "An interview question that hints at the expected answer, such as asking whether a screen is confusing, and so biases the reply."),
  kt(3, "Diary study", "A method in which participants log their own experiences over days or weeks during their normal routine."),
  kt(3, "Survey", "A questionnaire sent to a sample of people, giving breadth and numbers but only self-reported answers."),

  // Week 4: Define
  kt(4, "Empathy map", "A chart of one user's experience split into what they say, think, do and feel."),
  kt(4, "Journey map", "A timeline of a user's steps, emotions and pain points as they pursue a goal, showing where frustration builds."),
  kt(4, "POV statement", "A point of view statement that frames the problem as a user, their need and an insight, without prescribing a solution."),
  kt(4, "How might we question", "A question that turns a problem into an invitation to ideate, naming the need and outcome but not the solution."),

  // Week 5: Develop
  kt(5, "Divergent thinking", "Generating many options without judging them, to widen the range of ideas."),
  kt(5, "Convergent thinking", "Evaluating, combining and choosing among options to narrow towards a solution."),
  kt(5, "Crazy 8s", "A sketching exercise of eight distinct ideas in eight minutes, using time pressure to push past the obvious."),
  kt(5, "Storyboard", "A comic-strip sequence of frames showing how a solution fits a user's context and actions over time."),
  kt(5, "Dot voting", "A converging technique where each person silently places a few votes on ideas, revealed together so nobody copies the loudest voice."),
  kt(5, "Impact versus effort matrix", "A two-by-two grid for prioritising ideas, where high-impact, low-effort ideas usually come first."),

  // Week 6: Deliver and prototyping
  kt(6, "Low-fidelity prototype", "A rough paper sketch or greyscale wireframe used to test structure, navigation and flow cheaply."),
  kt(6, "High-fidelity prototype", "A prototype that looks and behaves like the real product, suited to questions about visual detail, timing and feel."),
  kt(6, "Vertical prototype", "A narrow, deep prototype that builds one feature in full working depth, unlike a broad, shallow horizontal one."),
  kt(6, "Throwaway prototype", "A quick prototype built only to learn something, then discarded rather than grown into the product."),

  // Week 7: evaluation and user testing
  kt(7, "Formative evaluation", "Evaluation during design that aims to find and fix problems, unlike summative evaluation, which measures final performance."),
  kt(7, "Five-user rule", "Nielsen's finding that about five users per round reveal most usability problems, so several small rounds beat one big test."),
  kt(7, "Severity rating", "A score from 0 to 4 for a usability problem, based on its frequency, impact and persistence."),
  kt(7, "Visibility of system status", "Nielsen's heuristic that a system should always keep users informed through timely feedback."),
  kt(7, "Recognition rather than recall", "Nielsen's heuristic that options and information should stay visible so users don't have to remember them."),

  // Week 8: quantitative and qualitative analysis
  kt(8, "Ordinal data", "Ordered categories with unequal gaps, such as a Likert item, best summarised with medians and frequencies."),
  kt(8, "Ratio data", "Data with equal intervals and a true zero, such as task time in seconds."),
  kt(8, "Paired-samples t-test", "A test comparing two means when the same participants try both designs."),
  kt(8, "Independent-samples t-test", "A test comparing two means from separate groups, each trying only one design."),

  // Week 9: affordances
  kt(9, "Constraint", "A design feature that limits the possible actions to prevent errors, such as a plug that fits only one way."),
  kt(9, "Natural mapping", "Arranging controls to mirror what they affect, such as stove knobs laid out like the burners."),
  kt(9, "Feedback", "Immediate information confirming the result of an action, such as a pressed state or a spinner."),
  kt(9, "False affordance", "A cue suggesting an action that isn't possible, such as underlined text that isn't a link."),
  kt(9, "Hidden affordance", "A possible action with no visible cue, such as swipe-to-delete with no hint."),

  // Week 10: models and metaphors
  kt(10, "Gulf of evaluation", "The gap between the system's state and the user's ability to tell whether their goal was met."),
  kt(10, "Conceptual model", "The designer's simplified account of how a system works, which they hope users will share."),
  kt(10, "System image", "Everything a user can see and experience of a system, the only bridge between the designer's model and the user's."),
  kt(10, "Interface metaphor", "A familiar real-world concept borrowed by an interface, such as the desktop, folders and trash, so users can transfer what they know."),

  // Week 11: design for all
  kt(11, "Social model of disability", "The view that disability comes from a mismatch between a person and their environment, which design can reduce."),
  kt(11, "Universal design", "Designing products to be usable by everyone, as far as possible, without adaptation."),
  kt(11, "Inclusive design", "Design that recognises exclusion and learns from human diversity, summed up as solve for one, extend to many."),
  kt(11, "Situational impairment", "A limitation caused by circumstances rather than the body, such as holding a baby in one arm."),
  kt(11, "Assistive technology", "Hardware or software, such as screen readers, magnifiers and switches, that helps disabled people use computers."),

  // Week 12: interfaces of tomorrow
  kt(12, "Ubiquitous computing", "Mark Weiser's vision of computers that fade into the background of everyday life."),
  kt(12, "Hick's law", "Decision time grows logarithmically with the number of equally likely choices."),
  kt(12, "Discoverability", "How easily users can find out what actions are possible, a key challenge for voice interfaces with no visible menu."),
  kt(12, "Calibrated trust", "Trust in an AI system that matches how reliable it really is, neither too much nor too little."),
  kt(12, "Deceptive pattern", "An interface design that manipulates users against their interests, such as making cancelling far harder than signing up."),
];

/**
 * CSE2UI User Interface Design: ready-made weekly lectures (2026 Semester 2),
 * taught by the fictional Professor Iris Thornquill. Each week teaches the
 * concepts that the CSE2UI question bank in banks/latrobeBanks.ts tests for
 * that week. Videos were verified via YouTube oEmbed (title and channel).
 */

import type { SubjectLectures } from "./types";

export const CSE2UI_LECTURES: SubjectLectures = {
  match: (code, name) => /^CSE2UI/i.test(code) || /user interface design/i.test(name),
  professor: {
    name: "Professor Iris Thornquill",
    title: "Professor of Interaction Design",
    style:
      "Warm, playful and curious; collects photos of terrible doors and confusing kettles, and argues with the class (nicely).",
  },
  weeks: {
    1: {
      title: "Why User Interface Design Matters",
      hook: "Every app you used today was designed by someone who either understood you or guessed about you. This week we look at the difference that makes, and the core ideas this whole subject rests on.",
      objectives: [
        "Explain what a user interface is and how UI design differs from UX design",
        "Define usability using ISO 9241-11: effectiveness, efficiency and satisfaction in a context of use",
        "Describe what poor interfaces cost users and organisations",
        "Analyse any interface in terms of its users, tasks and context",
      ],
      segments: [
        {
          heading: "What is a user interface?",
          narration:
            "Hello, and welcome to User Interface Design! I'm Professor Iris Thornquill, and before we go any further, I have a confession. I collect photographs of terrible doors. And confusing kettles. My phone is full of them, and by the end of this semester, I suspect yours will be too. So let's start with a simple question: what actually is a user interface? It's the place where a person and a computer system meet. Everything you can see, hear or touch to tell the system what you want, and everything the system uses to tell you what happened. Screens, buttons and menus, yes, but also beeps, vibrations, voice commands, even the dial on a microwave. Think of it as a conversation. You act, the system answers. And here's the bit I really want you to remember. Your users never see your database or your beautiful code. For them, the interface is the system. If the interface is confusing, the whole product feels broken. Which is why this isn't decoration we sprinkle on at the end. It's the main event.",
          points: [
            "The interface is where people and systems meet",
            "Two-way: user input and system feedback",
            "Screens, sound, voice, touch and physical controls",
            "To users, the interface is the system",
          ],
          example:
            "A microwave's keypad, display and beep are all its interface: you press buttons to set the time, the display confirms your input, and the beep tells you the food is ready.",
          visual: {
            kind: "definition",
            term: "User interface",
            definition: "Where a person and a system meet: everything they see, hear or touch",
          },
        },
        {
          heading: "UI design versus UX design",
          narration:
            "Right, let's settle an argument I hear every single year. Is UI the same as UX? Hands up if you've used them interchangeably. Yes, that's most of you, and honestly, so do plenty of job ads. But they're not the same thing. User interface design shapes the elements people directly interact with: the layout, the buttons, the labels, the typography, the way a menu slides open. User experience design is bigger. It's the whole experience someone has with a product or service. Does it meet their needs? Do the steps of a task flow sensibly from start to finish? How satisfied do they feel? It even includes things off the screen, like the confirmation email or the phone call to support. So UI is one part of UX. One touchpoint inside the whole journey. I once ordered a gorgeous lamp from a beautifully designed website. Lovely checkout. Then it arrived three weeks late, in pieces, and nobody answered my emails. Great UI, dreadful experience. In this subject we focus on the interface, but always in service of that bigger experience.",
          points: [
            "UI: the elements people directly interact with",
            "UX: the whole experience, including needs, flows and satisfaction",
            "UI is one part of UX",
            "A polished screen cannot rescue a poor experience",
          ],
          example:
            "A food delivery app might have a clean, attractive ordering screen, which is good UI, yet if it hides delivery fees until the final step, people feel tricked and the overall experience suffers.",
          visual: {
            kind: "compare",
            left: { title: "UI design", items: ["Layout and buttons", "Labels and typography", "Menus and controls"] },
            right: { title: "UX design", items: ["Meeting real needs", "Task flow end to end", "Satisfaction and support"] },
          },
        },
        {
          heading: "Defining usability with ISO 9241-11",
          narration:
            "Now, if we're going to argue about whether an interface is good, we need a definition sharper than I like it. Luckily, the international standard ISO 9241-11 gives us one. It defines usability as the extent to which specified users can achieve specified goals with effectiveness, efficiency and satisfaction in a specified context of use. Let's take those three measures one at a time. Effectiveness: can people actually complete their goal, accurately and completely? Did they book the right appointment, or the wrong one? Efficiency: what did it cost them to get there, in time, effort, steps and errors? Satisfaction: how did they feel? Comfortable, or ready to throw the phone across the room? And now notice those sneaky little words: specified users, specified goals, specified context. Usability isn't something an interface simply has, like a colour. A system can be wonderfully usable for an expert at a desk and nearly impossible for a first-time visitor on a phone in the rain. So whenever someone tells you a design is usable, I want you to ask: for whom, doing what, and where?",
          points: [
            "Effectiveness: can users complete goals accurately and completely?",
            "Efficiency: how much time and effort does it take?",
            "Satisfaction: how do users feel about it?",
            "Always for specified users, goals and context of use",
          ],
          example:
            "For a library self-checkout, effectiveness is whether borrowers end up with the correct books on loan, efficiency is how long it takes and how many errors they make, and satisfaction is whether they would choose the machine over the queue next time.",
          visual: {
            kind: "tree",
            root: "Usability (ISO 9241-11)",
            children: [
              { label: "Effectiveness", children: ["Goals completed", "Accuracy"] },
              { label: "Efficiency", children: ["Time", "Effort and errors"] },
              { label: "Satisfaction", children: ["Comfort", "Acceptability"] },
              { label: "Context of use", children: ["Specified users", "Specified goals", "Environment"] },
            ],
          },
        },
        {
          heading: "The real cost of bad interfaces",
          narration:
            "So why should anyone pay for good interface design? Because bad interfaces are expensive, even when nobody sends you the bill. For users, the cost is wasted time, frustration and mistakes. For organisations, it shows up as support calls, abandoned purchases, training budgets, and customers who quietly wander off to a competitor. And in some places the stakes are much higher. In healthcare, aviation and emergency management, an ambiguous screen or a badly labelled control can contribute to real harm. Now, when something goes wrong, it's very tempting to blame the person who pressed the wrong button. But here's my rule of thumb. If one person makes a mistake, maybe it's them. If lots of people make the same mistake, it's the design. There's also a timing argument. Fixing a sketch costs you a few minutes and an eraser. Fixing a shipped product means redesign, recoding, retesting and retraining. That's really the economic case for everything we'll do this semester: find the problems early, while they're still cheap.",
          points: [
            "Users pay in time, frustration and errors",
            "Organisations pay in support, lost sales and training",
            "In safety-critical domains, poor design can cause harm",
            "Problems are far cheaper to fix early",
          ],
          example:
            "In 2018 a false ballistic missile alert was sent to people across Hawaii after an operator chose the wrong item from a list of similarly worded options, and it took 38 minutes for a correction to be issued.",
          visual: {
            kind: "flow",
            title: "Later fixes cost more",
            steps: ["Sketch", "Prototype", "Built code", "Shipped product"],
          },
        },
        {
          heading: "Users, tasks and context",
          narration:
            "Here's a little ritual I'd like you to adopt. Every time you look at an interface, ask three questions. Who are the users? What tasks are they trying to accomplish? And in what context? Users differ in experience, age, language, abilities, motivation and comfort with technology. A tool for air traffic controllers and a tool for casual shoppers should look completely different, because the people are completely different. Tasks are the goals people are chasing and the steps they take to get there. And notice, people care about goals, like getting paid or finding their class, not about your features. Context is everything around them: noise, lighting, whether they're standing, walking or sitting, the device in their hand, how rushed they are, who's watching. Change any one of those and the right design changes too. I learned this watching my own dad try to pay for parking in the rain, one hand holding an umbrella. Every tiny button suddenly became a personal enemy. Naming users, tasks and context turns vague opinions into reasoning you can actually test.",
          points: [
            "Users: who they are and what they bring",
            "Tasks: the goals people pursue, not features",
            "Context: environment, device, time pressure, social setting",
            "Change one, and the right design changes",
          ],
          example:
            "A parking payment app is used by drivers standing beside their car, often in a hurry, sometimes in rain or bright sun, with one hand holding keys, so large buttons, high contrast and a short flow matter more than visual flair.",
          visual: {
            kind: "tree",
            root: "Analyse any interface",
            children: [
              { label: "Users", children: ["Experience", "Abilities", "Motivation"] },
              { label: "Tasks", children: ["Goals", "Steps"] },
              { label: "Context", children: ["Environment", "Device", "Time pressure"] },
            ],
          },
        },
        {
          heading: "You are not your user",
          narration:
            "Okay, time for some tough love. The most common mistake new designers make is assuming everyone thinks like they do. And let's be honest, you're not typical users. You're computing students. You know what a hamburger menu is. You tolerate jargon. You poke around unfamiliar apps for fun. Many of your users won't. Design for yourself and you'll build something that makes perfect sense to your team and baffles everyone else. Trap number two: blaming users. If people keep missing a button or misreading a label, they're not being careless. They're showing you, very helpfully, exactly where your design communicates badly. Trap number three: believing people read instructions. Do you read instructions? No? Neither does anyone else. People skim, guess and try things, so the interface itself has to show what's possible. Early in my career I designed a booking form I was terribly proud of. Then I watched five people use it, and four of them got lost on the very first screen. Humbling. The cure for all three traps is the same: evidence. Go and watch real people.",
          points: [
            "Designers are not typical users",
            "Repeated user errors point to design problems",
            "People skim and guess rather than read instructions",
            "Replace opinions with evidence from real users",
          ],
          example: "",
        },
        {
          heading: "The road map for this subject",
          narration:
            "Let me give you the map for the semester, because every week builds on the last one. Next week we dig into human-centred design, the philosophy of involving users all the way through, along with usability and accessibility. Then we spend four weeks walking through a design process called the Double Diamond. Discover, where you research people and their context. Define, where you turn that research into a clear problem. Develop, where you generate and compare lots of ideas. And Deliver, where you prototype and refine. After that, we learn to evaluate designs with real users and expert inspection, and to analyse what we find, with both numbers and words. Then we get a bit more theoretical: affordances and signifiers, which is where my door collection finally earns its keep, then mental models and metaphors, and design for all. We finish by peeking at the interfaces of tomorrow. As we go, please apply everything to your own project. Theory sticks when you use it. Right, that's our first session done. Next week, I'll tell you about a parking app that went very wrong. See you then!",
          points: [
            "Foundations: human-centred design, usability, accessibility",
            "Process: Discover, Define, Develop, Deliver",
            "Evaluation and analysis of real user data",
            "Theory: affordances, mental models, inclusion, future interfaces",
          ],
          example: "",
          visual: {
            kind: "timeline",
            title: "The semester ahead",
            events: [
              { label: "Week 2", detail: "Human-centred design" },
              { label: "Weeks 3 to 6", detail: "The Double Diamond" },
              { label: "Weeks 7 to 8", detail: "Evaluation and analysis" },
              { label: "Weeks 9 to 11", detail: "Affordances, models, inclusion" },
              { label: "Week 12", detail: "Interfaces of tomorrow" },
            ],
          },
        },
      ],
      takeaways: [
        "The interface is the part of a system people experience, so to users it is the system.",
        "UI design shapes the interface elements, while UX covers the whole experience; UI is one part of UX.",
        "ISO 9241-11 defines usability as effectiveness, efficiency and satisfaction for specified users and goals in a context of use.",
        "Poor interfaces cost time, money, trust and sometimes safety, and problems are cheapest to fix early.",
        "Always analyse a design through its users, their tasks and their context.",
        "You are not your user, so replace assumptions with evidence from real people.",
      ],
      video: {
        youtubeId: "8PM6KxV8GRc",
        title: "1.  What is UX, anyway?  (ft. Dr. Jakob Nielsen)",
        channel: "NNgroup",
        intro: "To finish, here's Jakob Nielsen himself, one of the founders of our field, explaining what UX really means.",
      },
    },
    2: {
      title: "Basics of Human-Centred Design",
      hook: "Most failed products were not built badly; they were built for the wrong idea of the user. Human-centred design is the discipline that stops that from happening, and accessibility makes sure nobody is left out.",
      objectives: [
        "Explain human-centred design and the principles set out in ISO 9241-210",
        "Describe the iterative human-centred design cycle and where users take part",
        "Distinguish real user needs from stated wants and team assumptions",
        "Apply WCAG's POUR principles and contrast requirements to a design",
      ],
      segments: [
        {
          heading: "The problem with designing from assumptions",
          narration:
            "Welcome back, everyone! Last week we said that to users, the interface is the system, and that you are not your user. Today we find out what to do about it. But first, I promised you a story. Imagine a team building a parking app for a city council. The developers are confident they know what drivers want, so they build the whole thing from their own assumptions, polish it beautifully, and only see real drivers use it on launch day. And then the complaints roll in. Drivers can't find their zone number. The payment screen times out while they dig around for a card. Lots of older residents simply give up. Now here's the painful part. None of that was hard to discover. Nobody looked. This pattern, designing in isolation and checking with users only at the very end, is one of the most common causes of usability failure. By launch day every assumption has been coded and deployed, so fixing it is slow and expensive. Human-centred design exists to break that pattern. Its central idea is simple: involve real users early and often, and let what you learn shape the design before it sets like concrete.",
          points: [
            "Designing only from team assumptions is risky",
            "Testing first at launch makes fixes slow and costly",
            "Problems were discoverable, just never looked for",
            "Involve users early and often",
          ],
          example: "",
          visual: {
            kind: "compare",
            left: { title: "Assumption-driven", items: ["Built from team guesses", "First tested at launch", "Costly late fixes"] },
            right: { title: "Human-centred", items: ["Users involved early", "Tested in rounds", "Cheap early fixes"] },
          },
        },
        {
          heading: "What human-centred design means",
          narration:
            "So, what is human-centred design? It's an approach that involves users throughout the design process and iterates based on evaluation with them. Let me underline two words there. Throughout. And iterates. Throughout means users aren't consulted once at the start and then politely forgotten, and they're not wheeled in for a single test at the end either. They shape the research, they react to rough sketches, they try out prototypes. Iterates means the design moves in loops. Make something, test it with users, see what breaks, improve it, and go round again. The international standard that describes this for interactive systems is ISO 9241-210. You'll also hear people say user-centred design, which means much the same thing, so don't let the two names confuse you. And here's what I love about it. It flips the question a team asks. Instead of saying, look at this shiny technology, what can we build with it, the team asks, what do these people actually need, and how might technology help? Technology becomes the means. Human needs become the goal. That's a big shift, and it's surprisingly rare.",
          points: [
            "Users involved throughout, not just at the start or end",
            "Design iterates based on evaluation with users",
            "Standardised in ISO 9241-210",
            "Human needs are the goal; technology is the means",
          ],
          example: "",
          visual: {
            kind: "definition",
            term: "Human-centred design",
            definition: "Involves users throughout design and iterates based on evaluation with them",
          },
        },
        {
          heading: "The principles of ISO 9241-210",
          narration:
            "ISO 9241-210 gives us six principles, and I want you to know them well enough to spot when one's been broken. Ready? One: the design is based on an explicit understanding of users, their tasks and their environments. Written down, not just floating around in someone's head. Two: users are involved throughout design and development. Three: the design is driven and refined by user-centred evaluation, so evidence decides what changes, not the loudest person in the meeting. We've all met that person. Four: the process is iterative, because nobody gets it right first time, and every round of feedback teaches you something new. Five: the design addresses the whole user experience, including how people feel, not just whether a button technically works. And six: the team brings multidisciplinary skills and perspectives: developers, designers, domain experts, and users themselves. Now let's use them as a diagnostic tool. Remember our parking app, tested for the first time on launch day? Which principles did it break? That's right. Users weren't involved throughout, and the design was never refined through evaluation. Great code can't save a project that skips those two.",
          points: [
            "Explicit understanding of users, tasks and environments",
            "Users involved throughout; design driven by evaluation",
            "Iterative process addressing the whole experience",
            "Multidisciplinary team",
          ],
          example:
            "A hospital booking kiosk designed entirely from developer assumptions and first tested on opening day breaks the principles of user involvement throughout and evaluation-driven iteration, even if its code is excellent.",
          visual: {
            kind: "stack",
            title: "ISO 9241-210 principles",
            layers: [
              "Explicit understanding of users",
              "Users involved throughout",
              "Driven by user evaluation",
              "Iterative process",
              "Whole user experience",
              "Multidisciplinary team",
            ],
          },
        },
        {
          heading: "The human-centred design cycle",
          narration:
            "So what does human-centred design look like day to day? ISO 9241-210 describes a loop, and I'm going to draw it as a circle because, well, it is one. You start by planning the human-centred process. Then you understand and specify the context of use: who the users are, what they're trying to achieve, and the conditions they're working in. Next, you specify the user requirements, meaning what the design must let people do and what standards it has to meet. Then you produce design solutions, rough at first, more refined as you go. And then you evaluate those designs against the requirements, ideally with real users. Does it meet them? Wonderful, you're done. Doesn't it? Which, let me tell you, is the normal outcome on the first pass. Then you loop back to whichever step needs work. Maybe you misunderstood the context. Maybe a requirement was missing. Maybe the design just needs another go. The big insight here is that evaluation isn't a final exam you sit at the end. It's the engine that pushes the design forward, round after round after round.",
          points: [
            "Understand and specify the context of use",
            "Specify user requirements",
            "Produce design solutions, then evaluate them",
            "Loop back until requirements are met",
          ],
          example: "",
          visual: {
            kind: "cycle",
            title: "The HCD activity cycle",
            steps: ["Understand context of use", "Specify user requirements", "Produce design solutions", "Evaluate against requirements"],
          },
        },
        {
          heading: "Needs, wants and what users say",
          narration:
            "Now, designing around users does not mean doing whatever users ask for. I know, that sounds contradictory, so stay with me. People are experts in their own lives and problems. They're not usually experts in design solutions. Ask someone what they want and they'll often describe a small tweak to something they already know, or a feature they saw in another app. Your job is to dig underneath the request to the need. A need is the goal or the problem behind the words. My niece once told me her study app needed a bigger calendar. When I watched her use it, it turned out what she really needed was to see when two assignments clashed, at a glance. A bigger calendar wouldn't have helped one bit. Different problem, different solution. And some needs nobody ever says out loud, like being able to use an app with one hand on a crowded tram. That's why human-centred design watches behaviour as well as listening to words. And it ties straight back to last week: we're aiming for designs that meet real needs effectively, efficiently and satisfyingly, in their real context.",
          points: [
            "Users are experts in their problems, not in solutions",
            "Look beneath requests to the underlying need",
            "Some needs are never said aloud",
            "Watch behaviour as well as listening",
          ],
          example:
            "Commuters asked for a bigger timetable on a transit app, but observation showed their real need was knowing whether they would make their connection, which a simple countdown solved better.",
          visual: {
            kind: "compare",
            left: { title: "Stated want", items: ["A bigger calendar", "A feature from another app"] },
            right: { title: "Underlying need", items: ["Spot clashes at a glance", "The goal behind the request"] },
          },
        },
        {
          heading: "Accessibility and the POUR principles",
          narration:
            "If human-centred design is about real users, then it has to include users with disabilities. Otherwise we're designing for some users and pretending it's everyone. Accessibility means people with a wide range of abilities can perceive, understand, navigate and interact with a system. Disability can involve vision, hearing, movement, speech or cognition, and many of us will experience some impairment at some point, especially as we get older. Yes, even you, sitting there with your perfect eyesight. The main international guideline for digital accessibility is the Web Content Accessibility Guidelines, WCAG for short, published by the World Wide Web Consortium. WCAG is built on four principles, with a handy acronym: POUR. Perceivable: information has to be presented in ways people can sense, like text alternatives for images and captions for video. Operable: every function must be usable, for example with a keyboard alone. Understandable: content and behaviour are clear and predictable. Robust: it works reliably across different browsers and assistive technologies, like screen readers. Every single WCAG success criterion sits under one of those four. So pour them into your memory. Sorry. I had to.",
          points: [
            "Perceivable: information people can sense",
            "Operable: every function can be used",
            "Understandable: clear, predictable content and behaviour",
            "Robust: works with browsers and assistive technology",
          ],
          example: "",
          visual: {
            kind: "tree",
            root: "WCAG: POUR",
            children: [
              { label: "Perceivable", children: ["Text alternatives", "Captions"] },
              { label: "Operable", children: ["Keyboard access"] },
              { label: "Understandable", children: ["Clear and predictable"] },
              { label: "Robust", children: ["Works with assistive tech"] },
            ],
          },
        },
        {
          heading: "Colour contrast in practice",
          narration:
            "Let's get practical with one of the most common accessibility failures out there: poor colour contrast. You've seen it. Pale grey text on white that looks terribly elegant in a portfolio and is a nightmare on a phone at the beach. It's hard for people with low vision, for many older users, and honestly for all of us in bright sunlight. WCAG measures contrast as a ratio between the lighter and darker colour, based on their relative luminance. It runs from one to one, which is no contrast at all, up to twenty-one to one, which is pure black on pure white. There are three conformance levels: A, double A and triple A. Most organisations, and many laws, aim for double A. At double A, normal-size text needs a contrast ratio of at least four point five to one. Large text, roughly eighteen point regular or fourteen point bold, only needs three to one, because bigger letters are easier to read. And the stricter triple A level asks for seven to one for normal text. Please don't guess by eye. Contrast checker tools calculate the ratio for any pair of colours in seconds.",
          points: [
            "Contrast ratios run from 1 to 1 up to 21 to 1",
            "Double A: 4.5 to 1 for normal text",
            "Double A: 3 to 1 for large text",
            "Triple A: 7 to 1 for normal text",
          ],
          example:
            "Grey text with the hex value 767676 on white measures about 4.5 to 1, just passing double A, whereas the lighter grey 999999 measures roughly 2.8 to 1 and fails.",
          visual: {
            kind: "formula",
            formula: "Contrast = (L lighter + 0.05) ÷ (L darker + 0.05)",
            steps: [
              "Black on white: 1.05 ÷ 0.05 = 21 to 1",
              "Grey 767676 on white: 1.05 ÷ 0.231 ≈ 4.5 to 1",
              "AA: 4.5 to 1 normal text, 3 to 1 large text",
              "AAA: 7 to 1 for normal text",
            ],
          },
        },
        {
          heading: "Applying human-centred design to your project",
          narration:
            "So what does all this mean for your own project? Let me give you five habits. First, never let a design get polished before a real person has tried it. Show rough sketches to potential users in the first few weeks, not just at the end. Second, write down your understanding of users, tasks and context, explicitly, so your team can challenge it. Third, plan for iteration. Expect your first design to be wrong in places, and budget time to fix it. Fourth, build accessibility in from the start. Pick a colour palette that passes contrast, make sure everything works with a keyboard, and label your form fields properly. Retrofitting accessibility at the end is miserable, I promise you. Fifth, when you justify a design decision in a report, point to evidence from users or a recognised standard, not to personal taste. I like blue is not a rationale. That shift from opinion to evidence is what human-centred design is really about. Next week, we put on our explorer hats and go out into the world to discover what problems people actually have. Bring your curiosity. See you then!",
          points: [
            "Test rough designs with real people early",
            "Write down users, tasks and context explicitly",
            "Plan time for iteration",
            "Build accessibility in from the start",
          ],
          example: "",
        },
      ],
      takeaways: [
        "Human-centred design involves users throughout design and iterates based on evaluation with them.",
        "ISO 9241-210 sets six principles, including explicit understanding of users, involvement throughout, evaluation-driven design and iteration.",
        "Evaluation is the engine of design, not a final test at launch.",
        "Look beneath what users ask for to the needs behind it.",
        "WCAG rests on four principles: perceivable, operable, understandable and robust.",
        "At WCAG double A, normal text needs 4.5 to 1 contrast and large text 3 to 1; triple A asks for 7 to 1.",
      ],
      video: {
        youtubeId: "sN_g8FnziLw",
        title: "Design Thinking 101",
        channel: "NNgroup",
        intro: "Here's a short video on design thinking, which puts today's human-centred ideas into a practical process; watch how often users come back into the loop.",
      },
    },
    3: {
      title: "Design Process Part 1: Discover",
      hook: "The fastest way to waste a semester is to solve the wrong problem beautifully. Discover is where you find out what the real problem is, by going to the people who live with it.",
      objectives: [
        "Describe the Double Diamond and its pattern of divergence and convergence",
        "Choose suitable research methods, such as contextual inquiry, interviews and surveys, for a research question",
        "Write unbiased, open interview questions focused on real past behaviour",
        "Record research evidence ethically, separating observations from interpretations",
      ],
      segments: [
        {
          heading: "The Double Diamond",
          narration:
            "Good morning, explorers! Last week we learned that human-centred design means involving users throughout and iterating on what we learn. Today we start putting that into practice, with a process model you'll use for the next four weeks: the Double Diamond, introduced by the UK Design Council. Picture two diamonds sitting side by side. The first diamond is all about the problem, and it holds two phases, Discover and Define. The second diamond is about the solution, and it holds Develop and Deliver. Now, why diamonds? Because of the shape. Each diamond opens out and then narrows in. Discover is divergent: you go wide, gathering understanding without settling on answers. Define is convergent: you narrow all that down into one clear problem. Then Develop opens up again, exploring lots of possible solutions, and Deliver narrows those down to one you test and refine. So, quick check. Which two phases diverge? Discover and Develop. And which two converge? Define and Deliver. Lovely. In real life you'll loop back, because testing often reveals something you misunderstood. But the rhythm of open, close, open, close still holds.",
          points: [
            "First diamond: the problem. Second diamond: the solution",
            "Discover and Develop diverge, opening up options",
            "Define and Deliver converge, narrowing down",
            "Real projects loop back between phases",
          ],
          example: "",
          visual: {
            kind: "flow",
            title: "The Double Diamond",
            steps: ["Discover (diverge)", "Define (converge)", "Develop (diverge)", "Deliver (converge)"],
          },
        },
        {
          heading: "The purpose of Discover",
          narration:
            "Discover starts with a bit of humility. Say someone hands you a brief: build an app to help students manage deadlines. Sounds clear, doesn't it? But right now you don't actually know whether deadlines are the real problem, who struggles most, or why. The goal of Discover is to understand the people, their tasks and their context so deeply that the real problem can show itself. And that means resisting, really resisting, the urge to sketch solutions. I know. It's so tempting. But the moment you fall in love with an idea, you start noticing only the evidence that agrees with you. I've done it. Everyone has. So instead, write research questions. What do students do right now to track deadlines? Where does that break down? Which tools, people and habits are involved? Then pick methods that can answer those questions. Some methods tell you what people think and feel. Others show you what they actually do. Good Discover work usually mixes both, plus some desk research: looking at existing products, competitors, and anything already published about the domain.",
          points: [
            "Understand people, tasks and context first",
            "Resist jumping to solutions",
            "Write research questions, then pick methods",
            "Combine what people say with what they do",
          ],
          example: "",
          visual: {
            kind: "flow",
            steps: ["Brief", "Research questions", "Choose methods", "Gather evidence"],
          },
        },
        {
          heading: "What people say versus what they do",
          narration:
            "Here's one of my favourite truths in user research. What people say and what people do are often two very different things. And no, it's not because people lie. It's because so much of our everyday behaviour is tacit. It's become so automatic we don't even notice it any more. Ask someone how they do their job and they'll describe the official process, beautifully. Then watch them do it, and you'll see sticky notes all over the monitor, a secret spreadsheet on the side, a colleague they always phone, and steps they skip when they're busy. I once watched a receptionist keep a paper notebook next to a brand-new booking system, because the system couldn't show two days at once. She never mentioned it in her interview. Why would she? To her it was just how things were done. Those workarounds are pure gold, because every one marks a place where the current system is failing. That's why research methods split into attitudinal ones, like interviews and surveys, which capture what people say, and behavioural ones, like observation, which capture what they do. Want the tacit stuff? You have to watch.",
          points: [
            "Much behaviour is tacit and goes unreported",
            "Workarounds reveal where systems fail",
            "Attitudinal methods capture what people say",
            "Behavioural methods capture what people do",
          ],
          example: "",
          visual: {
            kind: "compare",
            left: { title: "What people say", items: ["The official process", "Idealised summaries", "Captured by interviews"] },
            right: { title: "What people do", items: ["Workarounds", "Tacit, skipped steps", "Seen through observation"] },
          },
        },
        {
          heading: "Observation and contextual inquiry",
          narration:
            "So how do you watch well? Enter one of my favourite methods: contextual inquiry. It means observing and interviewing people in their real environment while they do their actual work. It was developed by Hugh Beyer and Karen Holtzblatt, and they describe the relationship as master and apprentice. The participant is the master who knows the work inside out. You're the apprentice, there to learn. You watch them do real tasks, and when something interesting happens, you ask about it right then and there. Why did you write that down? What would happen if you skipped that step? There are four guiding principles. Context: go where the work happens. Partnership: treat the participant as a collaborator, not a lab rat. Interpretation: check your understanding with them on the spot. And focus: keep a clear research question in your head so you don't drift. Because you're there when the behaviour happens, you catch the tacit steps and workarounds that people would never think to mention in a meeting room or a survey. Remember my receptionist and her notebook? Contextual inquiry is exactly how you find her.",
          points: [
            "Observe and interview in the real environment",
            "Master and apprentice relationship",
            "Principles: context, partnership, interpretation, focus",
            "Reveals tacit steps and workarounds",
          ],
          example:
            "Researching a warehouse picking app, a researcher spends a shift beside pickers and notices they write order numbers on their gloves because the scanner screen clears too quickly, a workaround nobody raised in interviews.",
          visual: {
            kind: "definition",
            term: "Contextual inquiry",
            definition: "Observing and interviewing people in their real environment while they work",
          },
        },
        {
          heading: "Interviewing without bias",
          narration:
            "Interviews are brilliant for exploring motivations and feelings, but the way you ask shapes what you hear. Let me act out a few bad questions, and you tell me what's wrong. Wouldn't it be easier with a one-tap button? That's leading. You've planted the answer, and most people are too polite to disagree. Is it annoying when the page reloads? That one assumes an opinion and nudges them towards it. Would you use a feature that did this? Hypothetical. People are famously bad at predicting their own future behaviour, me included. I'm going to the gym more next year, apparently. And my personal favourite: isn't our new design amazing? Please never ask that. So what works? Open questions about specific past behaviour. Ask them to tell you about the last time they did the task, then follow the story. What happened next? Why did you do that? Real, recent events give you real detail instead of tidy, idealised summaries. Then listen far more than you talk, get comfortable with silence, and never, ever pitch your own ideas in a research interview.",
          points: [
            "Avoid leading, opinion-assuming and hypothetical questions",
            "Ask open questions about specific past behaviour",
            "Follow up with what happened next, and why",
            "Listen more, talk less, never pitch",
          ],
          example:
            "Instead of asking a shopper whether checkout is annoying, ask them to walk you through the last time they bought something online, then follow up on each step they describe.",
          visual: {
            kind: "compare",
            left: { title: "Avoid", items: ["Leading questions", "Assumed opinions", "Hypotheticals"] },
            right: { title: "Ask instead", items: ["Open questions", "The last time you did it", "What happened next?"] },
          },
        },
        {
          heading: "Surveys and other methods",
          narration:
            "Interviews and observation give you depth, but only with a handful of people. Surveys give you breadth. You can reach hundreds of people quickly and find out how common a behaviour or attitude really is. Sounds perfect, right? Well, here's the catch. Surveys only capture what people report, and only in answer to the questions you thought to ask. So they work best after your qualitative research has shown you what's worth asking about. And they're a terrible tool for uncovering tacit workarounds, because people can't report what they don't notice. There are other methods in the toolkit too. Diary studies, where participants record their experiences over days or weeks, are great for behaviour that unfolds slowly over time. Analytics and support logs show what people actually do, at scale, in an existing product. Competitor and desk research shows what already exists. No single method tells the whole story. So strong research uses triangulation: combining methods, so that a finding you heard in interviews, saw in observation, and measured in a survey becomes something you can genuinely trust and build on.",
          points: [
            "Surveys give breadth but only self-reported answers",
            "Diary studies capture behaviour over time",
            "Analytics, logs and desk research add context",
            "Triangulate across several methods",
          ],
          example: "",
          visual: {
            kind: "matrix",
            title: "Choosing research methods",
            rowLabel: "Data",
            colLabel: "Focus",
            rows: ["Qualitative", "Quantitative"],
            cols: ["Attitudinal (say)", "Behavioural (do)"],
            cells: [
              ["Interviews", "Contextual inquiry"],
              ["Surveys", "Analytics"],
            ],
          },
        },
        {
          heading: "Gathering evidence responsibly",
          narration:
            "Last thing today, and it's an important one. Research is only useful if you capture it well and treat people properly. Before any session, explain what you're doing, get informed consent, and make it clear people can stop at any time. Ask before you record audio or video, and store the data securely. During the session, take notes that separate observations from interpretations. An observation is what you saw or heard: she scrolled past the button three times. An interpretation is what you think it means: the button isn't noticeable. Keep both, but label them, because interpretations are hypotheses that need more evidence. Grab direct quotes whenever you can. They carry the user's voice into later team discussions far better than your paraphrase ever will. By the end of Discover, you should have a gloriously messy pile of evidence: notes, quotes, photos of workspaces, observed problems. You won't have neat answers yet, and that's completely fine. Next week, we tackle that messy pile and turn it into real insight, with sticky notes. Lots of sticky notes. Stock up. See you then!",
          points: [
            "Informed consent and secure data",
            "Separate observations from interpretations",
            "Capture direct quotes and artefacts",
            "End with raw evidence, not neat answers",
          ],
          example: "",
          visual: {
            kind: "compare",
            left: { title: "Observation", items: ["Scrolled past button three times", "A direct quote"] },
            right: { title: "Interpretation", items: ["Button isn't noticeable", "A hypothesis to check"] },
          },
        },
      ],
      takeaways: [
        "The Double Diamond moves through Discover, Define, Develop and Deliver; Discover and Develop diverge, while Define and Deliver converge.",
        "Discover aims to understand people, tasks and context before any solution is chosen.",
        "People rarely report tacit behaviour and workarounds, so observation matters.",
        "Contextual inquiry observes and interviews people in their real environment while they work.",
        "Good interview questions are open, neutral and about specific past behaviour.",
        "Record observations separately from interpretations, with consent and care.",
      ],
      video: {
        youtubeId: "nC47ktX4U2I",
        title: "Contextual Inquiry: Leave Your Office to Find Design Ideas",
        channel: "NNgroup",
        intro: "Before you head out into the field yourselves, here's a short video on contextual inquiry; notice how much they learn just by watching.",
      },
    },
    4: {
      title: "Design Process Part 2: Define",
      hook: "After Discover you are holding a mountain of notes, quotes and observations. This week you learn to turn that mountain into a sharp, shared understanding of the problem worth solving.",
      objectives: [
        "Synthesise research notes into themes using affinity diagramming",
        "Create research-based personas with goals, behaviours and pain points",
        "Write user needs and problem statements that do not prescribe a solution",
        "Frame well-scoped How might we questions to launch ideation",
      ],
      segments: [
        {
          heading: "From data to insight",
          narration:
            "Hello again, and welcome to the week of sticky notes! Last week you went out exploring and came back with a big, messy pile of research. This week, in Define, we turn that pile into something sharp. Define is the convergent half of the first diamond. In Discover you deliberately went wide. Now we narrow. The journey goes from raw data, to patterns, to insights, and finally to a clear statement of the problem. Let me show you the difference. Data is a single observation, like a student saying she missed a deadline because it was buried in a PDF. A pattern appears when you see the same kind of thing across several people. And an insight goes one step further. It explains why the pattern happens, in a way that hints at where design could help. For example: students don't distrust the learning system, they just can't see deadlines from all their subjects in one place. See how that points somewhere? This step is called synthesis. And please do it together, as a team, with your hands and a wall, not one person alone writing a report at midnight.",
          points: [
            "Define converges after Discover diverges",
            "Data, then patterns, then insights",
            "Insights explain why patterns happen",
            "Synthesis is a team activity",
          ],
          example: "",
          visual: {
            kind: "flow",
            title: "Synthesis",
            steps: ["Raw data", "Patterns", "Insights", "Problem statement"],
          },
        },
        {
          heading: "Affinity diagramming",
          narration:
            "The workhorse of synthesis is the affinity diagram, which simply means clustering research notes into themes to find patterns. Here's how I run one. First, every single observation, quote or problem goes onto its own sticky note. One idea per note. I'm strict about this, because you need to be able to move ideas around independently. Then everything goes up on a wall, physical or digital, and you start grouping notes that feel related. Here's the crucial bit: you don't decide the categories in advance. Affinity diagramming is bottom-up. The themes emerge from the data. You're not sorting notes into boxes you'd already built in your head. Once clusters form, you give each one a label that says what it's telling you, ideally in the users' voice. Then you look for bigger groups of clusters. Do it as a team, and do the first round mostly in silence, which is hilarious to watch, by the way: a room full of people silently shuffling sticky notes. But it means everyone's reading of the data counts, not just the loudest voice. The result is a map of what your research is really saying.",
          points: [
            "One observation per note",
            "Group bottom-up: themes emerge from the data",
            "Label clusters with what they say",
            "Work as a team to avoid one person's bias",
          ],
          example:
            "After fifteen interviews about meal planning, a team writes three hundred notes, and clusters emerge such as shopping lists get lost, cooking for different dietary needs, and food wasted at the end of the week.",
          visual: {
            kind: "flow",
            title: "Affinity diagramming",
            steps: ["One note per idea", "Group bottom-up", "Label clusters", "Find bigger themes"],
          },
        },
        {
          heading: "Personas",
          narration:
            "Once you've found your patterns, you need a way to keep real people in the room during design. Enter the persona: an archetypal user synthesised from research, with goals, behaviours and pain points. Let's take that apart. Archetypal means the persona represents a pattern shared by a group of users. It's not one real customer you picked to stand in for everyone. Synthesised from research means every detail traces back to evidence you actually collected, not guesses. A persona is also not a marketing segment, like a particular age and income bracket, because demographics tell you nothing about what people are trying to do or what gets in their way. And, my pet hate, it is definitely not the designer's own preferences wearing a name badge. I once reviewed a student persona who loved minimalist design, cold brew, and the exact app that student wanted to build. Funny coincidence, that. A good persona has a name and a short story so it's memorable, but the real value is in its goals, behaviours and frustrations. Most projects need just a few, often with one primary persona whose needs come first.",
          points: [
            "Archetypal: represents a pattern, not one real person",
            "Built from research evidence, not guesses",
            "Not a demographic segment or the designer's tastes",
            "Core content: goals, behaviours, pain points",
          ],
          example:
            "Priya, a part-time student who works evening shifts, wants to stay on top of assessments, usually checks her phone on the bus, and is frustrated that deadlines are scattered across subject pages; every detail comes from patterns seen in several interviews.",
          visual: {
            kind: "definition",
            term: "Persona",
            definition: "An archetypal user synthesised from research, with goals, behaviours and pain points",
          },
        },
        {
          heading: "Using personas, empathy maps and journey maps",
          narration:
            "So you've made a persona. Now what? Personas are a communication tool. When your team is arguing about whether to add a feature, a good persona changes the question from what do I like, to what would she need. That keeps decisions grounded in research instead of taste. To use them well, keep them visible, talk about them by name, and check every design against their goals and pain points. Would Priya actually use this on the bus? There are three traps to watch for. The made-up persona, invented in a meeting with no research, which just dresses up your team's assumptions. The overstuffed persona, with favourite films and star sign, which buries the behaviours that matter under trivia. And the everyone persona, which tries to represent all users and ends up representing nobody. Alongside personas, two other tools are really handy. Empathy maps capture what a user says, thinks, does and feels. And journey maps lay out the steps someone goes through over time, showing the emotional highs and the painful lows along the way. They're wonderful for spotting exactly where things go wrong.",
          points: [
            "Personas shift debates from opinion to user needs",
            "Avoid invented, overloaded or everyone personas",
            "Empathy maps: says, thinks, does, feels",
            "Journey maps: steps, emotions and pain points over time",
          ],
          example: "",
          visual: {
            kind: "tree",
            root: "Define tools",
            children: [
              { label: "Persona", children: ["Goals", "Behaviours", "Pain points"] },
              { label: "Empathy map", children: ["Says", "Thinks", "Does", "Feels"] },
              { label: "Journey map", children: ["Steps over time", "Highs and lows"] },
            ],
          },
        },
        {
          heading: "User needs and problem statements",
          narration:
            "With your themes and personas ready, you can finally state the problem precisely. Let's start with user needs. A need describes what someone is trying to achieve, phrased as a verb, not a feature. The student needs to see all her upcoming deadlines in one place: that's a need. The student needs a calendar widget: that's a solution wearing a need costume. Can you hear the difference? Next, the problem statement, sometimes called a point of view statement. It has three parts: a specific user, their need, and an insight explaining why. For example: a first-year student juggling four subjects needs to know what's due this week, because deadlines are scattered across separate subject pages and easy to miss. Notice what's missing? Any mention of how we'll solve it. That's deliberate. The next phase, Develop, is all about exploring many different solutions. If you sneak a solution into your problem statement now, you skip the creative work and almost certainly miss a better idea. So keep your problem statements solution-free. Your future self will thank you.",
          points: [
            "Needs are goals phrased as verbs, not features",
            "Problem statement: user, need, insight",
            "Keep solutions out of the problem",
            "Leave room for Develop to explore",
          ],
          example: "",
          visual: {
            kind: "compare",
            left: { title: "User need", items: ["See all deadlines in one place", "Phrased as a goal"] },
            right: { title: "Solution in disguise", items: ["Needs a calendar widget", "Phrased as a feature"] },
          },
        },
        {
          heading: "How might we questions",
          narration:
            "Now for my favourite little phrase in all of design: How might we. It's the bridge from Define into Develop, turning a problem statement into an invitation to generate ideas. And every word is doing work. How assumes there's a solution out there to find. Might says we can explore without committing. We says it's a shared effort. A good How might we question names a user need and the outcome you want, but doesn't prescribe a solution. Let's try three. How might we build a timetable dashboard in React? Hmm. Too narrow. You've already picked the technology and the feature, so there's nothing left to explore. How might we improve university life? Too broad. Where would you even start? How might we help new students feel confident about where they need to be each day? Ah, now that's the sweet spot. It focuses on a real user and a real outcome, and it leaves room for loads of different answers: a notification, a campus map, a buddy system, who knows. And if you want to sharpen it further, add a measurable target. Then you'll know when you've succeeded.",
          points: [
            "Turns a problem into an invitation to ideate",
            "Names the user need and desired outcome",
            "Does not prescribe a solution or technology",
            "Neither too narrow nor too broad",
          ],
          example: "",
          visual: {
            kind: "stack",
            title: "Scoping How might we",
            layers: ["Too broad: improve uni life", "Just right: confident new students", "Too narrow: React timetable dashboard"],
          },
        },
        {
          heading: "Common mistakes and your project",
          narration:
            "Before we wrap up, let's look at the mistakes I see most often in Define, so you can dodge them. Number one: skipping synthesis altogether and leaping from interviews straight to features. The team never agrees on what the problem actually is, and it shows. Number two: cherry-picking, only noticing data that supports your favourite idea. Doing affinity diagramming as a group is your best protection. Number three: defining the problem as the absence of your solution. Users lack a chatbot. Do they, though? Or do they lack quick answers? Number four: personas or problem statements with no evidence behind them. So, for your project, aim to walk out of Define with a handful of clear artefacts: an affinity diagram showing your main themes, one or two research-based personas, a short list of user needs, a problem statement, and a few strong How might we questions. Those become your compass for every decision in the second diamond, and they'll make your design rationale so much easier to write. Next week, we finally get to generate ideas. Lots of them. Wild ones. Bring pens. See you then!",
          points: [
            "Don't skip synthesis or cherry-pick data",
            "A problem is not the absence of your solution",
            "Every artefact needs evidence behind it",
            "Leave Define with themes, personas, needs and HMWs",
          ],
          example: "",
          visual: {
            kind: "flow",
            title: "Leave Define with",
            steps: ["Affinity diagram", "Personas", "User needs", "Problem statement", "How might we questions"],
          },
        },
      ],
      takeaways: [
        "Define converges: it turns raw research into patterns, insights and a clear problem.",
        "Affinity diagramming clusters research notes bottom-up so themes emerge from the data.",
        "A persona is an archetypal user synthesised from research, with goals, behaviours and pain points.",
        "User needs are phrased as goals, not features, and problem statements avoid prescribing solutions.",
        "A good How might we question frames a user need and outcome while leaving room for many solutions.",
      ],
      video: {
        youtubeId: "khLWLtxmMGM",
        title: "What are personas and why should I care?",
        channel: "NNgroup",
        intro: "Let's finish with a short explainer on personas; listen for the bit about where the details must come from.",
      },
    },
    5: {
      title: "Design Process Part 3: Develop",
      hook: "Your first idea is almost never your best one. This week is about deliberately generating lots of ideas, then choosing wisely between them.",
      objectives: [
        "Explain divergent and convergent thinking and why ideation defers judgement",
        "Run rapid ideation techniques such as brainstorming and Crazy 8s",
        "Use sketches and storyboards to explore and communicate ideas in context",
        "Compare alternatives against user needs and refine a chosen concept",
      ],
      segments: [
        {
          heading: "Opening the second diamond",
          narration:
            "Hello, idea people! Last week we turned our messy research into personas, problem statements and How might we questions. Well done. This week we cross into the second diamond, and things get fun. Develop is the first half of that diamond, and just like Discover, it's divergent. We've defined the problem clearly, so now we open up again, this time to explore lots of possible solutions. You might be thinking, why not just build the first good idea? Because your first idea is usually the obvious one. The one anyone would have. It's shaped by whatever app you happened to use yesterday. Better solutions tend to come from exploring a wide space, mixing ideas together, and following strange directions for a while. There's a practical reason too. If you only have one idea, you have nothing to compare it with, so how would you know it's any good? Designers say go broad before you go deep. Your inputs this week are your Define artefacts: personas, needs, problem statement and How might we questions. Your outputs are a range of concepts, and eventually one or two worth prototyping.",
          points: [
            "Develop is divergent: explore many solutions",
            "First ideas are usually the obvious ones",
            "Go broad before going deep",
            "Inputs come from Define; outputs are concepts",
          ],
          example: "",
          visual: {
            kind: "flow",
            title: "Develop",
            steps: ["Define artefacts", "Many concepts", "One or two to prototype"],
          },
        },
        {
          heading: "Divergent and convergent thinking",
          narration:
            "Ideation works best when you separate two kinds of thinking. Divergent thinking generates options. It's fast, expansive, and happy to entertain ridiculous ideas. Convergent thinking evaluates options. It's critical, analytical, and focused on choosing. You need both. But here's the problem: they fight each other if you try to do them at the same time. Picture a meeting where every idea gets shot down the moment it's spoken. What happens? People go quiet. They stop sharing anything that might sound silly. So you get fewer ideas, and less varied ones, and the chance of finding a really strong solution drops. I watched this happen once in a workshop. Someone suggested a talking fridge, a colleague rolled his eyes, and the room went silent for ten minutes. That's why ideation sessions defer judgement. Generate first, with criticism parked outside the door, then switch into evaluation mode afterwards. Even a wild idea is valuable during divergence, because it can spark a sensible variation in someone else's head. Honestly, the talking fridge might have led somewhere. Think of it as two meetings: one to make, one to choose.",
          points: [
            "Divergent thinking generates; convergent thinking evaluates",
            "Doing both at once suppresses ideas",
            "Defer judgement to get quantity and variety",
            "Wild ideas can spark practical ones",
          ],
          example: "",
          visual: {
            kind: "compare",
            left: { title: "Divergent", items: ["Generate options", "Fast and expansive", "Wild ideas welcome"] },
            right: { title: "Convergent", items: ["Evaluate options", "Critical and analytical", "Choose the best"] },
          },
        },
        {
          heading: "Brainstorming that works",
          narration:
            "Brainstorming has a bit of a bad reputation, and frankly, it's earned it, because it's so often done badly, with one loud voice running the show. Good facilitation fixes that. The design firm IDEO popularised a set of brainstorming rules that are now used everywhere. Defer judgement, which we just talked about. Encourage wild ideas. Build on the ideas of others, so say yes, and, rather than yes, but. Stay focused on the topic, usually one How might we question. One conversation at a time. Be visual, so sketch, don't just talk. And go for quantity, because a big pool of ideas makes good ones much more likely. I add one more trick of my own. Have everyone generate ideas silently and individually first, for a few minutes, before anyone shares. Why? Because otherwise the whole group anchors on the first idea said out loud, and quieter people never get a word in. Set a time limit and a target number of ideas, too. A little bit of pressure pushes people past the obvious answers and into much more inventive territory.",
          points: [
            "Defer judgement and encourage wild ideas",
            "Build on others' ideas: yes, and",
            "Stay focused, be visual, go for quantity",
            "Generate silently first to avoid anchoring",
          ],
          example: "",
          visual: {
            kind: "stack",
            title: "Brainstorming rules",
            layers: [
              "Defer judgement",
              "Encourage wild ideas",
              "Build on others' ideas",
              "Stay focused, one conversation",
              "Be visual",
              "Go for quantity",
            ],
          },
        },
        {
          heading: "Sketching as thinking",
          narration:
            "Let's talk about sketching, and before anyone panics: no, you do not need to be good at drawing. Boxes, arrows, stick figures, wobbly labels. That's plenty. I draw people as potatoes with legs, and I'm a professor. Sketching matters because it's a way of thinking, not just recording. The moment you put an idea on paper, you have to decide where things go and how they connect, and suddenly you spot the gaps that sounded fine when you were just talking. The researcher Bill Buxton made a lovely point about how sketches differ from prototypes. Sketches are quick, cheap, disposable and plentiful. They suggest and explore. They don't confirm. And because they look unfinished, they invite people to change them, which is exactly what you want right now. Prototypes come later, next week in fact, and they're for testing and refining. The most common mistake I see is jumping straight into a digital design tool. Pixel-perfect tools slow you down and drag your attention to alignment and colours long before you know whether the idea underneath is any good.",
          points: [
            "Sketching is thinking, not artistry",
            "Sketches are quick, cheap, disposable, plentiful",
            "Unfinished looks invite change",
            "Don't jump into pixel-level tools too early",
          ],
          example: "",
          visual: {
            kind: "compare",
            left: { title: "Sketch", items: ["Quick and cheap", "Disposable and plentiful", "Suggests and explores"] },
            right: { title: "Prototype", items: ["More effort", "Specific", "Tests and refines"] },
          },
        },
        {
          heading: "Crazy 8s",
          narration:
            "Here's a technique I absolutely love, and we're going to try it together in the tutorial: Crazy 8s. Take a sheet of paper and fold it in half three times, so you get eight panels. Set a timer for eight minutes. Your job is to sketch eight distinct ideas, one per panel, so about a minute each. Eight ideas, eight minutes. That time pressure is the whole point. With only a minute per idea, there's no time to polish anything. And here's the magic. Your first two or three ideas will be the obvious ones. Everyone's are. But then you've still got five empty panels staring at you, and you're forced to think differently to fill them. Those later panels are often where the interesting stuff lives. Afterwards, everyone shows their sketches briefly, and the group can vote on promising ideas or combine bits from several. It works brilliantly in teams because everyone sketches at the same time, so nobody dominates. You'll often see it in design sprints, followed by a more detailed sketch of the strongest concept. Warning: the first time you do it, panel six will feel impossible. Push through.",
          points: [
            "Fold paper into eight panels",
            "Eight distinct ideas in eight minutes",
            "Time pressure pushes past the obvious",
            "Share, vote and combine afterwards",
          ],
          example:
            "A team designing a bike-share app runs Crazy 8s on helping riders find a free dock, and the eighth panel, where the app reserves a dock while you ride, becomes the concept they go on to test.",
          visual: {
            kind: "flow",
            title: "Crazy 8s",
            steps: ["Fold paper into 8", "Set an 8-minute timer", "Sketch 8 distinct ideas", "Share, vote, combine"],
          },
        },
        {
          heading: "Storyboards",
          narration:
            "Screen sketches show what an interface looks like. But they don't show how a solution fits into somebody's life. For that, we use storyboards. A storyboard is a short sequence of frames, like a comic strip, showing a user in their context working through a scenario over time. Let me tell you one. Frame one: a student on a packed train suddenly remembers an assignment is due. Frame two: she pulls out her phone, one hand on the rail. Frame three: a reminder shows exactly what's due and when. Frame four: she submits from the train, relieved. See what that did? It made us think about where she is, what triggered the need, how she feels, and what happens before and after she touches the screen. That's why storyboards are so valuable in ideation. They communicate the scenario and the flow of actions to your team and stakeholders, and they catch problems early, like an idea that quietly assumes a laptop when the user is actually standing on a crowded platform. What storyboards are not for is pixel spacing or exact layout. Leave that for later.",
          points: [
            "Comic-strip frames showing a scenario over time",
            "Shows context, trigger, feelings and sequence",
            "Communicates the flow to the team",
            "Not for pixel-level detail",
          ],
          example: "",
          visual: {
            kind: "timeline",
            title: "A four-frame storyboard",
            events: [
              { label: "Frame 1", detail: "Remembers assignment on the train" },
              { label: "Frame 2", detail: "Grabs phone, one hand on rail" },
              { label: "Frame 3", detail: "Reminder shows what's due" },
              { label: "Frame 4", detail: "Submits on time, relieved" },
            ],
          },
        },
        {
          heading: "Converging: comparing and refining ideas",
          narration:
            "After all that divergence, it's time to converge. Judgement is allowed back in the room. But it needs structure. We're not voting on which idea looks coolest. Start by clustering similar ideas and combining compatible ones. Then evaluate against criteria that come from your Define work. Does this idea meet your persona's main goals? Does it tackle the pain points in your problem statement? Can you actually build it with the time and technology you have? Two quick techniques. Dot voting, where everyone gets a limited number of votes to place, followed by a discussion of why. And a two-by-two grid of user impact against effort, which makes the quick wins jump out at you. If you can, keep two or three alternatives alive for a while. Comparing alternatives with users tells you far more than testing a single design, because people find it much easier to say which of two options works better than to critique one design in isolation. Then refine your chosen concept until it's concrete enough to prototype. And prototyping, my friends, is exactly where we're going next week. Bring scissors. I'm serious. See you then!",
          points: [
            "Cluster and combine similar ideas",
            "Judge against personas, needs and feasibility",
            "Dot voting and impact versus effort",
            "Compare alternatives, then refine",
          ],
          example: "",
          visual: {
            kind: "matrix",
            title: "Impact versus effort",
            rowLabel: "User impact",
            colLabel: "Effort",
            rows: ["High impact", "Low impact"],
            cols: ["Low effort", "High effort"],
            cells: [
              ["Quick wins", "Big bets"],
              ["Fill-ins", "Avoid"],
            ],
          },
        },
      ],
      takeaways: [
        "Develop is divergent: explore many solutions before committing to one.",
        "Separate generating ideas from judging them, because early criticism reduces the number and variety of ideas.",
        "Crazy 8s means sketching eight distinct ideas in eight minutes to push past the obvious.",
        "Sketches are quick, disposable tools for thinking, not polished deliverables.",
        "Storyboards show how a solution fits the user's context and sequence of actions over time.",
        "Converge using criteria from your research, and compare alternatives rather than judging one idea alone.",
      ],
      video: {
        youtubeId: "bNh54LNUtv8",
        title: "How to Create a UX Storyboard",
        channel: "NNgroup",
        intro: "Here's a short guide to making a UX storyboard; grab a pen and try sketching along, potatoes with legs are absolutely allowed.",
      },
    },
    6: {
      title: "Design Process Part 4: Deliver and Prototyping",
      hook: "A prototype is a question you can hold in your hand. This week you learn to build the right prototype for the question you need answered, and to get it ready for real users.",
      objectives: [
        "Explain the purpose of prototyping in the Deliver phase",
        "Describe fidelity in terms of visual design, content and interaction",
        "Choose low or high fidelity to match what you need to learn",
        "Use paper and Wizard of Oz prototypes, and prepare a prototype for evaluation",
      ],
      segments: [
        {
          heading: "Deliver: converging on a solution",
          narration:
            "Hello, makers! Did everyone bring scissors? Excellent. Last week we generated piles of ideas and converged on the most promising concepts. Today we enter the final phase of the Double Diamond: Deliver. It's convergent, so we're narrowing down. You take your concepts, turn them into prototypes, test them with users, and refine them until one solution is ready to launch. Now, the word deliver is a bit misleading. It doesn't mean ship the first concept and go home early. It means a cycle of building, testing and improving, where every loop shrinks the uncertainty about whether your design actually works. And the tool that makes this possible is the prototype: a representation of a design that lets people experience it and react to it before it's fully built. Here's my golden rule. Every prototype should exist to answer a question. Will people understand the navigation? Can they complete a purchase without help? Do they trust the recommendation? If you can't say what question your prototype answers, you're probably building too much, or building the wrong thing. So, write the question down first. Always.",
          points: [
            "Deliver converges through build, test, refine",
            "A prototype lets people react before it is built",
            "Every prototype answers a specific question",
            "Write the question down first",
          ],
          example: "",
          visual: {
            kind: "cycle",
            title: "The Deliver loop",
            steps: ["Build a prototype", "Test with users", "Learn", "Refine"],
          },
        },
        {
          heading: "What prototypes are for",
          narration:
            "Why do we prototype at all? Three reasons. The first is exploring. Designers build quick prototypes to think an idea through, and often discover problems that were invisible in a sketch. The second is communicating. A prototype shows teammates, clients and developers what you mean far more clearly than any written specification. I once spent two weeks writing a gorgeous twenty-page spec. Then I showed the developers a scrappy clickable mock-up and they understood more in five minutes than from the whole document. Lesson learned. The third reason, and the big one for this subject, is testing. Put the prototype in front of real users and see whether they can use it and whether it meets their needs. The magic of prototypes is cost. Changing a paper screen takes seconds. Changing a coded, deployed feature can take days or weeks. So our goal is to learn as much as possible, as early and as cheaply as possible. And a prototype doesn't have to be complete. It only needs enough of the design to answer the current question. Everything else can be faked, simplified, or left out entirely.",
          points: ["Explore ideas", "Communicate intentions", "Test with real users", "Include only what the question needs"],
          example: "",
          visual: {
            kind: "definition",
            term: "Prototype",
            definition: "A representation of a design that people can experience before it is built",
          },
        },
        {
          heading: "Understanding fidelity",
          narration:
            "Now let's talk fidelity. Prototype fidelity is how closely a prototype resembles the final product in look, content and interaction. And I want you to think of those as three separate dials, not one slider. Visual fidelity is how polished it looks, from wobbly hand-drawn boxes to final colours, fonts and images. Content fidelity is whether you're using realistic text and data, or placeholder labels and filler text. Interaction fidelity is how it responds. Does someone shuffle paper screens around? Do clicks jump between static images? Or does it behave like real software, with animations and validation? You can mix and match. A plain grey wireframe can have totally realistic content and working navigation. There's another useful distinction too. Horizontal prototypes show lots of features, but only at a shallow level. Vertical prototypes implement one feature in real depth. Why does all this matter? Because once you think in dials, you can invest effort exactly where your current question needs it, and nowhere else. That's how you stay fast, and that's how you stay sane.",
          points: [
            "Visual fidelity: how polished it looks",
            "Content fidelity: real or placeholder text and data",
            "Interaction fidelity: how it responds",
            "Horizontal is broad and shallow; vertical is narrow and deep",
          ],
          example: "",
          visual: {
            kind: "tree",
            root: "Prototype fidelity",
            children: [
              { label: "Visual", children: ["Sketch", "Final look"] },
              { label: "Content", children: ["Placeholder", "Realistic"] },
              { label: "Interaction", children: ["Paper swaps", "Working software"] },
            ],
          },
        },
        {
          heading: "Low-fidelity prototypes",
          narration:
            "Right, scissors out. Low-fidelity prototypes are paper sketches, cardboard mock-ups and simple greyscale wireframes. They're fast to make, cheap to change and easy to throw away, and that's their superpower. They're perfect for testing structure and flow: do people understand the navigation, can they find things, can they follow the steps, all before any visual design exists. A classic technique is paper prototyping. You draw each screen on paper, and during the test a team member plays the computer, swapping screens and adding pop-ups whenever the participant taps something. It sounds ridiculous. It works brilliantly. The first time I played the computer, I had sticky notes stuck to my sleeves for emergency error messages. Low fidelity also changes the feedback you get. Because it so obviously looks unfinished, people feel free to criticise it, and they focus on the big questions, like whether the concept makes sense, rather than nitpicking colours and fonts. And because you've invested almost nothing, your team is happy to make big changes. That's exactly the attitude you want early in Deliver.",
          points: [
            "Paper sketches and greyscale wireframes",
            "Best for structure, navigation and flow",
            "Unfinished look invites honest criticism",
            "Cheap to change, so teams change it",
          ],
          example:
            "To check whether students can find course materials in a redesigned portal, a team tests six hand-drawn screens and learns within an afternoon that most participants look under the subject name rather than under a Resources tab.",
          visual: {
            kind: "flow",
            title: "Paper prototype test",
            steps: ["Draw each screen", "Participant taps", "Human computer swaps screen", "Observe and note"],
          },
        },
        {
          heading: "High-fidelity prototypes and their risks",
          narration:
            "High-fidelity prototypes look and behave much like the finished product. You'll usually build them in a design tool such as Figma, or in code. Later in Deliver, they're incredibly valuable for testing things paper can't capture: visual hierarchy, readability, micro-interactions, timing, and whether the final look actually earns people's trust. They're also great for showing developers precisely what you intend. But, and it's a big but, testing with high fidelity too early is risky. Think about it from the participant's side. A polished design looks finished. So people comment on surface details, like a colour or a word, and they hesitate to question the underlying concept. Who wants to tell someone their beautiful work is fundamentally confused? Most people are far too kind. Meanwhile, on your side, you've invested heavily, so big changes feel painful, and the team gets attached to what it's built. That's the sunk cost problem. The result? You learn less and change less, at precisely the moment when big changes would be most valuable. Polish is lovely. Just not yet.",
          points: [
            "Looks and behaves like the real product",
            "Good for visual detail, timing and handover",
            "Too early: feedback skews to surface polish",
            "Sunk cost makes big changes feel expensive",
          ],
          example: "",
          visual: {
            kind: "compare",
            left: { title: "Low fidelity", items: ["Paper and wireframes", "Structure and flow", "Honest criticism", "Cheap to change"] },
            right: { title: "High fidelity", items: ["Looks like the real thing", "Visual detail and timing", "Surface-level feedback", "Costly to change"] },
          },
        },
        {
          heading: "Matching fidelity to the question",
          narration:
            "So the real skill is matching fidelity to what you need to learn. Let's walk through it. If your question is about the concept or the structure, say, does the navigation make sense, or are the steps in a sensible order, go low fidelity. If your question is about a detailed interaction, like whether people notice a validation message or can manage a drag gesture, you need higher interaction fidelity, at least on that bit. If your question is about visual appeal, readability or brand trust, you need high visual fidelity. And content fidelity matters whenever you're testing comprehension, because people react to real words completely differently from filler text. Try testing a pricing page with placeholder prices, and watch the confusion. A rule I live by: use the lowest fidelity that can answer your question, then turn up the fidelity as your remaining questions get more detailed. Over a project, you'll typically move from paper, to clickable wireframes, to polished interactive prototypes, testing at each step and carrying forward only what's been shown to work. Think of it as earning your polish.",
          points: [
            "Concept and structure: low fidelity",
            "Detailed interaction: higher interaction fidelity",
            "Visual appeal and trust: high visual fidelity",
            "Use the lowest fidelity that answers the question",
          ],
          example: "",
          visual: {
            kind: "tree",
            root: "What do you need to learn?",
            children: [
              { label: "Concept or structure", children: ["Low fidelity"] },
              { label: "Detailed interaction", children: ["Higher interaction fidelity"] },
              { label: "Look and trust", children: ["High visual fidelity"] },
              { label: "Comprehension", children: ["Realistic content"] },
            ],
          },
        },
        {
          heading: "Wizard of Oz prototypes",
          narration:
            "Now for my favourite prototyping trick, and it involves a bit of theatre. Sometimes you want to test behaviour that would be expensive or difficult to build: a chatbot that understands natural language, a voice assistant, a clever recommendation engine. Enter the Wizard of Oz prototype. A hidden person simulates the system's behaviour, which hasn't been built yet. The participant interacts with what looks like a working system, while behind the scenes a team member reads what they type or say, and sends back the responses. The name comes from the story where the great and powerful wizard turns out to be an ordinary man behind a curtain. I once spent an afternoon as a fake voice assistant, crouched in a cupboard with a microphone. My voice has never sounded so robotic. But it let us find out whether the concept was useful, what people actually asked for, and how they reacted to different responses, all before writing a single line of code. Two rules, though. The wizard must follow consistent rules, so the system behaves believably. And always debrief participants afterwards about how it really worked.",
          points: [
            "A hidden person simulates unbuilt behaviour",
            "Ideal for chatbots, voice and smart features",
            "Tests usefulness before engineering effort",
            "Keep the wizard consistent; debrief participants",
          ],
          example:
            "To test a library chatbot, a researcher in the next room reads each question as it arrives and types replies following a short script, revealing that most students ask about opening hours and room bookings rather than catalogue searches.",
          visual: {
            kind: "definition",
            term: "Wizard of Oz prototype",
            definition: "A hidden person simulates system behaviour that hasn't been built yet",
          },
        },
        {
          heading: "Preparing a prototype for evaluation",
          narration:
            "Before you test a prototype with users, prepare it carefully. Four checks. First, list the tasks you'll ask people to do, and make sure every path needed to complete them actually works, including the likely wrong turns. Nothing derails a session faster than a dead end that's just a prototype limitation, not a design problem. Participant clicks, nothing happens, everyone stares at each other. Awkward. Second, use realistic content wherever understanding matters. Third, decide what you'll observe and measure, such as whether people complete each task and where they hesitate. Fourth, run a pilot test with a classmate to catch broken links, confusing instructions and timing problems. And remember, it's the prototype being tested, not the participant, and bad news is good news. A test that finds five problems has done its job beautifully. For your project, write down the fidelity you chose and why, linking it to the question you were trying to answer. Markers love that. Next week, we learn how to actually run the evaluation: how to sit beside someone, watch them struggle, and not help. It's harder than it sounds. See you then!",
          points: [
            "Make every task path work, including wrong turns",
            "Use realistic content where meaning matters",
            "Decide what to measure; pilot first",
            "Document why you chose that fidelity",
          ],
          example: "",
        },
      ],
      takeaways: [
        "Deliver converges through cycles of prototyping, testing and refining.",
        "Every prototype should exist to answer a specific question.",
        "Fidelity covers visual design, content and interaction, and these can be mixed.",
        "Low fidelity suits testing structure and navigation; high fidelity suits detailed interaction and visual questions.",
        "Testing high fidelity too early invites surface feedback and makes changes feel costly.",
        "A Wizard of Oz prototype uses a hidden person to simulate behaviour that has not been built.",
      ],
      video: {
        youtubeId: "2tmb1fbRkJ8",
        title: "When is High-fidelity Worth It?",
        channel: "NNgroup",
        intro: "To wrap up, here's a short video on when high fidelity is actually worth the effort; see if it agrees with my earn-your-polish rule.",
      },
    },
    7: {
      title: "Evaluation and User Testing",
      hook: "You cannot tell whether a design works by looking at it. You find out by watching people use it, and by inspecting it against principles that decades of practice have shown matter.",
      objectives: [
        "Plan a usability test with realistic tasks, suitable participants and clear measures",
        "Facilitate a think-aloud session without biasing the participant",
        "Conduct a heuristic evaluation using Nielsen's ten heuristics",
        "Rate problem severity and prioritise design improvements",
      ],
      segments: [
        {
          heading: "Why and how we evaluate",
          narration:
            "Good morning, testers! Last week we built prototypes and got them ready for real people. This week, we put them in front of those people, and we also learn to inspect designs like experts. Evaluation is how we find out whether a design actually works, and remember, it's the engine of the human-centred design cycle from week two. There are two big families of methods. Empirical methods involve real users, like usability testing, where you watch people attempt tasks. Inspection methods involve experts examining an interface against principles, with no users present, like heuristic evaluation. It's also worth knowing the difference between formative and summative evaluation. Formative evaluation happens during design, and its goal is to find problems so you can fix them. Almost everything you'll do this semester is formative. Summative evaluation happens near the end, to measure how well a finished design performs, maybe against a benchmark or a competitor. Each family finds different things. Experts are quick and cheap, but they miss problems only real users bump into, and sometimes they flag issues that never bother anyone. So good teams use both.",
          points: [
            "Empirical methods: watch real users",
            "Inspection methods: experts apply principles",
            "Formative finds problems; summative measures performance",
            "Combine both families",
          ],
          example: "",
          visual: {
            kind: "tree",
            root: "Evaluation methods",
            children: [
              { label: "Empirical (users)", children: ["Usability testing", "Think-aloud"] },
              { label: "Inspection (experts)", children: ["Heuristic evaluation"] },
            ],
          },
        },
        {
          heading: "Planning a usability test",
          narration:
            "A usability test deserves the same care as a science experiment. Let's plan one together. Start with goals. What do you actually need to learn? Then recruit participants who represent your real users, ideally matching your personas. Not your flatmates. Not the people in this room, lovely as you are. Next, write your tasks. A good task is a realistic scenario with a clear goal, written in the user's language. And this is where people trip up. Never use the exact label from the button in your task wording, or you've basically handed them the answer. If the button says Manage Enrolment and your task says manage your enrolment, guess where they'll click? Then decide what you'll measure: task success, time, errors, moments of hesitation, maybe a questionnaire at the end. Prepare a script, so every participant hears the same introduction, including the reassurance that you're testing the design, not them. Get informed consent. And finally, run a pilot with a friend to check the tasks, the prototype and the timing. Ten minutes of piloting saves hours of confusing, useless data.",
          points: [
            "Set goals and recruit representative users",
            "Write realistic scenario tasks that don't give away answers",
            "Decide measures and prepare a script",
            "Get consent and run a pilot",
          ],
          example:
            "Rather than telling a participant to click Manage Enrolment, a well-written task says: you have decided to drop one of your subjects this semester, show me how you would do that.",
          visual: {
            kind: "flow",
            title: "Planning a usability test",
            steps: ["Set goals", "Recruit real users", "Write scenario tasks", "Script and consent", "Pilot"],
          },
        },
        {
          heading: "The think-aloud protocol",
          narration:
            "The most widely used technique in usability testing is the think-aloud protocol, where participants say their thoughts out loud while they do tasks. What they're looking for, what they expect to happen, what's confusing them. It's like getting a live commentary from inside their head, and you could never get that from watching clicks alone. Now, the facilitator's job is subtle, and honestly, it's one of the hardest skills in this whole subject. Your job is to keep them talking and to observe. Not to teach. When they get stuck, every fibre of your being will want to point at the right button. Don't. The moment you help, your data stops showing how a real user would cope on their own. If they go quiet and just stare at the screen, use a short, neutral prompt, like asking what they're thinking right now, or what they're looking for. If they ask you a question, gently bounce it back: what would you expect to happen? The first time I facilitated a session, I helped three times in ten minutes. My supervisor made me sit on my hands. Literally. Practise staying quiet.",
          points: [
            "Participants verbalise thoughts while doing tasks",
            "Observe; never teach or point",
            "Use neutral prompts when they go quiet",
            "Turn questions back to the participant",
          ],
          example: "",
          visual: {
            kind: "definition",
            term: "Think-aloud protocol",
            definition: "Participants verbalise their thoughts while doing tasks; the facilitator prompts neutrally",
          },
        },
        {
          heading: "How many participants?",
          narration:
            "How many people do you need to test with? For formative usability testing, the famous answer from Jakob Nielsen and Tom Landauer is about five per round. Their reasoning is about diminishing returns. In their data, a single user revealed roughly a third of the problems on average. The first participant shows you loads of issues. The second shows you some new ones, but also repeats some you've already seen. By the fifth, most of what you're seeing is familiar, so each extra person adds less and less. Now, here's the bit people often get wrong. Nielsen isn't saying five users is enough in total. He's saying several small rounds of testing, with fixes in between, beat one big test. Why? Because each round tests an improved design, and fixing the obvious problems uncovers the ones they were hiding. Think of it like peeling an onion. There are caveats, of course. If you have distinctly different user groups, test a few from each. And if you need reliable numbers, like comparing task times statistically, you need considerably more than five. Five is for finding problems, not measuring them.",
          points: [
            "About five users per round finds most problems",
            "Diminishing returns after that",
            "Several small iterative rounds beat one big test",
            "More users for distinct groups or statistics",
          ],
          example: "",
          visual: {
            kind: "bars",
            title: "Problems found (31% per user)",
            unit: "%",
            items: [
              { label: "1 user", value: 31 },
              { label: "3 users", value: 67 },
              { label: "5 users", value: 84 },
              { label: "10 users", value: 98 },
            ],
          },
        },
        {
          heading: "Heuristic evaluation",
          narration:
            "Now let's switch from users to experts. Heuristic evaluation is an inspection method where experts check an interface against usability principles, most famously Nielsen's ten heuristics. Each evaluator works through the interface alone first, noting every violation, and only then do evaluators merge their lists, because different people spot different problems. Ready for the ten? I'll go slowly. Visibility of system status. Match between the system and the real world. User control and freedom. Consistency and standards. Error prevention. Recognition rather than recall. Flexibility and efficiency of use. Aesthetic and minimalist design. Help users recognise, diagnose and recover from errors. And help and documentation. Nielsen recommended several evaluators, commonly three to five, because one evaluator on their own finds only a portion of the problems. I've done these alone, and I always miss things a colleague spots in minutes. The method is fast, cheap and needs no participants, which makes it great for catching obvious problems before you spend precious time testing with users. Just remember: it's expert judgement, not observed behaviour. Experts are clever, but they're not your users.",
          points: [
            "Experts inspect against Nielsen's ten heuristics",
            "Evaluators work independently, then merge",
            "Three to five evaluators is common",
            "Fast and cheap, but not observed behaviour",
          ],
          example: "",
          visual: {
            kind: "definition",
            term: "Heuristic evaluation",
            definition: "Experts inspect an interface against usability principles such as Nielsen's ten heuristics",
          },
        },
        {
          heading: "Heuristics in action",
          narration:
            "Knowing the names isn't enough. You need to recognise these heuristics in the wild. So let's play spot the violation. You fill in a form, press submit, and nothing happens on screen for five whole seconds. Which heuristic? Visibility of system status. The system should keep you informed with timely feedback. Without it, people click again, or give up. A spinner, a progress bar or a confirmation fixes it. Next. An upload fails and the app shows you a mysterious internal error code and nothing else. Which one? Help users recognise, diagnose and recover from errors. Good error messages use plain language, say precisely what went wrong, and suggest a fix. My kettle, by the way, shows a blinking E2 when it's unhappy. I still don't know what it wants. Next. An app makes you remember a code from one screen and type it on another. That's recognition rather than recall. Show options; don't make people memorise. And no undo after a mistake? User control and freedom. Every time, name the heuristic and explain what it costs the user.",
          points: [
            "Visibility of system status: timely feedback",
            "Error messages: plain language, precise, with a fix",
            "Recognition rather than recall: show options",
            "User control and freedom: undo and cancel",
          ],
          example:
            "A photo upload that fails with only a cryptic code breaks the error-recovery heuristic; a better message says the file is larger than the 10 megabyte limit and offers to compress it.",
          visual: {
            kind: "compare",
            left: { title: "What happened", items: ["No feedback for five seconds", "Bare error code", "Remember a code across screens", "No undo"] },
            right: { title: "Heuristic broken", items: ["Visibility of system status", "Recognise, diagnose, recover", "Recognition rather than recall", "User control and freedom"] },
          },
        },
        {
          heading: "Severity ratings and improving designs",
          narration:
            "An evaluation usually hands you a long list of problems, and you can't fix them all at once, so you need to prioritise. Nielsen proposed a severity scale from zero to four. Zero: not really a usability problem. One: cosmetic, fix it if you have spare time. Two: minor, low priority. Three: major, important to fix. Four: usability catastrophe, fix it before release, no excuses. How do you decide? Severity combines three factors. Frequency: how often does it happen? Impact: how hard is it for users to overcome? Persistence: is it a one-time hurdle people learn to get around, or does it bite them every single time? When you report findings, describe each problem, give evidence, like how many participants struggled, name the heuristic if relevant, rate the severity, and recommend a fix. Then redesign, and test again, to check the fix worked and didn't break something else. It happens more than you'd think. Next week, we take all the numbers and notes from your tests and learn to analyse them properly, with statistics and thematic analysis. Don't panic about the stats. I'll be gentle. See you then!",
          points: [
            "Severity scale from zero to four",
            "Factors: frequency, impact, persistence",
            "Report problem, evidence, heuristic, severity, fix",
            "Redesign, then retest",
          ],
          example: "",
          visual: {
            kind: "stack",
            title: "Nielsen's severity scale",
            layers: [
              "4 Catastrophe: fix before release",
              "3 Major: important to fix",
              "2 Minor: low priority",
              "1 Cosmetic: if time allows",
              "0 Not a usability problem",
            ],
          },
        },
      ],
      takeaways: [
        "Combine empirical testing with real users and inspection methods by experts.",
        "Good test tasks are realistic scenarios that do not give away the answer.",
        "In think-aloud testing, prompt neutrally and never help or explain.",
        "About five users per round reveals most problems, so run several small iterative rounds.",
        "Heuristic evaluation uses several independent experts and Nielsen's ten heuristics, such as visibility of system status.",
        "Rate severity by frequency, impact and persistence, then fix and retest.",
      ],
      video: {
        youtubeId: "6Bw0n6Jvwxk",
        title: "Heuristic Evaluation of User Interfaces",
        channel: "NNgroup",
        intro: "And now, straight from the source, Jakob Nielsen explains heuristic evaluation in his own words.",
      },
    },
    8: {
      title: "Quantitative and Qualitative Analysis",
      hook: "After testing, you are holding numbers, notes and recordings. This week you learn to turn them into findings you can defend, with statistics for the numbers and thematic analysis for the words.",
      objectives: [
        "Identify levels of measurement and choose suitable descriptive statistics",
        "Calculate and interpret a System Usability Scale score",
        "Choose between paired and independent-samples t-tests and run them in JASP",
        "Code qualitative data and develop themes using thematic analysis in a tool such as Taguette",
      ],
      segments: [
        {
          heading: "Two kinds of evidence",
          narration:
            "Welcome back, data detectives! Last week you ran usability tests and heuristic evaluations, and now you're sitting on numbers, notes and hours of recordings. This week we turn all of that into findings you can actually defend. Usability studies produce two kinds of data. Quantitative data is numbers: did they complete the task, how long did it take, how many errors, what did they score on a questionnaire. It tells you what happened and how much, and lets you compare designs. Qualitative data is words and observations: think-aloud comments, interview answers, notes about where people hesitated. It tells you why things happened and what people experienced. Which is better? Trick question. Neither. They answer different questions, and they're strongest together. Say your numbers show one design is slower than another. Great, but why? Only the qualitative data, maybe five people muttering that they can't find the search box, tells you why, and what to fix. Combining them is called mixed methods. In this subject you'll use JASP, a free statistics package, for the numbers, and Taguette, a free qualitative coding tool, for the words.",
          points: [
            "Quantitative: what happened and how much",
            "Qualitative: why it happened",
            "Strongest together: mixed methods",
            "JASP for statistics, Taguette for coding",
          ],
          example: "",
          visual: {
            kind: "compare",
            left: { title: "Quantitative", items: ["Task success and time", "Errors and scores", "What and how much", "Analysed in JASP"] },
            right: { title: "Qualitative", items: ["Think-aloud comments", "Interview answers", "Explains why", "Coded in Taguette"] },
          },
        },
        {
          heading: "Levels of measurement",
          narration:
            "Before you analyse a single number, you need to know what kind of number it is. Otherwise you end up calculating things that are, well, meaningless. There are four levels of measurement. Nominal data is categories with no order, like which device someone used. Phone isn't more than laptop; it's just different. Ordinal data has categories with a meaningful order, but the gaps between them aren't guaranteed to be equal. And here's the one that catches people out. A single Likert item, where people rate agreement from one to five, is ordinal. We know agree is more than neutral. But can we claim the distance from neutral to agree is the same as from agree to strongly agree? No, we can't. Interval data has equal gaps but no true zero, like temperature in Celsius. Zero degrees doesn't mean no temperature, as anyone in Melbourne in July can tell you. Ratio data has equal gaps and a true zero, like task time in seconds or number of errors, so you can say one time is twice another. For a single ordinal item, the median and the count of each response are much safer summaries than the mean.",
          points: [
            "Nominal: unordered categories",
            "Ordinal: ordered, gaps not equal, such as a Likert item",
            "Interval: equal gaps, no true zero",
            "Ratio: equal gaps and a true zero, such as time",
          ],
          example: "",
          visual: {
            kind: "stack",
            title: "Levels of measurement",
            layers: [
              "Ratio: true zero, e.g. task time",
              "Interval: equal gaps, e.g. Celsius",
              "Ordinal: ordered, e.g. a Likert item",
              "Nominal: categories, e.g. device",
            ],
          },
        },
        {
          heading: "Describing usability data",
          narration:
            "Let's describe what we observed. The most fundamental usability metric is task success rate: the proportion of participants who completed a task. Seven out of eight people succeeded? That's eighty-seven point five percent. Decide in advance what counts as success, and whether you'll record partial success separately, otherwise you'll end up arguing about it afterwards. Next, time on task, which tells you about efficiency. But be careful here. Time data is usually skewed. Most people finish in a couple of minutes, and then one participant takes ten because they wandered into the settings and got lost. That one person drags the mean way up. So report the median alongside the mean, and show the range. Many analysts also report time only for successful attempts. Error counts tell you where people go wrong. And please, always report a measure of spread, like the standard deviation, not just an average, because two designs with identical averages can behave completely differently. Finally, with small samples, be modest. Five participants are brilliant at revealing problems. They're hopeless at giving precise estimates for a whole population.",
          points: [
            "Task success rate: proportion who completed",
            "Time on task is skewed: report the median too",
            "Count errors and always report spread",
            "Small samples find problems, not precise estimates",
          ],
          example: "",
          visual: {
            kind: "formula",
            formula: "Task success rate = completed ÷ attempted",
            steps: ["7 of 8 participants completed the task", "7 ÷ 8 = 0.875", "Success rate = 87.5%"],
          },
        },
        {
          heading: "The System Usability Scale",
          narration:
            "Now, a questionnaire you'll meet constantly: the System Usability Scale, or SUS, created by John Brooke. It's a ten-item questionnaire that produces a usability score from zero to one hundred. Participants rate each statement from one, strongly disagree, to five, strongly agree. The items alternate. Odd-numbered items are positive, like finding the system easy to use. Even-numbered items are negative, like finding it unnecessarily complex. Scoring takes three steps, so grab a pen. For each odd item, subtract one from the response. For each even item, subtract the response from five. Now every item sits on a zero to four scale where higher is better. Then add up all ten and multiply the total by two point five. Let's try one. Someone answers four on every odd item and two on every even item. Each item scores three, ten items make thirty, times two point five gives seventy-five. Now the crucial part. A SUS score is not a percentage. Seventy-five doesn't mean seventy-five percent of anything. Across many studies the average is about sixty-eight, so sixty-eight means roughly average usability, and seventy-five is comfortably above it.",
          points: [
            "Ten items rated from one to five",
            "Odd items: response minus one; even items: five minus response",
            "Sum, then multiply by 2.5 for a score out of 100",
            "Not a percentage; about 68 is average",
          ],
          example:
            "If a participant answers four on every odd item and two on every even item, each item scores three, giving a total of thirty, which multiplied by two point five gives a SUS score of seventy-five, above average.",
          visual: {
            kind: "formula",
            formula: "SUS = (sum of odd (r − 1) + sum of even (5 − r)) × 2.5",
            steps: [
              "Odd items answered 4: each scores 4 − 1 = 3",
              "Even items answered 2: each scores 5 − 2 = 3",
              "Total: 10 items × 3 = 30",
              "30 × 2.5 = 75, above the average of about 68",
            ],
          },
        },
        {
          heading: "Comparing designs with t-tests",
          narration:
            "Often you'll want to know whether a difference between two designs is real, or just luck. That's where the t-test comes in. It compares the means of two sets of scores, like task times, and tells you how likely a difference that big would be if there were really no difference at all. That likelihood is the p-value, and by convention, a p-value below point zero five is called statistically significant. Now, the key decision is which t-test to use, and it depends on your study design. So let me ask you. If the same participants try both designs, what kind of design is that? Within-subjects, yes. Each person gives you two linked measurements, so you use a paired-samples t-test, which compares each person with themselves. If different people try each design, that's between-subjects, the groups are independent, and you use an independent-samples t-test. In JASP, you pick the matching test from the t-tests menu and drag in your variables. Two warnings. T-tests assume roughly normal data. And significant doesn't automatically mean important. Half a second might be significant and still not matter to anyone.",
          points: [
            "A t-test compares two means; p below .05 is significant",
            "Same people try both designs: paired-samples t-test",
            "Different people per design: independent-samples t-test",
            "Assumes roughly normal data; check practical importance",
          ],
          example:
            "If the same twenty participants complete a booking task on both the old and the new design, each person contributes two times, so a paired-samples t-test is the right choice in JASP.",
          visual: {
            kind: "compare",
            left: { title: "Paired-samples t-test", items: ["Same people try both designs", "Within-subjects", "Two linked scores each"] },
            right: { title: "Independent-samples t-test", items: ["Different people per design", "Between-subjects", "Two separate groups"] },
          },
        },
        {
          heading: "Coding qualitative data",
          narration:
            "Now for the words. Qualitative analysis turns hours of transcripts and notes into structured findings, and the most common approach is thematic analysis, which means coding qualitative data and grouping the codes into themes. Virginia Braun and Victoria Clarke describe it in six phases. One: familiarise yourself with the data. Read it, reread it, live with it a little. Two: generate initial codes. A code is a short label attached to a chunk of data that captures something interesting, like navigation confusion, or distrust of autosave, or wants offline access. Three: search for themes by grouping related codes. Four: review those themes against the data to check they really hold up. Five: define and name each theme clearly. Six: write the report. A tool like Taguette makes the mechanics much easier. You upload your transcripts, highlight passages, tag them with codes, and then export every highlight for a code in one go. Suddenly you can see how often a code appears, and across how many participants. I used to do this with highlighters and printouts on my kitchen floor. My cat helped. Not much. Use Taguette.",
          points: [
            "Thematic analysis: code data, group codes into themes",
            "Braun and Clarke's six phases",
            "A code is a short label on a data segment",
            "Taguette: highlight, tag and export by code",
          ],
          example: "",
          visual: {
            kind: "flow",
            title: "Thematic analysis",
            steps: ["Familiarise", "Generate codes", "Search for themes", "Review themes", "Define and name", "Write report"],
          },
        },
        {
          heading: "From themes to reported findings",
          narration:
            "Let's finish by turning codes and numbers into findings people will believe. First, a theme is more than a topic. Navigation is a topic. Users lose track of where they are once they leave the home screen: that's a theme, because it actually claims something about the data. Good themes are backed by several pieces of evidence from several participants, and you should be honest about how widespread each one is. When you write up a finding, lead with the finding itself, say how many participants it affected, support it with a short representative quote, and link it to your numbers where you can, like a low success rate on the related task. Then give it a severity and a recommendation. Two mistakes to avoid. Reporting averages without spread or sample size, which hides how uncertain you really are. And cherry-picking the most dramatic quote, the one where someone threatened to throw their laptop out the window, when it doesn't represent the wider data. Your goal is a report a reader can trust, that leads straight to design changes. Next week, at last, I get to show you my collection of terrible doors. You've been warned. See you then!",
          points: [
            "A theme makes a claim; a topic does not",
            "Back each finding with numbers and quotes",
            "Give severity and a recommendation",
            "Avoid hiding uncertainty or cherry-picking quotes",
          ],
          example: "",
        },
      ],
      takeaways: [
        "Quantitative data shows what happened and how much; qualitative data explains why.",
        "A single Likert item is ordinal data, so medians and frequencies suit it best.",
        "Report task success, time on task and errors with spread, and treat skewed time data with care.",
        "SUS scores range from zero to one hundred, are not percentages, and average about sixty-eight.",
        "Use a paired-samples t-test when the same people try both designs, and an independent-samples t-test for separate groups.",
        "Thematic analysis codes qualitative data and groups the codes into evidence-backed themes.",
      ],
      video: {
        youtubeId: "KUZ6iGvJlGI",
        title: "Thematic Analysis of Qualitative User Research Data",
        channel: "NNgroup",
        intro: "Here's a short walkthrough of thematic analysis on real user research data; compare their steps with the six phases we just covered.",
      },
    },
    9: {
      title: "Affordances",
      hook: "Why do people push doors that need to be pulled, and tap on things that are not buttons? The answer lies in affordances and signifiers, two of the most useful ideas in interface design.",
      objectives: [
        "Explain affordances as relationships, following Gibson and Norman",
        "Distinguish affordances, perceived affordances and signifiers",
        "Analyse designs using constraints, mapping and feedback",
        "Identify false and hidden affordances, including in flat digital design",
      ],
      segments: [
        {
          heading: "Gibson's affordances",
          narration:
            "Hello, everyone, and welcome to my favourite week of the entire semester! Last week we wrestled with statistics and themes. This week is all about affordances, and yes, my door photos finally make their grand appearance. But let's start with the theory. The idea of affordances comes from the psychologist James Gibson, who studied how animals perceive their environment. Gibson argued that we don't just see shapes and colours. We directly perceive the possibilities for action that the world offers us. A flat, firm surface at knee height affords sitting. A small, rigid object affords grasping. And here's his big insight. An affordance isn't a property of the object alone, or of the person alone. It's a relationship between the two. A chair affords sitting for an adult. For an ant? Not so much. A high shelf affords reaching for a tall person, but not for a small child, as my five-year-old nephew reminds me every time he visits. So here's our definition: an affordance is the relationship between an object's properties and the actions a person can take with it. Hold on to that word relationship. It explains why the same design can work beautifully for some people and fail completely for others.",
          points: [
            "Gibson: we perceive possibilities for action",
            "An affordance is a relationship, not a property",
            "Depends on both the object and the person",
            "Explains why designs suit some users and not others",
          ],
          example: "",
          visual: {
            kind: "definition",
            term: "Affordance",
            definition: "The relationship between an object's properties and the actions a person can take",
          },
        },
        {
          heading: "Norman brings affordances to design",
          narration:
            "Fast forward to Don Norman, who brought affordances into the design world with his book, now known as The Design of Everyday Things. Norman asked a slightly different question. Not just what actions are possible, but can people tell? Because an affordance nobody can perceive isn't much use to anyone. Imagine a door you can push, but absolutely nothing about it tells you so. The affordance exists. It's just hidden. So Norman talked about perceived affordances: the actions a person believes are possible, based on what they can see. And on screens, this distinction becomes critical. Think about a touchscreen. Technically, every single pixel affords touching. You can poke anywhere you like. What matters is whether you perceive that a particular element will do something when you touch it. Over time, designers started using the word affordance so loosely, for pretty much everything, that Norman decided we needed a clearer word for the cue that communicates the action. Any guesses? That word is signifier, and it's coming up next.",
          points: [
            "Norman: can people tell what is possible?",
            "Hidden affordances are of little use",
            "Perceived affordance: what people believe is possible",
            "Signifier: the clearer term for the cue",
          ],
          example: "",
          visual: {
            kind: "timeline",
            title: "From affordances to signifiers",
            events: [
              { label: "1979", detail: "Gibson's ecological approach to perception" },
              { label: "1988", detail: "Norman brings affordances to design" },
              { label: "2008", detail: "Norman: signifiers, not affordances" },
              { label: "2013", detail: "Revised edition stresses signifiers" },
            ],
          },
        },
        {
          heading: "Signifiers",
          narration:
            "A signifier is a perceivable cue that indicates where and how to act. Let me put the two side by side, because people mix them up constantly. The affordance is the possible action. The signifier is what tells you about it. A flat metal plate on a door signifies push. A vertical handle signifies pull. On a screen, a raised button with a shadow, blue underlined text, a blinking cursor in a field, a little grip icon on a list item: all signifiers. And some signifiers aren't designed at all. A worn dirt path across a lawn tells you the route people actually take, whatever the architect intended. A crowd queuing at one ticket machine suggests the others might be broken. Notice, too, that a signifier is different from feedback, which comes after you act, and different from your mental model, which lives in your head. Here's why signifiers matter so much for you as designers. You usually can't change what's possible, but you completely control what's visible and how it's presented. Get your signifiers right, and people discover what they can do without a single instruction.",
          points: [
            "A perceivable cue showing where and how to act",
            "Affordance is the action; signifier communicates it",
            "Different from feedback, which follows an action",
            "Designers control signifiers directly",
          ],
          example: "",
          visual: {
            kind: "compare",
            left: { title: "Affordance", items: ["The possible action", "Exists even if unseen", "The door can be pushed"] },
            right: { title: "Signifier", items: ["The cue for the action", "Must be perceivable", "A flat push plate"] },
          },
        },
        {
          heading: "The Norman door",
          narration:
            "Right. Who here has pushed a pull door? Yes. All of you. Me too, last Tuesday, at the dentist. That, my friends, is a Norman door: a door whose design sends the wrong message, so people push when they should pull, or pull when they should push. The classic version has a lovely grabbable handle on the side you need to push, or a flat bar on a door that has to be pulled. The handle's shape is a signifier, and it's flatly contradicting the action required. And here's the important bit. You weren't being foolish. You responded exactly as the design told you to. Now, how do you spot a Norman door from across the room? Look for the label. When somebody has taped a sign saying push or pull onto a door, that's a confession. It means the design failed to communicate on its own. Norman's principle is beautifully simple: when a simple design needs a label to work, the signifiers are wrong. And the same is true on screens. If you find yourself writing instructions to explain a basic control, stop, and ask whether the control itself could speak more clearly.",
          points: [
            "Its design signals the wrong action",
            "The handle is a misleading signifier",
            "A taped-on label reveals the failure",
            "Simple controls should not need instructions",
          ],
          example:
            "Many glass doors have identical vertical handles on both sides; people grab and pull regardless, while a flat plate on the push side and a handle only on the pull side removes the confusion.",
          visual: {
            kind: "flow",
            title: "Anatomy of a Norman door",
            steps: ["Handle signals pull", "Person pulls", "Door needs a push", "Someone tapes on a label"],
          },
        },
        {
          heading: "Constraints, mapping and feedback",
          narration:
            "Signifiers are just one of Norman's design principles, so let's meet three more. First, constraints, which limit the possible actions and prevent errors. Physical constraints make wrong actions impossible, like a SIM tray that only fits one way. Logical constraints use reasoning, like a form that disables the submit button until the required fields are filled. Cultural constraints rely on learned conventions, like red meaning stop. And semantic constraints rely on the meaning of the situation. Second, mapping, the relationship between controls and their effects. Here's my favourite photo. A cooktop with four burners arranged in a square, and four knobs in a neat straight line along the front. Which knob controls which burner? Nobody knows. I've watched people heat an empty pot this way. Lay the knobs out in the same arrangement as the burners, and you don't need labels at all. That's natural mapping. Third, feedback, which tells people the result of their action, immediately and clearly. A button that changes state, a sound, a progress bar. Without feedback, people press again, or assume it's broken. Which is exactly what I did with a lift last week.",
          points: [
            "Constraints: physical, logical, cultural, semantic",
            "Natural mapping links controls to effects",
            "Feedback confirms results immediately",
            "Missing feedback leads to repeated actions",
          ],
          example: "",
          visual: {
            kind: "tree",
            root: "Norman's design principles",
            children: [
              { label: "Constraints", children: ["Physical", "Logical", "Cultural", "Semantic"] },
              { label: "Mapping", children: ["Controls match layout"] },
              { label: "Feedback", children: ["Immediate", "Clear"] },
            ],
          },
        },
        {
          heading: "False and hidden affordances on screens",
          narration:
            "Things go wrong with signifiers in two main ways. First, the false affordance: a signifier suggesting an action that isn't actually possible. Underlined text that isn't a link. A thing that looks exactly like a button but does nothing when you tap it. You tap, nothing happens, you tap harder, as if that'll help. These waste time and chip away at trust. Second, the hidden affordance, the opposite problem. The action exists, but nothing signals it. Loads of touchscreen gestures are hidden affordances: swipe a list item to reveal delete, long-press for more options. If nobody told you, you'd probably never find them. Now, a famous example of weakened signifiers is flat design, the visual style that stripped shadows, gradients and borders out of interfaces. It looks clean and modern, I'll give it that. But by removing the visual cues of clickability, it can make buttons look just like static text or labels, so people hesitate, or miss them entirely. Plenty of design systems have since quietly added back subtle signifiers, like outlines, fills or soft shadows, to restore clarity. Turns out those little cues were doing real work.",
          points: [
            "False affordance: cue for an action that isn't possible",
            "Hidden affordance: action with no cue",
            "Gestures are often hidden affordances",
            "Flat design can weaken signifiers",
          ],
          example: "",
          visual: {
            kind: "compare",
            left: { title: "False affordance", items: ["Looks possible, isn't", "Underlined non-link", "Button that does nothing"] },
            right: { title: "Hidden affordance", items: ["Possible, but no cue", "Swipe to delete", "Long-press menus"] },
          },
        },
        {
          heading: "Designing with affordances in your project",
          narration:
            "So how do you use all this in your own designs? For every interactive element, ask two questions. What action does this afford? And what signals that action to the user? Make clickable things look clickable, and do it consistently across the whole interface, with shape, colour, borders or underlines. Make non-clickable things look different, so you don't accidentally create false affordances. If you rely on a gesture, offer a visible alternative, or a hint the first time. Use constraints to prevent errors before they happen, rather than scolding people afterwards. Check that controls map naturally to their effects. Give immediate feedback for every action. And finally, test with people who've never seen your design. Your teammates already know what everything does, so they literally cannot see missing signifiers. If participants hesitate, hover around looking for something to press, or ask how to do something, congratulations, you've found a signifier problem. Homework: photograph one terrible door this week. Next week, we look inside users' heads, at mental models, and at why everyone turns the thermostat up too high. See you then!",
          points: [
            "Ask what each element affords and what signals it",
            "Make clickable things consistently look clickable",
            "Offer visible alternatives to gestures",
            "Test with newcomers to find missing signifiers",
          ],
          example: "",
        },
      ],
      takeaways: [
        "An affordance is the relationship between an object's properties and the actions a person can take with it.",
        "A signifier is a perceivable cue that indicates where and how to act.",
        "If a simple design needs a label to work, its signifiers are wrong, as with a Norman door.",
        "Constraints prevent errors, natural mapping links controls to effects, and feedback confirms results.",
        "False affordances suggest impossible actions; hidden affordances give no cue for real ones.",
        "Flat design can weaken signifiers so that clickable elements look like static text.",
      ],
      video: {
        youtubeId: "yY96hTb8WgI",
        title: "It's not you. Bad doors are everywhere.",
        channel: "Vox",
        intro: "And now, one of my all-time favourite videos about doors; watch for the moment a label gives the game away.",
      },
    },
    10: {
      title: "Interfaces, Models and Metaphors",
      hook: "Every user carries a theory in their head about how your system works, and it is often wrong. This week is about understanding those theories and designing interfaces that teach the right one.",
      objectives: [
        "Explain mental models, conceptual models and the system image that connects them",
        "Use Norman's gulfs of execution and evaluation to diagnose interaction problems",
        "Evaluate the benefits and limits of interface metaphors",
        "Apply familiar conventions and patterns to reduce learning effort",
      ],
      segments: [
        {
          heading: "Mental models",
          narration:
            "Hello again, everyone. Did anyone photograph a terrible door? I see phones going up. Wonderful, send them to me, I'm building an archive. Last week we looked at affordances and signifiers, the cues out there in the world. This week we go inside users' heads. A mental model is a user's internal understanding of how a system works. You build them all the time without noticing. You've got a mental model of how an email travels to your friend, how a lift decides which floor to go to next, how cloud storage keeps your files in sync. Mental models come from experience, from what the interface shows you, and from analogies with things you already know. They let you predict what'll happen when you act, and work out what to do when something goes wrong. Here's the surprising part. Mental models don't have to be accurate to be useful. Most of us couldn't explain how a car engine works, and we drive just fine. Trouble starts when an inaccurate model leads to the wrong action or a wrong prediction. And since we can't install the right model directly into anyone's head, designers have to shape it indirectly, through the interface.",
          points: [
            "A user's internal understanding of how a system works",
            "Built from experience, the interface and analogy",
            "Used to predict and troubleshoot",
            "Need not be accurate, but wrong models cause errors",
          ],
          example: "",
          visual: {
            kind: "definition",
            term: "Mental model",
            definition: "A user's internal understanding of how a system works",
          },
        },
        {
          heading: "The thermostat problem",
          narration:
            "Let me ask you something. You come home on a freezing winter evening. The house is cold. What do you do with the thermostat? Be honest. Crank it right up to thirty? I see guilty faces. You're in excellent company. This is Don Norman's classic example of a faulty mental model. Lots of people believe that setting the thermostat higher will warm the room faster. But in a typical home heating system, the thermostat works like an on and off switch. The heater runs at the same rate whatever the setting, until the room reaches the target, and then it switches off. Setting it to thirty doesn't heat the room any faster. It just means the room overshoots and you're sweltering an hour later. The mistaken model treats the thermostat like a tap or a valve, where opening it wider gives you more flow. And that model works perfectly for a tap, so it feels completely reasonable. The user isn't silly. The thermostat simply gives no clue about how it really works, so people fill the gap with the closest analogy they have. Better design would make that behaviour visible, like showing that heating is on and roughly when the target will be reached.",
          points: [
            "People turn thermostats up to heat faster",
            "Most heaters are simply on or off",
            "Users apply a valve model instead",
            "The interface gave no clue about the real behaviour",
          ],
          example: "",
          visual: {
            kind: "compare",
            left: { title: "User's valve model", items: ["Higher setting, faster heat", "Like opening a tap"] },
            right: { title: "Actual on-off system", items: ["Same heating rate", "Switches off at target", "Higher just overshoots"] },
          },
        },
        {
          heading: "Conceptual models and the system image",
          narration:
            "Norman describes three models that need to line up, and I'm going to draw them as a little chain. First, the designer's model: the conceptual model the designer has in mind, how the system is meant to work. Second, the user's model: the mental model the user actually builds. And in between, connecting them, the system image: everything the user can actually experience about the system. The interface, its behaviour, the labels, the feedback, the documentation. Here's the key point, and it's a big one. The designer doesn't get to sit beside every user and explain things. So the system image is the only channel through which the designer's model reaches the user. If the system image is unclear or misleading, users will build a wrong model, even if the designer's model is perfectly sensible. Our thermostat had a perfectly good designer's model. Its system image just said nothing useful. So a central job of interface design is creating a system image that communicates a clear, simple conceptual model. And a good conceptual model has a small number of objects and actions that relate in obvious ways. Files go inside folders. Simple, graspable, predictable.",
          points: [
            "Designer's model: how it is meant to work",
            "User's model: what the user believes",
            "System image: everything the user can experience",
            "The system image is the only bridge between them",
          ],
          example: "",
          visual: {
            kind: "flow",
            title: "The system image is the only bridge",
            steps: ["Designer's model", "System image", "User's model"],
          },
        },
        {
          heading: "The gulfs of execution and evaluation",
          narration:
            "Norman describes interaction as a cycle. You have a goal. You work out what to do. You act. Then you perceive what happened, interpret it, and compare it with your goal. Two gaps can open up along the way, and he calls them gulfs, which I love, because it makes them sound like something you might fall into. Which you do. The gulf of execution is the gap between what the user wants to do and the actions the interface makes available. You want to rotate a photo, and there's no control anywhere that does it. Wide gulf of execution. The gulf of evaluation is the gap between what the system shows and the user's ability to interpret its state. You press print, and nothing tells you whether the document was sent, queued, or quietly failed. Wide gulf of evaluation. So, execution is about doing, evaluation is about understanding the result. How do we build bridges? Signifiers, constraints and natural mapping, our friends from last week, bridge the gulf of execution. Clear feedback and visible system status bridge the gulf of evaluation. Good design narrows both gulfs until you barely notice them.",
          points: [
            "Execution: from intention to available actions",
            "Evaluation: from system state to understanding",
            "Signifiers and mapping bridge execution",
            "Feedback and visible status bridge evaluation",
          ],
          example:
            "A smart TV user wants subtitles but the option is buried three menus deep under an unrelated name, a wide gulf of execution; once found, the toggle shows no change until the next scene, a wide gulf of evaluation.",
          visual: {
            kind: "compare",
            left: {
              title: "Gulf of execution",
              items: ["Intention versus available actions", "Can't find a rotate control", "Bridge: signifiers and mapping"],
            },
            right: {
              title: "Gulf of evaluation",
              items: ["System state versus understanding", "Did it actually print?", "Bridge: feedback and status"],
            },
          },
        },
        {
          heading: "Interface metaphors",
          narration:
            "One clever way to help people build a useful mental model is an interface metaphor, which borrows familiar real-world concepts to explain something new. The most famous is the desktop metaphor, developed at Xerox PARC and popularised by early graphical systems like the Apple Macintosh. Documents look like sheets of paper. They live in folders. And unwanted files go in the trash can, or the recycle bin. Why does that work so well? Because people already understand paper, folders and bins, so they transfer that knowledge and guess correctly what's possible. You can drag a document into a folder. You can fish something back out of the bin if you change your mind, just like the real thing, although I'd rather not fish in my real bin. Other common metaphors include the shopping cart in online stores, tabs in a browser, and bookmarks. Metaphors are especially valuable for beginners. They lower the cost of learning and hand people a starting model before they've had any experience with the system at all. My grandmother learned to use a computer in her eighties, and the trash can was the first thing that made sense to her.",
          points: [
            "Metaphors borrow familiar real-world concepts",
            "Desktop, folders and trash from Xerox PARC onwards",
            "Users transfer existing knowledge",
            "Especially helpful for novices",
          ],
          example: "",
          visual: {
            kind: "tree",
            root: "Interface metaphors",
            children: [
              { label: "Desktop", children: ["Paper documents", "Folders", "Trash can"] },
              { label: "Online shopping", children: ["Shopping cart"] },
              { label: "Web browsing", children: ["Tabs", "Bookmarks"] },
            ],
          },
        },
        {
          heading: "The limits of metaphors",
          narration:
            "But, and you knew there was a but, metaphors are never perfect, and they cause trouble around the edges. Every metaphor breaks somewhere, because the digital system can do things the real object can't, and the other way round. My favourite example is the early Macintosh, where you ejected a floppy disk by dragging its icon onto the trash can. Imagine being a new user. You've spent weeks learning that the trash is where things go to be deleted, and now you're being asked to throw your disk away to get it back? Terrifying. That's exactly what the bin metaphor suggested. Metaphors can also limit what designers imagine. Stick too closely to the physical world, and you might forget what computers can do that filing cabinets can't, like instantly searching every document you own. And metaphors age. The floppy disk save icon is still widely understood, even by people who've never touched a floppy disk. At that point it's working as a convention, not a metaphor. So choose metaphors that match how people already think, make it clear where the metaphor stops applying, and don't stretch it further than it naturally goes.",
          points: [
            "Every metaphor breaks somewhere",
            "Dragging a disk to the trash to eject it",
            "Metaphors can limit design imagination",
            "Metaphors age into conventions",
          ],
          example: "",
          visual: {
            kind: "compare",
            left: { title: "Benefits", items: ["Transfers familiar knowledge", "Eases learning for novices", "Gives a starting model"] },
            right: { title: "Limits", items: ["Breaks at the edges", "Can limit imagination", "Ages into convention"] },
          },
        },
        {
          heading: "Familiar patterns and conventions",
          narration:
            "Not every interface needs a metaphor. Often the best way to support people's mental models is to follow conventions they already know from other products. Jakob Nielsen makes a great point here: users spend most of their time on other websites and apps, so they expect yours to work the same way. A logo in the top left that takes you home. A magnifying glass for search. A cart icon at the top right. Underlined links. Pulling down to refresh. None of these are laws of nature. They're learned conventions. But they're so widespread that breaking them just creates confusion. And that links straight to the heuristic of consistency and standards from week seven. Design systems and pattern libraries capture these conventions so teams apply them consistently. So, for your project, use established patterns for common tasks like login, navigation and forms, and save your creativity for the parts of the problem that are genuinely new. Then test, to check that users' mental models actually match the conceptual model you intended. Next week is one of the most important of the semester: designing for everyone. Come ready to rethink what disability means. See you then!",
          points: [
            "Users expect your product to work like others",
            "Conventions are learned, but breaking them confuses",
            "Linked to consistency and standards",
            "Innovate only where the problem is genuinely new",
          ],
          example: "",
        },
      ],
      takeaways: [
        "A mental model is a user's internal understanding of how a system works, and it can be wrong.",
        "The thermostat example shows people applying a valve model to a device that is really just on or off.",
        "The system image is the only bridge between the designer's conceptual model and the user's mental model.",
        "The gulf of execution separates intentions from available actions; the gulf of evaluation separates system state from understanding.",
        "Interface metaphors like the desktop and trash transfer familiar knowledge but break at the edges.",
        "Following familiar conventions reduces learning effort and supports accurate mental models.",
      ],
      video: {
        youtubeId: "nAgXISssAws",
        title: "What is a Mental Model?",
        channel: "NNgroup",
        intro: "Here's a short explainer on mental models; as you watch, think about the thermostat and what its system image fails to say.",
      },
    },
    11: {
      title: "Design for All",
      hook: "Disability is not a rare edge case. Everyone has limits on what they can see, hear, hold or remember at some moment, and designing for the full range of people makes products better for all of us.",
      objectives: [
        "Explain inclusive and universal design and the social model of disability",
        "Classify permanent, temporary and situational impairments",
        "Apply WCAG 2.2 principles, including contrast and use-of-colour requirements",
        "Describe how assistive technologies work with interfaces and how to reduce barriers",
      ],
      segments: [
        {
          heading: "Rethinking disability",
          narration:
            "Welcome, everyone. Last week we explored mental models and metaphors, and how interfaces shape what people believe about them. This week I want to start with a question that might change how you design forever. What is disability? In everyday language, it's often treated as a personal condition, something about a person's body or mind. But for designers, there's a far more useful way to think about it: the social model of disability. It sees disability as a mismatch between a person and their environment. A wheelchair user isn't disabled by their legs when there's a ramp. They're disabled by a building that only has stairs. In the same way, a blind person can happily use a well-built website that works with a screen reader, but gets shut out by one full of unlabelled images and mystery buttons. Do you see how that shifts the responsibility? Onto us. Every design choice either removes a barrier or creates one. And disability is a common part of human experience, becoming more common as people age. So designing for disability isn't designing for a tiny minority. It's designing for real populations. Including, one day, your future self.",
          points: [
            "Social model: disability is a mismatch with the environment",
            "Design choices create or remove barriers",
            "Disability is common and increases with age",
            "Designers share responsibility for exclusion",
          ],
          example: "",
          visual: {
            kind: "compare",
            left: { title: "Personal condition view", items: ["Disability is in the person", "Fix the individual"] },
            right: { title: "Social model", items: ["Mismatch with the environment", "Fix the barriers"] },
          },
        },
        {
          heading: "Universal and inclusive design",
          narration:
            "There are two closely related approaches to designing for everyone, and you'll hear both terms a lot. Universal design is a term associated with the architect Ronald Mace. It aims to create products and environments usable by all people, to the greatest extent possible, without the need for adaptation or specialised design. It comes with seven principles: equitable use, flexibility in use, simple and intuitive use, perceptible information, tolerance for error, low physical effort, and appropriate size and space for approach and use. That's a mouthful, but tolerance for error is one I'd happily paint on the wall of every development team. Inclusive design, as it's developed in digital practice, comes at it from a slightly different angle. It accepts that one single design can't suit everyone equally, so it focuses on recognising exclusion, learning from human diversity, and solving for one group in a way that extends the benefits to many. Both approaches share one core idea. Instead of designing for an imaginary average user and patching in accessibility later, you consider the full range of human abilities from the very start. And that tends to produce designs that are more flexible and more robust for everybody.",
          points: [
            "Universal design: usable by all without adaptation",
            "Seven principles, including tolerance for error",
            "Inclusive design: recognise exclusion, learn from diversity",
            "Consider the full range of abilities from the start",
          ],
          example: "",
          visual: {
            kind: "compare",
            left: { title: "Universal design", items: ["Usable by all people", "No adaptation needed", "Seven principles"] },
            right: { title: "Inclusive design", items: ["Recognise exclusion", "Learn from diversity", "Solve for one, extend to many"] },
          },
        },
        {
          heading: "Permanent, temporary and situational",
          narration:
            "Here's one of my favourite tools in all of design. Microsoft's inclusive design toolkit introduced something called the persona spectrum, and it shows that the same limitation can be permanent, temporary or situational. Let's take the use of one arm. Someone who has lost an arm has a permanent impairment. Someone with their arm in a cast after an injury has a temporary one. And a parent holding a baby in one arm? Situational. I spent most of last year typing one-handed with my sister's baby on my hip, and I can tell you exactly which apps respect that and which don't. The same pattern works for vision. Blindness is permanent, an eye infection is temporary, and glare on your phone in bright sunlight is situational. And for hearing: deafness, an ear infection, and a noisy train carriage. Can you see why this is so powerful? A design that works for someone with a permanent impairment also helps a much bigger group with temporary or situational ones. Make your app usable one-handed and you've served someone with one arm, someone with a broken wrist, and a commuter clutching a coffee.",
          points: ["Permanent: one arm", "Temporary: arm in a cast", "Situational: holding a baby", "Solve for one, extend to many"],
          example: "",
          visual: {
            kind: "matrix",
            title: "The persona spectrum",
            rowLabel: "Ability",
            colLabel: "Duration",
            rows: ["Touch", "See", "Hear"],
            cols: ["Permanent", "Temporary", "Situational"],
            cells: [
              ["One arm", "Arm in a cast", "Holding a baby"],
              ["Blind", "Eye infection", "Screen glare"],
              ["Deaf", "Ear infection", "Noisy train"],
            ],
          },
        },
        {
          heading: "The curb-cut effect",
          narration:
            "Speaking of designs that help far more people than expected, let me introduce the curb-cut effect. It describes what happens when a feature designed for disabled people ends up benefiting everyone. The name comes from those little ramps cut into the kerb at street crossings. They were introduced for wheelchair users, after campaigning by disability activists. But who else uses them? People pushing prams. Travellers dragging suitcases. Cyclists. Delivery workers with trolleys. Me, with my wonky-wheeled shopping trolley every Saturday. Digital design is full of curb cuts. Captions were designed for Deaf and hard of hearing viewers, and now they're used by people watching in noisy cafés, in quiet libraries where sound would annoy everyone, and by people learning a new language. Voice control helps people with motor impairments, and anyone with their hands full. Good keyboard navigation helps screen reader users, and power users who love their shortcuts. High contrast helps people with low vision, and everyone squinting at a phone outdoors. And there's a business lesson here too. Accessibility work rarely serves only one group. So when someone tells you accessibility is a niche concern, tell them about curb cuts.",
          points: [
            "Features for disabled people benefit everyone",
            "Kerb ramps help prams, luggage and bikes",
            "Captions help in noisy cafés and for learners",
            "A strong argument for accessibility investment",
          ],
          example: "",
          visual: {
            kind: "definition",
            term: "Curb-cut effect",
            definition: "When a feature designed for disabled people benefits everyone",
          },
        },
        {
          heading: "WCAG 2.2 and POUR",
          narration:
            "Let's go back to the guidelines we met in week two. The Web Content Accessibility Guidelines are the main international standard for digital accessibility, and they've grown up over the years. Version one arrived in 1999, version two in 2008 brought in the four principles, version 2.1 followed in 2018, and the current version, WCAG 2.2, arrived in 2023. And those four principles? Perceivable, operable, understandable, robust. POUR. You remembered! I'm so proud. Under them sit guidelines, and under the guidelines sit testable success criteria, each with a conformance level: A, double A or triple A. Level A covers the most basic requirements, double A is the usual target for organisations and legislation, and triple A is the most demanding. WCAG 2.2 added criteria that really matter for interface design. Focus not obscured: the element with keyboard focus mustn't be hidden behind a sticky header or cookie banner. Target size minimum: buttons and links must be big enough, or spaced far enough apart, to hit reliably. Accessible authentication: logins shouldn't depend on memory tricks or puzzles. And redundant entry: don't make people type the same information twice in one process.",
          points: [
            "Principles, guidelines, then testable success criteria",
            "Levels A, double A and triple A",
            "New in 2.2: focus not obscured, target size",
            "New in 2.2: accessible authentication, redundant entry",
          ],
          example: "",
          visual: {
            kind: "timeline",
            title: "WCAG over time",
            events: [
              { label: "1999", detail: "WCAG 1.0" },
              { label: "2008", detail: "WCAG 2.0 introduces POUR" },
              { label: "2018", detail: "WCAG 2.1 extends 2.0" },
              { label: "2023", detail: "WCAG 2.2: focus, target size" },
            ],
          },
        },
        {
          heading: "Colour and contrast",
          narration:
            "Colour is where so many accessibility failures happen that it gets its own segment. There are two separate requirements, and I want you to keep them apart in your head. The first is contrast. At double A, normal text needs a contrast ratio of at least four point five to one against its background, large text needs three to one, and since WCAG 2.1, the visual boundaries of interface components, like input borders and meaningful icons, need at least three to one as well. The second requirement is use of colour: colour must never be the only way information is conveyed. Some people have a colour vision deficiency, most commonly trouble telling red from green. Others use monochrome displays or high-contrast modes. So if your form marks errors only with a red border, or your chart tells lines apart only by colour, those people miss the information entirely. A student once showed me a dashboard where green meant good and red meant bad, and nothing else. A colour-blind classmate couldn't read a single thing. The fix is redundancy. Add an error icon and a text message. Underline links as well as colouring them. Label chart lines directly, or use different patterns.",
          points: [
            "Text: 4.5 to 1 normal, 3 to 1 large at double A",
            "Interface components need 3 to 1",
            "Never use colour as the only signal",
            "Add text, icons, underlines or patterns",
          ],
          example:
            "A sign-up form that outlines invalid fields in red alone fails users with red-green colour blindness; adding a warning icon and a message such as password must be at least eight characters fixes it for everyone.",
          visual: {
            kind: "compare",
            left: { title: "Contrast (AA)", items: ["Normal text 4.5 to 1", "Large text 3 to 1", "UI components 3 to 1"] },
            right: { title: "Use of colour", items: ["Never colour alone", "Add icons and text", "Underline links"] },
          },
        },
        {
          heading: "Assistive technology",
          narration:
            "Many people use assistive technology to interact with interfaces, and your design has to play nicely with it. Screen readers, like VoiceOver on Apple devices and NVDA or JAWS on Windows, read the interface aloud and let blind users jump around by headings, links and form fields. They rely on the underlying structure, so proper headings, meaningful link text, labelled form controls and text alternatives for images aren't optional extras. They're the whole show. Screen magnifiers enlarge part of the screen, so your layout needs to survive zooming without content getting chopped off. Keyboard-only and switch users need every function reachable and operable without a mouse, with a clearly visible focus indicator showing where they are. Voice control users need visible labels that match the accessible names underneath, so they can say a button's name to press it. And captions and transcripts serve Deaf users. Here's a challenge I set every class. Put your mouse in a drawer. Now try to complete your project's main task using only the keyboard. Then turn on a screen reader and try again. The first time I did this with my own website, I couldn't even find the menu. Humbling, and very educational.",
          points: [
            "Screen readers depend on real structure and labels",
            "Magnifiers need layouts that survive zoom",
            "Keyboard and switch users need visible focus",
            "Voice control needs matching visible labels",
          ],
          example: "",
          visual: {
            kind: "tree",
            root: "Assistive technology",
            children: [
              { label: "Screen readers", children: ["Headings", "Labels", "Alt text"] },
              { label: "Magnifiers", children: ["Survive zoom"] },
              { label: "Keyboard and switch", children: ["Visible focus"] },
              { label: "Voice control", children: ["Matching labels"] },
            ],
          },
        },
        {
          heading: "Reducing barriers in your project",
          narration:
            "So how do you build all of this into your own work? Start early. Choose a colour palette that meets contrast ratios before you design a single screen, and check it with a contrast checker. Use real semantic structure, proper headings and real buttons, not styled boxes that only look right. Never rely on colour alone, and make sure every meaningful image has a text alternative. Make targets comfortably large, and keep important actions reachable with one thumb on mobile. Write in plain language, and give error messages that explain how to fix the problem. Then test. Run automated accessibility checkers, which catch some issues like missing labels and low contrast, but remember they can't catch everything. A checker can't tell you whether your alt text actually makes sense. Do manual keyboard and screen reader checks, and wherever possible include people with disabilities in your usability testing. And when you describe your users, use the persona spectrum. It turns accessibility from a compliance checklist into genuine design for all. Next week is our final lecture, and we're going to gaze into the future: voice, AI, augmented reality, and a couple of old laws that refuse to retire. See you then!",
          points: [
            "Pick an accessible palette before designing screens",
            "Use semantic structure and text alternatives",
            "Automated checks plus manual keyboard and screen reader tests",
            "Include disabled people in testing",
          ],
          example: "",
          visual: {
            kind: "flow",
            title: "Building in accessibility",
            steps: ["Accessible palette", "Semantic structure", "Automated checks", "Keyboard and screen reader", "Test with disabled users"],
          },
        },
      ],
      takeaways: [
        "The social model sees disability as a mismatch between people and their environment, which designers can reduce.",
        "Impairments can be permanent, temporary or situational, so accessible design helps far more people than expected.",
        "The curb-cut effect is when a feature designed for disabled people benefits everyone.",
        "WCAG 2.2 is organised under perceivable, operable, understandable and robust, with levels A, double A and triple A.",
        "Meet contrast ratios and never use colour as the only way to convey information.",
        "Design with assistive technologies in mind and test with keyboard, screen reader and real users.",
      ],
      video: {
        youtubeId: "Hui87z2Vx8o",
        title: "Web Accessibility Perspectives: Colors with Good Contrast",
        channel: "W3C Web Accessibility Initiative (WAI)",
        intro: "Here's a very short video from the people who write WCAG, showing how good contrast helps far more people than you might think.",
      },
    },
    12: {
      title: "User Interfaces of Tomorrow",
      hook: "Interfaces are leaving the rectangle of the screen and moving into our voices, our surroundings and our bodies. The good news is that the principles you learned this semester come with you.",
      objectives: [
        "Describe emerging interfaces including voice, conversational AI, AR, VR, gesture and wearables",
        "Identify design challenges such as discoverability, trust and fatigue in new interfaces",
        "Apply Fitts's law and Hick's law to targets and choices in any interface",
        "Reflect critically on the ethical implications of future interfaces",
      ],
      segments: [
        {
          heading: "Beyond the screen",
          narration:
            "Hello, everyone, and welcome to our very last lecture together. I'm a little bit emotional. Last week we talked about designing for everyone. This week we look ahead, at the interfaces of tomorrow. For most of computing history, interaction meant sitting in front of a screen with a keyboard and mouse, and later holding a touchscreen in your hand. That's changing fast. Around the start of the nineteen nineties, Mark Weiser at Xerox PARC described a vision he called ubiquitous computing, where computers would fade into the background of everyday life, built into rooms, objects and even clothing. He argued that the most profound technologies are the ones that disappear. Smart speakers, smartwatches, connected cars and home automation are all steps towards that vision. Interfaces now include speech, gesture, gaze, location, even how your body moves. That opens up amazing opportunities, like interacting when your hands and eyes are busy. But it also creates new problems, because so many of the signifiers and feedback mechanisms that screens give us simply vanish. So today we'll tour the frontiers, and I'll show you how everything you've learned still applies.",
          points: [
            "Ubiquitous computing: technology fades into the background",
            "Speech, gesture, gaze, location and movement",
            "New opportunities when hands and eyes are busy",
            "Screen-based signifiers and feedback often disappear",
          ],
          example: "",
          visual: {
            kind: "timeline",
            title: "Interfaces over time",
            events: [
              { label: "1970s", detail: "Graphical interfaces at Xerox PARC" },
              { label: "1984", detail: "Macintosh popularises the desktop" },
              { label: "1991", detail: "Weiser describes ubiquitous computing" },
              { label: "Late 2000s", detail: "Multi-touch smartphones go mainstream" },
              { label: "Today", detail: "Voice, AI, AR and wearables" },
            ],
          },
        },
        {
          heading: "Voice and conversational interfaces",
          narration:
            "Let's start with voice. Voice interfaces let people speak to systems, like smart speakers and in-car assistants. They're quick for simple requests, accessible for people who can't easily use screens, and handy when your hands are covered in flour. But they have one fundamental design challenge, and I want you to remember it: discoverability. A graphical interface shows you its menus and buttons, so you can see what's possible. A voice interface has no visible menu. So how do users know which commands exist? They don't. They guess. And when the guesses fail, lots of people give up and stick to a few safe commands, like setting timers and asking about the weather. My own smart speaker is, as far as I can tell, a very expensive egg timer. Voice also loads up your memory, because spoken options vanish the instant you hear them. Try remembering option four out of seven read aloud. So good voice design offers examples of what you can say, keeps spoken options short, confirms important actions, gives clear feedback that it's listening and has understood, and recovers gracefully when it mishears you. Which, in my house, is often.",
          points: [
            "Fast, hands-free and accessible for many",
            "Discoverability: no visible menu of commands",
            "Spoken lists increase memory load",
            "Offer examples, confirm actions, recover gracefully",
          ],
          example:
            "A voice banking assistant that says you can check a balance, pay a bill or hear recent transactions tells users what is possible, whereas one that only asks how it can help leaves them guessing.",
          visual: {
            kind: "compare",
            left: { title: "Graphical interface", items: ["Menus are visible", "Options stay on screen", "Easy to explore"] },
            right: { title: "Voice interface", items: ["No visible menu", "Spoken options vanish", "Users must guess"] },
          },
        },
        {
          heading: "AI interfaces and trust",
          narration:
            "Now, AI interfaces. Chat assistants, recommendation systems, that sort of thing. They raise some genuinely new design questions. A traditional button does the same thing every time you press it. An AI system's output is probabilistic. The same request can give you different answers, and some of those answers will be wrong while sounding completely confident. Think about what that does to mental models, from week ten. Users might assume the system knows more than it does, or trust it completely after a few good results. So what are we aiming for? Calibrated trust. People relying on the system when it's reliable, and checking it when it's not. How do we design for that? Set clear expectations about what the system can and can't do. Show sources or reasoning where possible. Make it easy to correct, undo or override the output. And keep a human in control of high-stakes decisions. Now, does any of that sound familiar? It should. That's visibility of system status, and user control and freedom, from Nielsen's heuristics, plus Norman's gulf of evaluation. Old principles, brand-new kind of system. I find that deeply reassuring.",
          points: [
            "AI output is probabilistic and can be confidently wrong",
            "Aim for calibrated trust",
            "Set expectations, show sources, allow overrides",
            "Classic heuristics still apply",
          ],
          example: "",
          visual: {
            kind: "tree",
            root: "Designing for calibrated trust",
            children: [
              { label: "Set expectations", children: ["What it can't do"] },
              { label: "Show its working", children: ["Sources", "Reasoning"] },
              { label: "User control", children: ["Correct", "Undo", "Override"] },
              { label: "Human in charge", children: ["High-stakes decisions"] },
            ],
          },
        },
        {
          heading: "Augmented reality, virtual reality and gesture",
          narration:
            "Next, augmented and virtual reality. Augmented reality overlays digital content onto the physical world, through a phone camera or a headset. Virtual reality replaces the physical world entirely with an immersive environment. Both create spatial interfaces, where controls float in three-dimensional space around you. They make some wonderful things possible, like seeing whether a sofa fits your lounge room before you buy it, or rehearsing surgical procedures in simulation. But they bring new usability headaches too. Gesture input, like pinching in mid-air, is often a hidden affordance. Remember those from week nine? Nothing signifies which gestures exist. Holding your arms up to poke at floating controls gets tiring fast, and designers even have a name for it: gorilla arm. Try holding your arm out straight for five minutes. Actually, no, please don't. A mismatch between what your eyes see and what your body feels can cause motion sickness in virtual reality. And in augmented reality, digital content competes with the real world for your attention, which can be dangerous while walking or driving. The fixes? Familiar ones. Clear signifiers, consistent gestures, strong feedback, comfortable resting positions, and testing in realistic contexts of use.",
          points: [
            "AR overlays the world; VR replaces it",
            "Mid-air gestures are often hidden affordances",
            "Fatigue and motion sickness are real risks",
            "Attention and safety matter in real contexts",
          ],
          example: "",
          visual: {
            kind: "tree",
            root: "Spatial interface problems",
            children: [
              { label: "Hidden gestures", children: ["Add signifiers"] },
              { label: "Gorilla arm", children: ["Comfortable resting positions"] },
              { label: "Motion sickness", children: ["Match eyes and body"] },
              { label: "Split attention", children: ["Test in real contexts"] },
            ],
          },
        },
        {
          heading: "Wearables and ambient devices",
          narration:
            "Now let's shrink things down. Wearables, like smartwatches and fitness trackers, and ambient devices around the home, change the shape of interaction completely. A smartwatch interaction is usually a glance lasting a few seconds. So information has to be readable instantly, and actions have to be quick. The screens are tiny, which means small targets, and your finger covers half the display, which pushes error rates up. Hold that thought, because it connects to a law we'll meet in a moment. Designers respond by keeping watch interfaces brutally simple, prioritising a handful of key actions, and moving anything complicated to a paired phone. Notifications become central, and with them the risk of interrupting people all day long. My watch once congratulated me on reaching my standing goal while I was standing in a very solemn meeting. Not its finest moment. Ambient and smart home devices often have no screen at all, and communicate with lights, sounds or vibrations, which makes the gulf of evaluation a real problem. Did the lights not turn on because the command failed, or because the device is offline? And across all these devices, context of use matters even more than on a desktop.",
          points: [
            "Glanceable: seconds, not minutes",
            "Tiny screens mean small targets and more errors",
            "Screenless devices widen the gulf of evaluation",
            "Context of use matters even more",
          ],
          example: "",
        },
        {
          heading: "Laws that travel: Fitts and Hick",
          narration:
            "Some principles survive every change in technology, and two classic laws from psychology are especially useful. First, Fitts's law. It says the time to reach a target grows with the distance to it, and shrinks as the target gets bigger. More precisely, movement time depends on a logarithm of distance relative to target width. In plain English: big, close targets are fast, small, distant ones are slow. That's why important buttons should be large, why related controls should sit close together, and why screen edges and corners are so quick to hit with a mouse. The pointer stops at the edge, so the target is effectively infinitely deep. You literally can't overshoot it. Second, Hick's law, also called the Hick-Hyman law. It says decision time increases logarithmically with the number of choices. Each extra option adds a little more thinking time, so long, unstructured menus slow people down. Fewer options, grouped sensibly with clear labels, speed up decisions. I've watched people freeze in front of a café menu with forty drinks on it. That's Hick's law, with a side of oat milk. And both laws apply to watches, headsets and car dashboards just as much as desktops.",
          points: [
            "Fitts: time depends on target distance and size",
            "Large, close targets and screen edges are fast",
            "Hick: decision time grows logarithmically with choices",
            "Fewer, well-grouped options speed decisions",
          ],
          example:
            "In a car touchscreen, putting the five most-used functions on large buttons near the driver applies both laws: bigger, closer targets are quicker to hit, and fewer choices are quicker to decide between.",
          visual: {
            kind: "formula",
            formula: "Fitts: MT = a + b × log2(D ÷ W + 1)",
            steps: [
              "Distance 256, width 32: log2(9) ≈ 3.17 bits",
              "Double the width to 64: log2(5) ≈ 2.32 bits",
              "Lower difficulty means faster movement",
              "Hick: log2(n + 1), so 3 choices give 2, 7 give 3",
            ],
          },
        },
        {
          heading: "Designing tomorrow responsibly",
          narration:
            "Now, a serious moment, because new interfaces bring ethical responsibilities. Always-listening voice assistants and camera-equipped glasses collect data about users, and about the people around them, sometimes without those bystanders even knowing. AI systems can reflect biases in their training data, working better for some accents, skin tones or languages than others. And notice, that's an accessibility issue, from last week, as much as an ethical one. Persuasive design can tip over into manipulation through dark patterns, like making it easy to subscribe and maddeningly hard to cancel, or nudging people to share more data than they meant to. Highly engaging interfaces can also compete for attention in ways that quietly harm wellbeing. So what do we do? Human-centred design gives us a way to respond. Its focus on real people's needs, its commitment to inclusion, and its habit of testing and listening act as a check on technology that serves a business at the user's expense. You're going to be the people building these systems. So part of your job is to ask not only whether we can build this, but whether we should. And for whom. Please keep asking those questions. Loudly, if you have to.",
          points: [
            "Privacy for users and bystanders",
            "Bias in AI is also an accessibility issue",
            "Dark patterns manipulate rather than serve",
            "Ask whether we should, not just whether we can",
          ],
          example: "",
          visual: {
            kind: "stack",
            title: "Ethical risks to design against",
            layers: ["Privacy of users and bystanders", "Biased AI", "Dark patterns", "Attention and wellbeing"],
          },
        },
        {
          heading: "What carries forward",
          narration:
            "So, here we are. Let's connect the threads one last time. Whatever shape future interfaces take, the core ideas from this subject travel with you. Start with users, tasks and context. Involve users throughout, and iterate based on evaluation. Use the Double Diamond to explore problems before solutions, and many solutions before committing to one. Prototype at the right fidelity, test with real people, and analyse the results honestly, with numbers and with words. Make actions discoverable with clear signifiers, give feedback, and support accurate mental models. And design for the full range of human abilities. A voice assistant, an augmented reality headset, an AI agent: you can analyse every one of them with these tools. What does the gulf of execution look like when there are no buttons? How does the system show its status? What does the persona spectrum say about situational impairments? How many choices are you asking people to weigh? The technology will keep changing. The human at the centre won't. Thank you, all of you, for a wonderful semester. Keep noticing terrible doors, keep arguing with me, and go and build things that make people's lives a little easier. Goodbye, and good luck!",
          points: [
            "Users, tasks and context still come first",
            "Iterate through research, prototyping and testing",
            "Signifiers, feedback and mental models still apply",
            "Design for the full range of abilities",
          ],
          example: "",
          visual: {
            kind: "flow",
            title: "What carries forward",
            steps: ["Users, tasks, context", "Research and define", "Ideate and prototype", "Test and analyse", "Design for all"],
          },
        },
      ],
      takeaways: [
        "Ubiquitous computing moves interaction off the screen into voice, gesture, wearables and the environment.",
        "Voice interfaces struggle with discoverability because there is no visible menu of commands.",
        "AI interfaces should set expectations, show their status and keep users in control to build calibrated trust.",
        "Fitts's law ties target time to distance and size; Hick's law ties decision time logarithmically to the number of choices.",
        "Emerging interfaces raise ethical questions about privacy, bias and manipulation.",
        "Human-centred design principles apply to every new interface technology.",
      ],
      video: {
        youtubeId: "Ff1QwznMffA",
        title: "Ubicomp (Ubiquitous Computing) - Computerphile",
        channel: "Computerphile",
        intro: "For our very last video of the semester, here's a lovely explainer on ubiquitous computing, the idea that started today's lecture.",
      },
    },
  },
};

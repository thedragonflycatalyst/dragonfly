# The Builder-Owner

*A complete course in owning, designing and building a product, for any business*

By Phyllis · November 2026

## Contents

**Preface** — who this book is for, what you will be able to do, how to use it, the 12-month path

**Part I — The Role**

1. What a builder-owner does
2. The formal education
3. Your first 30, 60 and 90 days

**Part II — Understanding Users and the Business**

4. Discovery: interviewing users and watching them work
5. Learning the domain and modeling the business
6. Strategy, roadmaps and saying no
7. Metrics and success measures

**Part III — Design**

8. Design principles for tools people use every day
9. Interaction patterns: undo, escalation, defaults and errors
10. Design systems, accessibility and content

**Part IV — Engineering**

11. Architecture for a small team
12. Data modeling: the database as a contract
13. Security and access control
14. Money: payments, ledgers, refunds and records
15. Sensitive data, privacy and compliance
16. Testing and the definition of done
17. Shipping: environments, CI, releases and app stores
18. Building with AI: worker, reviewer and their limits

**Part V — Operating**

19. Teams and agents: handoffs, checkpoints and coordination
20. Risk, cost and vendor management
21. Stakeholders: escalation and owner-only decisions
22. The operating cadence: daily, weekly, quarterly
23. Getting the job and growing in it
24. Writing: the builder-owner's most-used tool

**Part VI — Playbooks for Any Business**

25. Retail, restaurants and online shops
26. Professional services (law, accounting, agencies, consulting)
27. Health, wellness and fitness businesses
28. Field services and trades
29. Nonprofits, community organizations, education and the public sector
30. Internal tools inside larger organizations
31. When the software is the business

**Appendices**

- A. Templates
- B. Checklists
- C. A complete worked case: refunds, voids and receipts
- D. Glossary
- E. Reading list and 52-week study plan
- F. Capstone and self-assessment
- G. Debugging field guide
- H. Estimation and planning field guide
- I. Interview question bank with model answers
- J. Sample artifacts, filled in
- K. Answer guide to selected exercises
- L. Questions readers ask
- M. A day-by-day plan for your first two weeks; N. Quick reference

**Afterword**

*About the author.* Phyllis is the product owner, project manager, lead designer and lead engineer of a coaching app for personal trainers and their clients, built for The Dragonfly Catalyst on Expo/React Native, PostgreSQL with row-level security, serverless functions and Stripe. She works in a network of AI and human builders coordinated through a shared hub, under a business owner who is himself a trainer.

*A note on facts.* Laws, platform policies, prices and certifications change. Where this book names them, it describes them as of late 2026 and points you to the official source. Check current versions, and get professional legal, tax and accounting advice for your situation.

## Preface

This book teaches one job: owning a product from the first conversation with a user to the money landing in the bank, and being able to design it and build it yourself. In most companies that job is split across four people: a product owner, a project manager, a designer and an engineer. In a small business, a startup, a nonprofit or a new internal team, it is usually one person, or one person directing a few helpers. I call that person the builder-owner.

I do this job every day on a coaching app for personal trainers. The trainer builds programs, runs sessions, tracks clients' progress and takes payment, and the clients follow along on their phones. I own the roadmap, I write the database migrations, I draw the screens, I test refunds, I write the privacy rules for health data, and I report to the business owner on what it costs and what could go wrong. I work alongside other builders who own other apps, and we share a website, a database and a set of rules. Nothing in this book is theory I have not had to apply under a deadline.

The examples come from fitness software because that is what I build. The lessons do not depend on fitness. A bakery's ordering system, a law firm's intake portal, a plumber's scheduling app, a school's enrollment site and a hospital's internal tools all face the same problems: understanding the people who use them, deciding what to build first, keeping money and personal data safe, shipping without breaking things, and telling the person who pays for it the truth about cost and risk.

## Who this book is for

You will get the most from this book if you are one of these people:

- **A career changer** who wants to move into product, design or engineering and needs a map of everything the job touches.
- **A founder or small-business owner** who is building software for your own business, or directing someone who is.
- **A specialist** (an engineer, a designer, an analyst, a project manager) who wants to take on the whole product and be trusted with it.
- **A student** who wants the practical half of what a degree program leaves out.
- **A manager** who hires or supervises product people and wants to know what good looks like.

You do not need to be a programmer to start. You will need to become comfortable reading and writing some code by the end, because the builder-owner who cannot read the code cannot judge the work, and cannot tell when a promise is cheap or expensive. Chapter 2 lays out exactly what to learn and in what order.

## What you will be able to do

By the end of the book, and the exercises in it, you should be able to do each of the following in a real job:

1. Take over an existing product or start a new one, and within 30 days produce an intake: roadmap, costs, risks and the decisions you need from the owner.
2. Interview users and watch them work, then turn what you learn into a short list of changes ranked by the time or money they save.
3. Write a one-page plan for a feature that an engineer can build and a tester can check.
4. Design screens that people use all day without training, including the hard cases: errors, undo, empty states and accessibility.
5. Model a business in a database: tables, relationships, constraints and access rules that make mistakes impossible rather than merely unlikely.
6. Handle money correctly: payments, refunds, voids, receipts and records you must keep for years.
7. Protect sensitive data, from health records to home addresses, with consent, access control, export and deletion.
8. Test your work to a written definition of done, and release it safely to the web and the app stores.
9. Use AI tools as workers and reviewers without handing them decisions they should not make.
10. Coordinate with other builders, human or AI, through written handoffs that survive someone being out sick or running out of time.
11. Run a weekly operating cadence and report status, cost and risk in a way an owner can act on in five minutes.
12. Get hired into the role, or create it where you work.

## How to use this book

The book has six parts. Part I defines the role, the education behind it and your first 90 days. Part II covers understanding users and the business. Part III covers design. Part IV covers engineering, with the most space given to the things that hurt people when they go wrong: security, money and sensitive data. Part V covers how to operate: teams, risk, cost, stakeholders, cadence, career and writing. Part VI applies the whole method to seven kinds of organization, from restaurants to software companies. The appendices hold the templates and checklists I use, a glossary and a reading list.

Each chapter ends with **exercises**. Do them. The difference between someone who has read about product ownership and someone who can do it is about two hundred hours of deliberate practice on real problems. The exercises are designed so that, by the end, you have a portfolio: a real intake document, a real interview write-up, a real data model, a real test suite and a real shipped feature. That portfolio is what gets you hired (Chapter 23).

Read Part I first. After that, you can read in order or jump to what your job needs this week. If you are already an engineer, Part II and Part V will probably teach you the most. If you are already a product manager, Part IV is the part that will change how people trust you.

## The 12-month path

If you are starting from zero and can give this ten to fifteen hours a week, here is a realistic year. Chapter 2 gives the detail behind each step.

| Months | Focus | Output you should have at the end |
| --- | --- | --- |
| 1–2 | Foundations: how the web works, one programming language, basic SQL, Git | A small web page with a form that saves to a database |
| 3–4 | Users and business: interviewing, domain modeling, writing plans | Interview notes from 5 real people and a one-page plan for a tool that helps them |
| 5–6 | Design: layout, interaction patterns, accessibility, a design system | Clickable prototype of that tool, tested with 3 of those people |
| 7–9 | Engineering: data modeling, access control, testing, payments in test mode | A working version with sign-in, row-level access rules, tests and a test-mode payment flow |
| 10–11 | Shipping and operating: CI, releases, monitoring, cost tracking, risk register | The tool live for your 5 users, with a weekly status note you send yourself |
| 12 | Career: portfolio, case study, interviews | A written case study and three applications or one internal proposal |

One honest warning before we start. This job rewards judgment more than knowledge, and judgment comes from making decisions and seeing what happens. A book can give you the knowledge, the checklists and the mistakes I have already made. It cannot make the decisions for you. Go build something small and real as soon as you can, and let it teach you.

## A note on rules I follow

Throughout the book you will see a few rules repeated, because they are the rules that have saved me most often:

- **Never destroy a record you might need to explain later.** Correct it, reverse it or retire it, with a reason.
- **Make the safe action the easy action.** Undo beats "Are you sure?"
- **Write it down where the next person will look.** If it only lives in a chat, it does not exist.
- **Ask the owner only for owner decisions,** and when you ask, bring a recommendation.
- **Done means tested, reviewed and verified on the real devices,** not "it works on my machine."

None of these is original. Every one of them was learned the expensive way by someone, often me.

# Part I — The Role

## Chapter 1. What a builder-owner does

A builder-owner is accountable for whether a product works for the people who use it and the business that pays for it. Not whether the code compiles, not whether the screens are pretty, not whether the project hit its dates, though all three matter. Whether it *works*: people use it, it does what they need, it does not hurt them, and it earns or saves more than it costs.

That accountability is the whole job. Everything else in this book is a technique for meeting it.

### 1.1 Output versus outcome

The first habit to build is to separate output from outcome.

- **Output** is what you produced: a feature, a screen, a migration, a release.
- **Outcome** is what changed in the world because of it: a trainer spends 20 fewer minutes a week chasing payments, a client logs workouts three times a week instead of once, refunds stop generating support emails.

Teams that measure output ship a lot and improve little. A team can deliver forty features in a quarter and leave every user exactly as frustrated as before. A builder-owner measures outcomes and treats output as a cost paid to get them.

This changes how you talk. Instead of "we shipped the refund screen," you say "trainers can now refund a client in under a minute with a receipt sent automatically; before, it took a call to the bank and an email they wrote by hand." The second sentence is longer, and it is the only one an owner can make a decision with.

### 1.2 The four hats

The builder-owner wears four hats. You will not wear them all equally every day, but you must be competent in each and you must know which one you are wearing.

| Hat | The question it answers | Typical work | Failure when missing |
| --- | --- | --- | --- |
| Product owner | What should we build, for whom, and why now? | Interviews, roadmap, priorities, acceptance criteria | A well-built product nobody needs |
| Project manager | When will it be done, what is blocking it, what does it cost? | Plans, status, dependencies, risk register, budget | Endless "almost done" and surprise bills |
| Designer | How will people understand and use it? | Flows, screens, words, accessibility, testing with users | A powerful product nobody can figure out |
| Engineer | How does it actually work, and will it keep working? | Data model, code, tests, security, releases | A beautiful demo that loses data |

When you hold all four, you can make trade-offs that a split team cannot. A designer alone might insist on an elegant interaction that costs three weeks. An engineer alone might propose a cheap version that confuses users. A builder-owner sees both costs at once and can find the version that costs four days and confuses nobody. That ability to trade across disciplines is the real value of the role.

The danger is the opposite: you can also cheat across disciplines. Under deadline, the engineer in you can quietly overrule the designer, or the product owner in you can promise a date the engineer in you knows is false. The discipline that prevents this is to write down decisions with their reasons (Chapter 19) and to keep a definition of done that you do not bend (Chapter 16).

### 1.3 Decision rights

The most common source of misery in product work is not knowing who decides what. Settle it in writing in your first week (Chapter 3).

A workable split for a small business looks like this:

**The owner decides:**

- Spending money beyond an agreed budget.
- Prices customers pay.
- Public releases and their timing when they are commitments to customers.
- The product's name and brand.
- Anything involving credentials, legal agreements or production customer data.
- Major direction: which market, which customers, which big bets.

**The builder-owner decides:**

- What to build next within the agreed direction.
- How it should work and look.
- How it is built, tested and released inside the agreed process.
- What to fix first when things break.
- Which routine work to hand to whom.

**Shared, with the builder-owner recommending:**

- Roadmap changes that move a promised date.
- New vendors or tools with recurring costs.
- Trade-offs between scope and date for a commitment the owner made.

On my project, the owner wrote these down as standing permissions: what I may do without asking and what I must always ask about first. The list of "always ask" items is short and specific: spending money, passwords and API keys, production databases and live user data, public releases, anything that permanently deletes something, and messages sent in the owner's name. Everything else is mine to decide and to answer for. That clarity is worth more than any tool.

If your organization has not written this down, write a draft yourself and ask the owner to edit it. People who would never sit down to define your authority from scratch will happily correct a draft.

### 1.4 Accountability without control

You will usually be accountable for things you do not fully control. Users will not behave as you predicted. A vendor will change its pricing. Another team will change a shared table. An app store will reject your release for a policy you did not know existed.

The builder-owner's response to this is not to demand control. It is to:

1. **See it early.** Keep a risk register (Chapter 20) and read it weekly.
2. **Make dependencies explicit.** If another team's table feeds your screen, write that down and agree on how changes will be announced.
3. **Build in recovery.** Design so that mistakes can be reversed: soft deletes, audit logs, undo, backups you have actually restored from.
4. **Say it out loud.** When something outside your control threatens an outcome, tell the owner with a recommendation, not after the fact.

### 1.5 What a week actually looks like

To make this concrete, here is a real week, lightly simplified.

**Monday.** Read the shared message board for anything addressed to me. A teammate who owns the scheduling app asks whether I plan to change any calendar fields his app reads; I reply that I will message him before I do. Review the week's priority: finishing refunds and voids, with receipts emailed automatically.

**Tuesday.** Write the database change that adds a "void" status and a required reason to payments, and a rule that paid payments can never be deleted. Write tests proving a trainer can void their own payment and cannot touch another trainer's. Ask the owner to approve applying it to the live database, because production changes are his call.

**Wednesday.** Build the refund and void screen. The reason field is required. The old "Delete record" menu item is removed, because financial records are kept for seven years. Test on the web dashboard and on an Android phone.

**Thursday.** Discover that the receipt endpoint, built by another teammate, rejects calls from the web dashboard because the browser blocks requests between the two sites. Confirm the endpoint is alive by calling it from its own site. Write a short, specific note to the teammate asking him to allow the dashboard's address. Android is unaffected.

**Friday.** Write the intake for the operations lead: roadmap to first public release, every recurring cost, top five risks, what I need from the owner. Send the owner ten questions about his daily workflow as a trainer so the next quarter's work targets his biggest time sinks. Update my status card so anyone can see where things stand.

Notice what is in that week. There is code. There is design. There is a database change with tests. There is coordination with two other people. There is a written status. There is a request for an owner decision with a clear scope. There is user research. That mix is the job.

### 1.6 The traits that matter

After years of doing this and working beside others who do it, these are the traits I see in people who succeed:

- **Ownership.** They treat a broken thing as theirs to fix or escalate, even if someone else broke it.
- **Plain speech.** They can explain a technical trade-off to an owner in two sentences and a business constraint to an engineer in two more.
- **Curiosity about users.** They would rather watch someone use the product than argue about how they might.
- **Respect for irreversible actions.** They slow down for anything that cannot be undone: deleting data, moving money, sending messages, releasing publicly.
- **Bias to written records.** They write decisions, plans and handoffs down where others will find them.
- **Comfort with incomplete information.** They make the best decision available, say what would change it, and move.
- **Low ego about their own work.** They ask for review and act on it.

Notice what is not on the list: genius, charisma or encyclopedic knowledge of any one technology. Those help. They are not what makes the difference.

### 1.7 Common misconceptions

**"The product owner just writes tickets."** Tickets are a byproduct. The work is deciding what matters and making sure it happens.

**"If I can code, I don't need process."** Process is how you stay trustworthy when you are tired, rushed or wrong. The bigger your powers, the more you need it.

**"Users will tell me what to build."** Users will tell you their problems, often precisely. They are usually unreliable designers of solutions. Chapter 4 shows how to listen for the problem.

**"Good design is about looks."** Good design is mostly about what happens when things go wrong: errors, mistakes, unclear states and the edge cases nobody drew.

**"Security and privacy are someone else's job."** In a small business there is no someone else. You are it.

### 1.8 How this role exists in different organizations

| Setting | What the role is usually called | What changes |
| --- | --- | --- |
| Startup, 1–10 people | Founding engineer, technical cofounder, head of product | You do everything; speed matters more than polish; record-keeping is often neglected and later regretted |
| Small business with software | IT lead, digital manager, operations developer | Software supports a non-software business; the owner may not be technical; reliability and cost dominate |
| Agency or consultancy | Technical lead, product lead | Multiple clients and owners; scope control and written agreements matter most |
| Mid-size company | Product manager with technical depth, tech lead, staff engineer | Roles are split; your value is bridging them |
| Nonprofit or public sector | Program technologist, digital services lead | Budgets are fixed, privacy and accessibility rules are stricter, procurement is slow |
| Internal tools at a large company | Internal product owner, platform lead | Users are colleagues; adoption is not guaranteed even when use is mandatory |

The chapters that follow apply in all of these settings. Where the setting changes the advice, I will say so.

### Exercises

1. Pick a piece of software you use at work or in daily life. Write one sentence describing an output it shipped recently and one sentence describing the outcome it was presumably aiming for. How would you measure that outcome?
2. Draft a decision-rights list for a real or imagined product, using the three-way split in section 1.3. Keep the "owner decides" list under ten items.
3. For one week, keep a log of your own work in 30-minute blocks and tag each block with the hat you were wearing. Which hat is weakest? That is where to start Chapter 2.

## Chapter 2. The formal education

There is no single degree called "builder-owner." The role draws on five fields that universities teach separately: computer science, information systems, human-computer interaction, business management and law and ethics. This chapter lays out what a degree-equivalent education in this role contains, what you can skip, what you cannot, and the paths (degrees, certificates and self-study) that get you there.

The principle behind the curriculum: learn each field to the depth where you can make sound decisions and recognize when you need a specialist. You do not need to be a cryptographer. You need to know never to invent your own encryption, and to recognize a design that leaks data.

### 2.1 The five fields and how deep to go

| Field | Depth you need | Why |
| --- | --- | --- |
| Computer science and software engineering | Working practitioner: you write and review production code | You cannot judge cost, risk or quality of work you cannot read |
| Information systems and data | Strong: you design schemas and reason about data flows | Most business software is a database with screens; the data model is the product |
| Human-computer interaction and design | Working practitioner: you design and test interfaces | Products fail more often from confusion than from bugs |
| Business and management | Solid generalist: finance, operations, marketing basics, project management | You must speak in costs, revenue and risk |
| Law, ethics, security and privacy | Literate: you know the rules that apply and when to call an expert | The mistakes here harm people and can end a business |

### 2.2 The core curriculum

What follows is the content of a two-year intensive program, organized as fifteen courses. A university degree would spread this over four years with general education around it. A motivated self-learner can cover it in 12 to 24 months part-time. For each course I list what it covers, the outcome you should be able to demonstrate, and representative resources.

#### Track A — Software foundations

**A1. Programming fundamentals.** Variables, types, control flow, functions, data structures (lists, maps, sets), recursion, reading error messages, debugging. Learn one language well. For product work in 2026, TypeScript is the most useful single choice because it runs in the browser, on servers and in mobile apps through frameworks like React Native. Python is the best second language for data and automation.

- *Outcome:* write a 300-line program that reads a file, transforms the data and writes a report, with tests.
- *Resources:* Harvard's free CS50 course; the MDN Web Docs JavaScript guide; the official TypeScript handbook.

**A2. How the web works.** HTTP requests and responses, status codes, headers, cookies, DNS, TLS, browsers, the difference between client and server, REST and JSON, cross-origin rules (CORS). Half of the bugs that confuse new builders are web-plumbing bugs.

- *Outcome:* explain, step by step, what happens when someone types a web address and presses Enter, and diagnose a CORS error from the browser's developer tools.
- *Resources:* MDN's HTTP documentation; your browser's network panel, used daily.

**A3. Data structures, algorithms and complexity.** Big-O notation at an intuitive level, why a database index makes lookups fast, sorting and searching, hashing, trees and graphs. You need this to recognize when something will be slow at scale, not to pass puzzle interviews.

- *Outcome:* predict whether an operation will stay fast at 10,000 records and at 10 million, and say why.

**A4. Version control and collaboration.** Git: commits, branches, merges, rebases, pull requests, code review, resolving conflicts, reading history to find when a bug was introduced.

- *Outcome:* run a feature from branch to reviewed, merged pull request without help, and recover from a bad merge.

**A5. Software engineering practice.** Testing (unit, integration, end-to-end), continuous integration, code review, refactoring, documentation, dependency management, environments (development, staging, production), logging and monitoring.

- *Outcome:* a repository where every change runs tests automatically before it can be merged.
- *Resources:* *Accelerate* by Forsgren, Humble and Kim for the evidence behind these practices.

#### Track B — Data and systems

**B1. Databases and SQL.** The relational model, tables, keys, joins, normalization and when to break it, constraints, transactions, indexes, migrations. PostgreSQL is the best one to learn; it is free, standard and used widely.

- *Outcome:* design a schema for a small business (customers, orders, payments, refunds) with constraints that make invalid states impossible, and write the ten queries the owner will ask for.
- *Resources:* the PostgreSQL documentation's tutorial; *Designing Data-Intensive Applications* by Martin Kleppmann once you have the basics.

**B2. Systems architecture.** Clients and servers, APIs, authentication and sessions, queues and background jobs, caching, file storage, third-party services, serverless functions, how a hosted backend like Supabase or Firebase works underneath.

- *Outcome:* draw the architecture of a product you use, labeling each component, what calls what, and where data is stored.

**B3. Security engineering.** Authentication versus authorization, password storage, tokens, least privilege, row-level security, input validation, the OWASP Top 10 web risks, secrets management, logging without leaking, threat modeling.

- *Outcome:* a threat model for your own project and tests proving one user cannot read another user's data.
- *Resources:* the OWASP Top 10 and OWASP Cheat Sheet Series (free); CompTIA Security+ if you want a credential.

#### Track C — Design

**C1. Human-computer interaction.** How people perceive, remember and decide; mental models; affordances and feedback; error prevention; usability heuristics; cognitive load.

- *Outcome:* evaluate an existing app against a heuristic set and write ranked findings.
- *Resources:* *The Design of Everyday Things* by Don Norman; *Don't Make Me Think* by Steve Krug; Nielsen Norman Group's free articles.

**C2. Interaction and visual design.** Layout, grids, typography, color, hierarchy, spacing, components, design systems, prototyping in a tool like Figma or directly in code, writing interface text.

- *Outcome:* a clickable prototype of a five-screen flow that a stranger can complete without help.

**C3. User research.** Interviewing, observation, usability testing, surveys and their limits, synthesizing findings, avoiding leading questions.

- *Outcome:* five interviews and one usability test, written up with ranked findings.
- *Resources:* *The Mom Test* by Rob Fitzpatrick; *Continuous Discovery Habits* by Teresa Torres.

**C4. Accessibility.** WCAG 2.2 success criteria, screen readers, keyboard navigation, contrast, motion, touch target size, plain language.

- *Outcome:* audit your prototype with a screen reader and fix what fails.

#### Track D — Business

**D1. Product management.** Strategy, discovery, prioritization frameworks, roadmaps, writing requirements, working with engineering and design, launch, measuring outcomes.

- *Outcome:* a one-page strategy and a quarterly roadmap for your project.
- *Resources:* *Inspired* by Marty Cagan; Basecamp's free book *Shape Up*.

**D2. Business fundamentals.** Unit economics, pricing, revenue models, reading a profit and loss statement, cash flow, cost of goods sold for software (hosting, vendors, support), customer acquisition cost and lifetime value, basic contracts.

- *Outcome:* a cost model for your product showing what it costs per user per month at 10, 1,000 and 100,000 users.

**D3. Project and operations management.** Planning under uncertainty, estimation, dependencies, risk registers, status reporting, agile methods (Scrum, Kanban) and when they help or hurt, vendor management, incident response.

- *Outcome:* run a six-week project with a written plan, weekly status and a closing review.

#### Track E — Law, ethics and privacy

**E1. Privacy, compliance and ethics.** Privacy principles (notice, consent, purpose limitation, data minimization, access, deletion), the major laws you are likely to meet (the EU's GDPR, California's CCPA/CPRA, U.S. state privacy laws, HIPAA for U.S. health providers and their business associates, payment card rules under PCI DSS), app store policies, accessibility law, consumer protection for subscriptions and refunds, intellectual property basics (copyright, trademarks, licenses for code and media).

- *Outcome:* a data inventory for your product (what personal data, where stored, who can see it, how long kept, how deleted) and a privacy notice draft a lawyer could review.
- *Resources:* the IAPP's free resources; the official text of the laws that apply to you. Laws change: check current versions, and get legal review before relying on your reading.

### 2.3 What you can skip

You do not need, for this role:

- Advanced mathematics beyond basic statistics and algebra (unless your product is mathematical).
- Compiler theory, operating system internals or low-level hardware.
- Deep machine-learning theory. You need to know how to use AI tools well and what they get wrong (Chapter 18), not how to train them.
- Mastery of more than one or two programming languages.
- Graphic illustration. You need competent visual design, not art.

You cannot skip statistics. You will read dashboards, run small experiments and be lied to by averages. Learn means and medians, distributions, sampling, confidence intervals at an intuitive level, and why correlation is not causation. A free introductory statistics course is enough.

### 2.4 Paths to the education

**University degrees.** The closest matches are a bachelor's in computer science or information systems with electives in HCI and business; a bachelor's in HCI or interaction design with strong programming electives; or a technical bachelor's followed later by an MBA or a master's in HCI. A degree gives structure, credentials and a network. It is the slowest and most expensive path, and none of these degrees alone covers all five fields.

**Certificates and certifications.** These signal knowledge to employers and give structured study. Useful ones for this role include:

| Area | Examples |
| --- | --- |
| Product ownership | Certified Scrum Product Owner (CSPO, Scrum Alliance); Professional Scrum Product Owner (PSPO, Scrum.org) |
| Project management | CAPM or PMP (Project Management Institute) |
| UX | Nielsen Norman Group UX Certification; Google UX Design Certificate |
| Cloud | AWS, Google Cloud or Microsoft Azure entry-level certifications |
| Security | CompTIA Security+ |
| Privacy | IAPP certifications such as CIPP/US, CIPP/E or CIPT |

Check current requirements and prices on each body's site; they change. A certification never substitutes for a portfolio. Treat it as structured study plus a line on a résumé.

**Self-study with a portfolio.** This is the path most builder-owners actually take. It is the cheapest and fastest, and it is harder because no one sets your deadlines. The path works if you follow two rules: build one real project throughout (the same project, growing), and get outside review regularly from people who do the work.

**Apprenticeship inside a company.** If you already work somewhere that uses software, volunteer for the small internal tool nobody owns. A spreadsheet that runs a department is a product. Owning its replacement is a legitimate first product job.

### 2.5 The experience half

Education gives you the vocabulary. Experience gives you judgment. The experiences that teach the most, roughly in the order you should seek them:

1. **Shipping something real to strangers.** Not friends. Strangers tell you the truth through their behavior.
2. **Handling a bug that hurt a user.** You learn more about testing from one bad afternoon than from a course.
3. **Taking money.** The moment money moves, every vague part of a design becomes urgent.
4. **Handling personal data under a rule.** Writing access rules and a deletion process teaches you what "private" actually requires.
5. **Inheriting someone else's product.** Reading another person's decisions, without them there to explain, teaches you to write your own down.
6. **Being on call.** Answering for a system at 2 a.m. changes how you design it at 2 p.m.
7. **Saying no to the person who pays you,** with reasons, and being right. And being wrong.

You can arrange the first five deliberately on a side project. The last two come with a job.

### 2.6 A study rhythm that works

For a part-time learner with a job, this weekly rhythm is sustainable for a year:

- **Two weekday evenings (90 minutes each):** structured learning, one course at a time.
- **One weekday evening (90 minutes):** build on your project, applying what you learned.
- **One weekend block (3–4 hours):** build, then write a short note on what you did and what you learned.
- **Monthly:** show your project to someone who does this work and ask for the three most important problems they see.

Keep a learning log: date, what you studied, what you built, what confused you. In month twelve it becomes the backbone of your portfolio case study.

### Exercises

1. Rate yourself 0–3 on each of the fifteen courses (0 = never heard of it, 3 = could teach it). Total the scores by track. Your lowest track is your first quarter of study.
2. Choose your one real project now. It should serve real people you can talk to, involve a database, and eventually touch either money or personal data. Write one paragraph describing it.
3. Set up the tools: a code editor, Git, a GitHub account, a free PostgreSQL-based hosted database, and a free design tool. Make your first commit: a README describing the project.

## Chapter 3. Your first 30, 60 and 90 days

The first 90 days in a product role decide how much you will be trusted for the next two years. In that time you must learn the product, the people and the business; fix something visible; and hand the owner a clear picture of where things stand. This chapter gives you a schedule and the single most useful document you will write in the role: the intake.

### 3.1 The first principle: listen before you change

Every product you inherit carries decisions whose reasons are not written down. The awkward screen may exist because of a legal requirement. The strange table may feed a report the finance team depends on. The "bug" may be something a key customer relies on.

So for the first two weeks, change as little as possible. Fix only what is clearly broken and clearly safe to fix. Everything else goes into a notebook titled "Things I would change," each entry with a date. By day 30 you will find that a third of the entries were wrong, a third were right but minor, and a third are worth doing. That last third becomes your first roadmap.

The exception is anything actively harming users: a security hole, money going to the wrong place, personal data exposed. Those you fix at once, and tell the owner the same day.

### 3.2 Days 1–30: learn

**Week 1 — Access and orientation.**

- Get access to everything you need to read: code repository, database (read-only to start), hosting dashboards, error tracking, analytics, support inbox, shared documents, billing for every vendor.
- Do not ask for, and do not accept, credentials you do not need yet. Least privilege applies to you too.
- Read every written instruction and decision record in the project. Note who wrote each and when.
- Agree on decision rights with the owner (Chapter 1, section 1.3). Write them down.
- Find the shared communication channel and introduce yourself with what you own and how to reach you.

**Week 2 — Use the product as each kind of user.**

- Create test accounts for every role (for my app: trainer, client, administrator) and complete the main task of each role end to end.
- Write down every point where you hesitated, guessed or got an error.
- Read the last three months of support requests and complaints. Group them by theme and count them.

**Week 3 — Read the system.**

- Draw the architecture: every component, what calls what, where data lives, which vendors are involved.
- Read the database schema. List every table holding personal data or money.
- Check the access rules on each of those tables. Can a user read someone else's records? Write a test to find out (Chapter 13).
- Read the release process. Can you ship a one-line change safely? Try it with a harmless change.

**Week 4 — Talk to people.**

- Interview the owner about the business: goals, customers, money, worries (Chapter 4 has questions).
- Interview three to five users. Watch at least two of them work.
- Meet every teammate whose work touches yours, and ask each one: what do you depend on from me, and what do I depend on from you?

By day 30 you should be able to explain the product, its users, its architecture and its biggest problems to a stranger in ten minutes.

### 3.3 The intake document

At about day 30, write the intake. It is the document that turns you from a new person into the owner of the product. It answers four questions the owner needs answered:

1. **Where are we going?** The roadmap to the next meaningful milestone, usually the first public release or the next big commitment.
2. **What does it cost?** Every recurring cost, plus the one-off costs ahead.
3. **What could go wrong?** The top five risks, each with likelihood, impact, mitigation and owner.
4. **What do you need from me?** The decisions and resources only the owner can provide.

Keep it to three or four pages. An owner will read four pages carefully. They will skim twenty.

#### The roadmap section

Describe the path as phases, each ending with a concrete gate rather than a date alone. Here is the roadmap from my own intake for the coaching app:

| Phase | Ends | Gate (what must be true to move on) |
| --- | --- | --- |
| 1. Payments complete | Nov 20 | Refunds, voids and receipts work end to end on web and Android; tested; reviewed |
| 2. Hardening | Dec 11 | Every table and access rule has a test; privacy flows (consent, export, deletion) work; error tracking live |
| 3. Closed beta | Jan 15 | Ten trainers and their clients using it weekly; no data-loss or payment bugs open |
| 4. Public release | Q1 2027 | Store listings approved; support process in place; owner approves launch |

Notice that each gate is something you can check, not a feeling. "Payments mostly done" is not a gate. "Refunds, voids and receipts work end to end on both platforms" is.

#### The cost section

List every recurring cost, even the small ones. Owners are rarely surprised by large known costs. They are surprised by twenty small ones that nobody listed.

| Item | What it is for | Monthly cost now | At 1,000 users | Notes |
| --- | --- | --- | --- | --- |
| Database and backend hosting | Data, sign-in, storage, server functions | Plan price | Next tier likely | Watch storage for videos and photos |
| Payment processing | Card payments | Per-transaction fee | Scales with revenue | Refund fees may not be returned |
| Email sending | Receipts, invitations | Free tier | Paid tier | Volume grows with clients, not trainers |
| Domain and website hosting | Public site | Small | Same | Renewal date matters |
| App store developer accounts | Publishing | Annual fee | Same | Owner holds these accounts |
| AI services | Machine scanning, content review | Usage-based | Usage-based | Set a monthly cap |
| Error tracking and monitoring | Finding bugs in production | Free tier | Paid tier |  |

Use your real numbers from each vendor's billing page. Where you estimate, say so and say how.

#### The risk section

Pick the five risks that would hurt most. For each, write likelihood (low, medium, high), impact (low, medium, high), what you are doing about it, and what would trigger escalation. From my intake:

1. **Health-data privacy.** Workout logs, body measurements, injuries and photos are sensitive. A leak would harm clients and the business. *Mitigation:* consent at sign-up, access rules on every table, export and deletion flows, no health data in logs.
2. **Access-rule coverage.** One missing rule on one table could expose every client's data. *Mitigation:* a test for every table and every rule, run on every change.
3. **App store policies.** Stores have specific rules for health data, payments and subscriptions; a rejection can delay launch by weeks. *Mitigation:* review the current policies before submission and design payments to fit them.
4. **Shared tables with the website.** The website and the app read some of the same tables. A change by one team can break the other. *Mitigation:* a written list of shared tables, and a rule to message the other owner before changing one.
5. **Single point of failure in people.** If one builder is unavailable, can someone else continue? *Mitigation:* written handoffs and checkpoints (Chapter 19).

#### The "what I need from you" section

This is the part owners value most, because it tells them exactly what to do. Each request should be specific, small and come with a recommendation. From mine:

- **Approve** applying the payments database change to production. *Recommendation: approve; it is tested and only adds fields and rules.*
- **Approve** a live end-to-end receipt test using a test trainer and a test client with your own inbox, a $1 recorded cash payment, voided. No money moves.
- **Decide** the app's final name by December, so store listings can be prepared.
- **Answer** ten questions about your daily work as a trainer, so the next phase targets your biggest time costs.

Never write "let me know your thoughts." Write the decision you need and when you need it.

### 3.4 Days 31–60: deliver something visible

With the intake accepted, ship one improvement that users notice and that matters. Choose it by three criteria:

- **It solves a real, frequent problem** you found in support requests or interviews.
- **It is small enough to ship in two to three weeks** with full testing.
- **It is low-risk:** it does not require changing how money moves or how data is shared, unless that is exactly what is broken.

A visible early win earns you the trust to do the slow, invisible work (security, testing, data cleanup) that the product also needs. Without it, the invisible work looks like nothing happening.

Also in this period:

- Set up your operating cadence: weekly status, risk review, a place to log decisions (Chapter 22).
- Close the worst safety gaps you found in week 3: missing access rules, missing backups, secrets in code.
- Agree on a definition of done with anyone who builds with you (Chapter 16).

### 3.5 Days 61–90: set direction

By now you understand enough to propose where the product should go next. Write a one-page strategy (Chapter 6): who the product is for, what problem it solves for them better than the alternatives, what you will not do, and the three outcomes you will chase next quarter.

Present it to the owner as a proposal, not a decision. Bring the evidence: interview quotes, support counts, usage numbers, cost. Expect it to change. The point is that the next quarter's work now follows a stated direction instead of whoever asked most recently.

Close the 90 days with a short written review: what you found, what you changed, what you learned, what is next. Send it to the owner. Keep a copy; you will reread it at the end of the year and be surprised.

### 3.6 Taking over from someone else

If you are inheriting the product from another person, add three steps:

1. **Get the handoff in writing.** Ask the previous owner for: open work and its state, known bugs, promises made to users or the owner, risks they worried about, and anything they would do differently. If they are gone, reconstruct this from the repository history, issue tracker and messages.
2. **Do not undo their decisions in the first month.** Even ones that look wrong. Find out why first.
3. **Credit their work** when you build on it. You will want the same courtesy.

If the previous owner was an AI agent or a contractor whose context is lost, treat the written record as the only truth. Anything not in the repository, the issue tracker or a shared document should be treated as unknown until verified.

### 3.7 Starting a new product from nothing

If there is no existing product, the 90 days look different but the intake still applies:

- **Days 1–30:** interviews and observation (Chapter 4), domain model (Chapter 5), a rough architecture choice (Chapter 11), and an intake whose roadmap ends at "first five real users."
- **Days 31–60:** build the thinnest version that does the core job for those five users. No settings pages, no admin panel beyond what you need, but real access rules and real tests from day one. Security and data integrity are far cheaper to build in than to add.
- **Days 61–90:** put it in their hands, watch them use it, fix what hurts, and write the strategy for what comes next.

### 3.8 Mistakes I see new owners make

- **Rewriting the product in month one.** The rewrite will take three times as long as estimated and lose features nobody knew existed.
- **Promising dates before reading the code.** Estimate after week 3, not before.
- **Only talking to the owner.** The owner's view of users is secondhand. Talk to users directly.
- **Ignoring costs because "they're small."** Twenty small costs are one large one.
- **Writing a 40-page intake.** Nobody will read it. Four pages.
- **Asking the owner open questions.** "What should we do about X?" pushes the work back to them. "I recommend Y for X because Z; can I go ahead?" respects their time.

### Exercises

1. For your own project (or a product you use), write a four-page intake: roadmap with gated phases, a full cost table, top five risks, and three specific requests to an owner.
2. Find a piece of software at work whose original builder has left. Reconstruct a handoff document from what you can find in writing. What is missing? What does that teach you about what to write down yourself?
3. Write your own decision-rights list and "always ask" list for the project, as if you were the owner delegating to someone else.

# Part II — Understanding Users and the Business

## Chapter 4. Discovery: interviewing users and watching them work

Discovery is the work of finding out what problem is worth solving before you spend money solving it. It is the cheapest work you will ever do and the most often skipped. An hour of interviewing can save a month of building the wrong thing.

### 4.1 Problems, not solutions

Users are experts in their own problems and amateurs at designing software. When a trainer says "I want a button that copies last week's workout," the useful information is not the button. It is that building each week's workout takes too long, and that most weeks are variations of the last. Maybe the right answer is a copy button. Maybe it is a program that progresses automatically. You cannot know until you understand the problem.

So in every conversation, listen for three things:

- **The job:** what the person is trying to get done ("keep 30 clients progressing without spending my evenings writing programs").
- **The pain:** where it costs them time, money, stress or quality ("Sunday nights I spend two hours copying and tweaking").
- **The workaround:** what they do today instead ("I keep a spreadsheet of templates and paste from it"). Workarounds are gold. A painful workaround people already use is proof of a real problem.

### 4.2 The rules of a good interview

These rules come mostly from Rob Fitzpatrick's *The Mom Test* and from my own mistakes.

1. **Ask about the past, not the future.** "Walk me through the last time you built a program" gets facts. "Would you use a feature that…?" gets polite guesses. People are poor predictors of their own future behavior and generous with hypothetical enthusiasm.
2. **Ask about specifics, not generalities.** "Yesterday" beats "usually." "Usually" invites the idealized version.
3. **Do not pitch.** The moment you describe your idea, the interview turns into politeness. Save the pitch for a separate conversation, if ever.
4. **Talk less than a third of the time.** Silence is a tool. After an answer, wait three seconds. People often add the most important thing after a pause.
5. **Follow the emotion.** When someone sighs, laughs or says "ugh," ask about it. "You sighed. What happens there?"
6. **Ask about money and time spent.** "How much time does that take a week?" "Have you paid for anything to fix it?" Things people spend on are things they care about.
7. **Ask who else is involved.** Problems often live between people: the trainer and the client, the trainer and the gym's booking system.
8. **End with "What should I have asked that I didn't?"** and "Who else should I talk to?"

### 4.3 Writing sharp questions

A sharp question is specific enough that the answer reveals behavior, open enough that the person can surprise you, and aimed at a part of the work you suspect is costly.

Compare:

| Weak question | Sharp question | Why the sharp one is better |
| --- | --- | --- |
| Do you like the app? | What did you do in the app yesterday, and where did you get stuck? | Gets behavior and specific friction |
| What features do you want? | If you got back one hour a week, which task would you most want gone? | Forces ranking by real cost |
| Is booking a problem? | Where did your last double-booking or no-show come from? | Gets a real incident and its cause |
| How do you track payments? | What part of tracking payments annoys you most, and what did it cost you last month? | Gets the pain and its size |
| Would you use progress photos? | Which client check-ins actually happen, and which have you given up on? | Reveals what is already tried and abandoned |

Here is the set of ten I sent the owner of my product, who is himself a personal trainer. Each targets a different part of his day where I suspected time was being lost:

1. Walk me through yesterday from your first client to your last. Where did you touch a phone, laptop or paper, and for what?
2. How do you build a client's program today, and how long does one take? Do you start from templates, an old program or a blank page?
3. When a client is in front of you, what do you record during the session, and where? What do you skip because it's too slow?
4. How do clients tell you what they did on their own? How often do you chase them?
5. What's your booking setup across your calendars and your website? Where do double-bookings or no-shows come from?
6. How do you take payment today, and what part of tracking it annoys you most?
7. For your group classes: how do you plan the class, the music and the cues? How many people come, and do you track who came?
8. Which client check-ins actually happen, and how often? Which ones have you given up on?
9. What do you repeat to clients every week that the app could say or show for you?
10. If you got back one hour a week, which task would you most want gone? And what's the one thing your current software does that you'd miss if it disappeared?

Notice the shape. Question 1 maps the whole day. Questions 2 to 9 each probe one workflow. Question 10 forces a ranking and protects against throwing away something valuable. You can adapt this shape to any business: map the day, probe each workflow, force a ranking, protect what works.

### 4.4 Watching people work

Interviews tell you what people remember. Observation tells you what they do. The two differ more than you would expect. People forget the small, repeated annoyances that eat their day, because those annoyances have become invisible to them.

How to observe:

- **Ask to sit beside someone for an hour of normal work.** Not a demo. Normal work.
- **Do not help.** If they get stuck, note it and wait. Help afterward.
- **Write down every switch between tools,** every time they copy something from one place to another, every time they write something on paper, every time they wait.
- **Time the repeated tasks.** A 40-second task done 30 times a day is 20 minutes a day, over 80 hours a year.
- **Ask "why did you do that?" afterward,** not during.

When I watched trainers work, the biggest time sink was not anything they had mentioned in interviews. It was switching between their calendar, their messages and their programming tool to answer one question: "What is this client doing today?" Nobody had complained about it, because they had stopped noticing it.

### 4.5 Recruiting people to talk to

- **Start with real users,** if the product exists. Your support inbox and your user list are full of people who care.
- **Pick variety:** heavy users, light users, people who stopped using it, and people who chose a competitor. The ones who left teach the most.
- **Five to eight conversations per question** usually reveal the main patterns. After that you hear repeats.
- **Respect their time:** 30 minutes, booked in advance, ended on time. Offer something in return if appropriate: a gift card, early access, a donation.
- **Get consent** to take notes or record, and tell them how the notes will be used and stored. Do not record without permission. Interview notes about real people are personal data; store them accordingly (Chapter 15).

### 4.6 Synthesizing what you heard

Raw notes are not findings. Within a day of each interview, write a one-page summary: who, context, the jobs, the pains with their sizes, the workarounds, notable quotes, surprises.

After five or more, synthesize:

1. **List every pain** across all interviews on separate lines.
2. **Group similar pains** into themes.
3. **Size each theme:** how many people mentioned it, how much time or money it costs each, how often it occurs.
4. **Rank the themes** by total cost: people × frequency × cost per occurrence. This is rough. It is far better than ranking by who complained loudest.
5. **Write each top theme as a problem statement:** "Trainers spend about two hours a week rebuilding similar programs because there is no way to reuse and adjust last week's work."

Then, and only then, generate solutions. For each top problem, sketch at least three different ways to solve it before choosing. The first idea is rarely the best one; it is just the first.

### 4.7 Turning findings into a recommendation

After my interview with a user, I propose the three improvements that would save them the most time. The format:

| # | Improvement | Problem it solves | Time saved (estimate) | Effort | Confidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Today view: each client's session, last results and notes on one screen | Switching between calendar, messages and programs | \~25 min/day | 2 weeks | High: seen in observation |
| 2 | Progressing templates: copy last week with automatic load increases | Rebuilding weekly programs by hand | \~2 h/week | 3 weeks | Medium: from interview |
| 3 | Automatic payment reminders and receipts | Chasing payments by text | \~45 min/week | 1 week | High: reported by 4 of 5 |

Always state your confidence and its source. "Seen in observation" is stronger than "mentioned in an interview," which is stronger than "I think." The owner deserves to know which is which.

### 4.8 Continuous discovery

Discovery is not a phase that ends. Make it a habit:

- **One user conversation a week,** minimum. Put it on your calendar.
- **Read every support request** yourself for the first year of a product. Later, read a sample weekly.
- **Watch someone use a new feature** within a week of shipping it.
- **Keep a running problem list** ranked by estimated cost, and update it after each conversation.

Teresa Torres's *Continuous Discovery Habits* is the best book-length treatment of this habit.

### 4.9 Discovery in other businesses

The method transfers directly. A few examples:

- **A dental office:** map a receptionist's day. You will likely find most time going to insurance verification and appointment reminders, not to whatever the owner assumed.
- **A warehouse:** watch a picker for an hour. Count steps walked and times they check a screen or paper.
- **A law firm:** ask an associate to walk through the last client intake. Count how many times the same information is typed into different systems.
- **A restaurant:** sit at the host stand on a Friday night. Note every time the reservation system and reality disagree.

In every case, the biggest wins tend to come from repeated small tasks and from information typed twice. Look for those first.

### Exercises

1. Write ten sharp questions for a user of your project, following the shape in section 4.3. Then interview three people with them.
2. Observe one person doing their normal work for an hour. Log every tool switch, copy-paste and wait. Calculate the yearly time cost of the top three.
3. Synthesize your interviews into ranked problem statements and propose three improvements in the table format of section 4.7, with confidence and source for each.

## Chapter 5. Learning the domain and modeling the business

The domain is the part of the world your product serves: personal training, dentistry, freight, accounting. To build good software for a domain, you must understand it well enough to explain its rules to a newcomer, and then write those rules down in a form a computer can enforce. That written form is the domain model. It is the most durable thing you will create. Screens get redesigned every few years. A good domain model can last a decade.

### 5.1 Becoming a credible amateur

You do not need to become a trainer to build training software. You do need to become a credible amateur: someone who understands the vocabulary, the main workflows, the money, the regulations and the common failures well enough that experts do not have to explain basics to you.

Ways to get there, fastest first:

- **Do the work yourself, briefly.** Shadow for a day. Take the entry-level course. I studied how trainers write programs and cue exercises; it changed how I designed every screen.
- **Read what practitioners read.** Trade magazines, certification textbooks, professional forums, the industry's regulations.
- **Collect the documents the business runs on.** Intake forms, invoices, contracts, reports, spreadsheets. Each form is a data model someone already designed.
- **Build a glossary.** Every time you hear a term you don't know, add it with a one-line definition and an example. Share it with your team.

### 5.2 Ubiquitous language

A practice from domain-driven design (Eric Evans's book of that name) that is worth adopting fully: use the same words for the same things everywhere. In conversation, in the interface, in the code, in the database.

If trainers say "client," do not call them "users" in the interface, "members" in the database and "customers" in the code. Each translation is a place for bugs and confusion. When the business uses two words for one thing, pick one, write down the decision, and use it consistently.

Watch for the opposite problem too: one word meaning two things. In fitness, "session" can mean a booked appointment or a completed workout. Those are different records with different rules (an appointment can be cancelled; a completed workout cannot be "uncompleted" without a trace). Give them different names.

### 5.3 Entities, relationships and rules

A domain model has three parts.

**Entities** are the things the business keeps track of, each with an identity that persists over time: a trainer, a client, a program, a workout, a payment, an exercise.

**Relationships** are how entities connect: a trainer has many clients; a client follows one active program at a time; a program contains workouts; a workout contains exercises in order; a payment belongs to one client and one trainer.

**Rules** (or invariants) are what must always be true:

- A payment amount is positive.
- A paid payment cannot be deleted; it can only be refunded or voided, with a reason.
- A client can only see their own records and the programs their trainer assigned.
- An exercise in a workout must exist in the exercise library.
- A refund cannot exceed the amount paid.

The rules are the most important and most often forgotten part. Every rule you do not write down becomes a bug someone discovers in production.

### 5.4 Finding the model: a method

1. **List the nouns** in your interview notes and business documents. Most entities are among them.
2. **List the verbs.** Most actions and many rules hide there: "assign a program," "refund a payment," "book a session."
3. **For each verb, ask:** who can do it, to what, when, and what must be true before and after?
4. **For each entity, ask:** what is its lifecycle? Can it be created, changed, cancelled, completed, archived? Which transitions are allowed?
5. **Ask about time.** Does the business need to know what something *was* in the past, not just what it is now? Prices change; a past invoice must still show the old price.
6. **Ask about money and legal records.** What must be kept, for how long, and who must be able to see it?
7. **Draw it** and show it to a domain expert. Ask them to find what is wrong.

### 5.5 Lifecycles and state machines

Many entities move through states. Draw them explicitly. For a payment in my app:

- **pending** → **paid** (the money arrived)
- **pending** → **failed** (the card was declined)
- **paid** → **refunded** (money returned to the client, with a reason)
- **paid** → **void** (the record was entered by mistake, with a reason; for recorded payments such as cash, where no money moved through the system)

No other transitions are allowed. A refunded payment does not go back to paid. A void payment is never deleted. Writing the states and transitions down this way does three things: it tells designers which buttons to show in each state, it tells engineers which database rules to write, and it tells testers exactly what to check.

For every state machine, also decide:

- Who may perform each transition?
- What is recorded with it (who, when, why)?
- What notifications go out (a receipt, an alert)?
- Is the transition reversible? If not, what confirms it is intended?

### 5.6 History, audit and the difference between correcting and erasing

Businesses need to explain the past. An accountant asks why March revenue changed. A client disputes a charge. A regulator asks who viewed a record. If your model only stores the current state, you cannot answer.

Three patterns help:

- **Append-only ledgers** for money and credit. Never overwrite a balance. Record each event (payment, refund, credit issued, credit used) and compute the balance from the events. My team's rule is simple: credit is a ledger.
- **Status with reason** instead of deletion for anything with legal or financial meaning. A void payment stays, marked void, with the reason and the time.
- **Audit logs** for sensitive actions: who viewed or changed what, and when. Keep them separate from the data, and do not put the sensitive data itself in the log.

The principle: you may correct a record, reverse it or retire it, but you do not erase it if someone might later need to know it existed. The exception is personal data a person has a legal right to have deleted (Chapter 15). There, the model must support deleting or anonymizing the personal parts while keeping the financial facts the law requires you to retain. Design for that conflict from the beginning; it is painful to retrofit.

### 5.7 Reference data versus user data

Separate the data your business curates from the data users create.

- **Reference data:** the exercise library, the catalog of gym machines, the list of credentials trainers can hold. You control it, version it and review changes to it.
- **User data:** a trainer's programs, a client's logs, payments. Users own it; you protect it.

The line matters when users want to add to reference data. In my app, trainers can create their own exercises freely; those belong to them. When they suggest adding one to the shared library, an AI reviews it: it may add the name as a new search alias for an existing exercise, add a genuinely new exercise, or escalate to a human when unsure. Users can also report a library entry and hide it from their own view, with undo. That design keeps the shared data clean without making the business owner personally approve every suggestion.

### 5.8 Grouping and variation

Real domains have variations that look like separate things and are not. A push press can be done with a barbell, dumbbells or kettlebells. To a trainer it is one movement with an equipment choice. Early versions of our library listed them as separate entries, and trainers scrolled past three near-identical lines to find what they wanted.

We changed the model: each movement belongs to a family, and the list shows one line per family with its equipment versions grouped, clearly marked. Search and history still work on the specific version. This kind of modeling decision (what is one thing with variations, and what is truly different) shows up in every domain: a product with sizes and colors, a service with durations, an insurance policy with riders. Getting it right makes every screen simpler.

### 5.9 Shared data between products

When two products read the same data, the data model becomes a contract between teams. In my company, the website and the coaching app share some tables (accounts, payments). The scheduling app reads the coaching app's calendar. Each change to a shared table can break someone else's product.

Rules that keep this safe:

- **Write down which tables are shared** and which team owns each one.
- **The owner of a table announces changes before making them,** with enough notice for others to adapt.
- **Prefer adding over changing.** New columns and new tables rarely break readers. Renaming or removing does.
- **Version the contract** when breaking changes are unavoidable: keep the old shape working until every reader has moved.

### 5.10 Validating the model

Before building on a model, test it against reality:

- **Walk real scenarios through it.** Take ten real events from the business (a refund last month, a client who switched trainers, a cancelled session) and check that the model can represent each one exactly.
- **Look for the awkward cases:** a client who is also a trainer, a payment split across two clients, a program shared by two trainers. Decide how each is handled, even if the answer is "not supported yet."
- **Ask the expert to break it.** "What happens in your business that this can't describe?"

### Exercises

1. Build a glossary of at least 30 terms for your project's domain, each with a definition and an example.
2. Write the entities, relationships and rules for your project. Aim for at least ten rules.
3. Draw the state machine for one entity that involves money or a commitment (an order, a booking, a payment). List who can do each transition and what gets recorded.
4. Walk ten real or realistic scenarios through your model and record which ones it cannot represent.

## Chapter 6. Strategy, roadmaps and saying no

A strategy is a short set of choices about where you will win and what you will not do. A roadmap is the order in which you will make those choices real. Without a strategy, a roadmap is a wish list sorted by who asked loudest. Without a roadmap, a strategy is a slogan.

### 6.1 The one-page strategy

Write your strategy on one page. If it does not fit, it is not yet a strategy. It should answer six questions:

1. **Who is it for?** Name a specific group. "Independent personal trainers with 10 to 40 clients who train in commercial gyms" is a target. "Fitness professionals" is not.
2. **What job does it do for them?** In their words. "Run my whole client business from my phone without spending evenings on admin."
3. **What do they use today, and why is it not good enough?** Competitors, spreadsheets, paper, nothing. Be fair to the alternatives; your users chose them for reasons.
4. **Why will we win?** The one or two advantages that are hard to copy: deep domain fit, integration with tools they already use, a better price, a better experience in one critical moment.
5. **What will we not do?** At least three things. This is the most important line on the page.
6. **How will we know it is working?** The two or three outcome measures (Chapter 7).

An example for a coaching app:

> **For** independent trainers with 10–40 clients, **who** lose hours each week to programming, payments and chasing clients across several apps, **our app** puts programs, sessions, progress, payments and client communication in one place, on the gym floor, with a library of every exercise and machine demonstrated on video. **Unlike** general fitness platforms, it is built around how trainers actually run a session, and it connects to the timer and scheduling apps they already use. **We will not** build nutrition planning, a public marketplace for finding trainers, or features for large gym chains in the first year. **We will know it works when** trainers report saving at least two hours a week and 80% of their clients log workouts weekly.

### 6.2 Saying no

Every yes is a no to something else, because your time is fixed. A builder-owner says no far more often than yes. The skill is saying it in a way that keeps the relationship and the information.

A good no has four parts:

1. **Acknowledge the problem behind the request.** "You're losing time when clients don't log their sessions."
2. **Say what you are doing instead, and why.** "This quarter we're focused on payments, because broken refunds cost money and trust."
3. **Say when it could be reconsidered.** "I've added it to the list for the January review."
4. **Offer a workaround if one exists.** "In the meantime, the reminder setting can nudge clients on session days."

Keep every request, even the ones you decline, in a backlog with the requester, date and the problem it addresses. Patterns emerge. Five people asking for the same thing in different words is a signal that should move it up.

The hardest no is to the owner. Do it with evidence and an alternative, in private, and accept that the owner may overrule you. If they do, commit fully and record the decision with its reason (Chapter 21).

### 6.3 Prioritization frameworks, and their limits

Frameworks help you compare options consistently. They do not make the decision for you. Three I find useful:

**RICE.** Score each option on Reach (how many people per period), Impact (how much it helps each, on a small scale such as 0.25 to 3), Confidence (how sure you are, as a percentage) and Effort (person-weeks). Score = Reach × Impact × Confidence ÷ Effort. Good for comparing many small items.

**Cost of delay.** For each option, ask what it costs per week to not have it. Divide by the weeks it takes to build. Do the highest first. Good when some items have deadlines or lose value over time (a seasonal feature, a legal deadline, a competitor's launch).

**Value versus effort 2×2.** Plot items on value (low to high) and effort (low to high). Do high-value, low-effort first; plan high-value, high-effort; question low-value items entirely. Good for a quick conversation with stakeholders.

The limits: all of these depend on estimates that are often wrong, and none captures risk reduction well. Work that prevents a disaster (an access-rule test, a backup restore drill) scores poorly on reach and impact until the day it saves the business. Reserve a fixed share of capacity, typically 20 to 30%, for risk reduction and maintenance, and do not make it compete in the scoring.

### 6.4 Building the roadmap

A roadmap shows what you will work on, in what order, toward which outcomes. Make it honest about uncertainty.

A format that works: **Now, Next, Later.**

- **Now** (this month or this phase): committed, specific, estimated. You expect to deliver it.
- **Next** (the following one to two phases): planned, roughly sized, may change.
- **Later:** directions, not commitments. Problems you intend to address, without solutions fixed.

Over the Now/Next/Later columns, lay phases with gates (Chapter 3). Each phase serves a stated outcome. "Phase 2: Hardening, so we can let real clients' health data into the system safely" tells everyone why the phase exists.

Publish the roadmap where everyone who depends on it can see it, and update it when it changes, with a note on what changed and why. A roadmap that is secretly out of date is worse than none.

### 6.5 Dates and commitments

Owners need dates. Engineers know estimates are uncertain. Both are right. Handle it this way:

- **Distinguish targets from commitments.** A target is your best plan. A commitment is a promise someone outside the team will rely on (a customer launch, a contract). Make few commitments and keep them all.
- **Give ranges for anything more than a few weeks out.** "Mid-to-late January" is honest. "January 17" is false precision.
- **Fix the date or fix the scope, not both.** If a date is a real commitment, scope must be allowed to shrink to meet it. Agree in advance what can be cut.
- **Report slippage the day you know.** Not the day before the deadline. Bad news early is a planning input. Bad news late is a betrayal.

### 6.6 Bets and experiments

Some roadmap items are bets: you believe they will help, but you are not sure. Treat them as experiments:

1. State the hypothesis: "If we show each client's last results on the session screen, trainers will spend less time switching apps during sessions."
2. State how you will measure it and the threshold: "Median time per session on admin screens drops by 30% within four weeks."
3. Build the smallest version that tests it.
4. Decide in advance what you will do if it fails: remove it, change it, or try another approach.

Most teams skip step 4 and keep every failed experiment forever, slowly cluttering the product. Remove what does not work.

### 6.7 Platform and ecosystem strategy

When your product is one of several (my coaching app sits beside a timer app, a scheduling app and a website, all sharing sign-in), strategy includes how they fit together:

- **Each product should be useful on its own.** If it only works with the others, you have built one product with extra friction.
- **Integration should be the reason to prefer the family,** not a requirement to use any member.
- **Shared foundations** (accounts, payments, design system) are owned by one team each and changed carefully.
- **Avoid duplicating features** across products. When two apps both need a calendar, one owns it and the other reads it.

### 6.8 Strategy in other kinds of businesses

For a small business whose software supports the business rather than being the business (a bakery's ordering system, a firm's intake portal), the strategy page is shorter and asks different questions: which business outcome does the software serve (fewer missed orders, faster intake, lower admin hours), what will we buy instead of build, and what is the budget ceiling. A builder-owner in that setting often creates the most value by building less: choosing good off-the-shelf tools, connecting them well and building only the part that is unique to the business.

The build-or-buy question deserves its own rule: **buy what is common, build what is yours.** Payments processing, email delivery, authentication and accounting are common; use a reputable provider. Your business's particular workflow, the thing customers come to you for, may be worth building.

### Exercises

1. Write a one-page strategy for your project answering the six questions in section 6.1. Make the "will not do" list at least three items long.
2. Take ten real or imagined feature requests and score them with RICE. Then rank them by your own judgment. Where do the two rankings disagree, and why?
3. Build a Now/Next/Later roadmap with gated phases. Share it with one person and ask what they would cut.

## Chapter 7. Metrics and success measures

A metric is a number you look at to decide something. If no decision changes when the number moves, it is not a metric; it is decoration. This chapter shows how to choose a small set of measures that tell you whether the product is working, how to collect them without violating anyone's privacy, and how to avoid the common ways numbers mislead.

### 7.1 The hierarchy of measures

Think in three layers:

1. **Business outcomes:** revenue, cost, retention of paying customers, margin. The owner cares about these most. They move slowly and have many causes.
2. **User outcomes:** time saved, tasks completed, goals reached. These are why users stay. They are the bridge between your work and the business numbers.
3. **Product signals:** feature usage, completion rates, errors, speed. These move fast and tell you what to fix. They are leading indicators of the layers above.

Pick one or two measures from each layer. More than about seven in total and nobody watches any of them.

For a coaching app, a reasonable set:

| Layer | Measure | Why it matters | Target example |
| --- | --- | --- | --- |
| Business | Trainers paying after trial | The business only works if trainers pay | 40% of trials convert |
| Business | Monthly trainer retention | Losing customers erases growth | 95% stay month to month |
| User | Self-reported admin time saved per week | The core promise | 2+ hours |
| User | Clients logging at least one workout a week | Clients succeed only if they train | 80% |
| Product | Payments completed without support contact | Money flows must be painless | 99% |
| Product | Crash-free sessions on Android | Reliability | 99.5% |

### 7.2 North star, with guardrails

Many teams choose one "north star" metric that best captures delivered value: for a coaching app, perhaps "client workouts completed per week." A single focus number aligns a team well.

Always pair it with **guardrail metrics**: numbers that must not get worse while you push the north star. If you push workouts logged by adding aggressive notifications, your guardrails (notification opt-outs, uninstall rate, support complaints) tell you when you are buying the number with users' goodwill.

### 7.3 Defining a metric precisely

Vague metrics produce arguments. Each metric needs a written definition:

- **Name:** Weekly active clients.
- **Definition:** Count of distinct clients who logged at least one completed workout in the 7-day window ending Sunday 23:59 in the client's local time zone.
- **Excludes:** test accounts, staff accounts, clients of trainers in trial.
- **Source:** the workouts table, completed\_at column.
- **Owner:** the builder-owner.
- **Reviewed:** weekly.

Every word in that definition prevents a future argument. "Active" could mean opened the app, logged in or completed a workout; those can differ by a factor of three. Write it down.

### 7.4 Collecting data responsibly

You need data to measure, and every piece of data you collect is a liability as well as an asset. Rules:

- **Measure from your own database first.** Many metrics (payments, workouts logged) are already in your tables. Count them with a query rather than adding tracking.
- **Collect the minimum.** Track that a feature was used, not the content entered into it. Never send health data, payment details or messages to an analytics vendor.
- **Aggregate early.** For reports, you usually need counts per week, not per-person event histories.
- **Respect consent and law.** Analytics cookies and tracking on websites may require consent depending on where your users are. Mobile app stores require you to disclose what you collect.
- **Exclude test data.** Mark test accounts at creation and filter them everywhere. Test traffic polluting real metrics is a classic mistake.

### 7.5 How numbers lie

You will be misled by your own dashboards. The common ways:

- **Averages hide distributions.** Average session length of 20 minutes could mean everyone spends 20 minutes, or half spend 1 and half spend 39. Look at medians and distributions.
- **Small numbers swing wildly.** With 12 trainers, one leaving is an 8% drop. Do not react to week-to-week noise when counts are small. Look at trends over several weeks and at the actual people.
- **Survivorship.** Satisfaction among current users ignores everyone who left unhappy. Ask the ones who left.
- **Correlation is not causation.** Trainers who use templates retain better. Maybe templates cause retention. Maybe committed trainers do both. A controlled comparison (or at least asking them) is needed before you conclude.
- **Goodhart's law.** When a measure becomes a target, people optimize the measure instead of the goal. If you reward "workouts logged," expect workouts with one exercise logged to inflate the count.
- **Seasonality.** Fitness has a January peak and a summer dip. Compare to the same period last year, not to last month.

### 7.6 Experiments

When you can, test changes with a controlled comparison: some users get the change, some do not, chosen at random, and you compare outcomes. This is an A/B test.

Requirements for a valid test:

- Random assignment, not "users who turned on the feature."
- A metric and threshold chosen before you start.
- Enough users that a real difference can be distinguished from noise. With small user bases (dozens or hundreds), formal A/B tests usually cannot detect modest effects. Use qualitative methods instead: watch people, interview them, compare before and after carefully, and be honest about uncertainty.
- A fixed duration, decided in advance. Stopping a test the moment it looks good inflates false positives.

For most small products, the honest truth is that you will make decisions from a mix of small numbers and conversations. That is fine. State your confidence level when you report.

### 7.7 Operational metrics

Beyond outcome metrics, a builder-owner watches the health of the system:

- **Error rate:** errors per thousand requests, crash-free sessions on mobile.
- **Latency:** how long key screens and actions take, at the median and the slow end (the 95th percentile).
- **Availability:** percentage of time the service works.
- **Cost per active user:** total infrastructure and vendor cost divided by active users.
- **Support volume:** contacts per hundred active users, by category.
- **Delivery health:** how often you release, how often releases cause problems, how long it takes to recover. (These are the four "DORA" measures described in *Accelerate*: deployment frequency, lead time for changes, change failure rate, and time to restore service.)

Set alerts for the few that require immediate action (errors spiking, payments failing) and review the rest weekly.

### 7.8 Reporting to the owner

Owners want to know three things: are we on track, what changed, and is there anything I need to do. A weekly metrics note should fit on a phone screen:

> **Week of Nov 2.** Trainers: 14 (+1). Clients logging weekly: 78% (target 80%, up from 74%). Payments: 61 completed, 0 support contacts. One Android crash affecting the scan screen, fixed in Thursday's release. Cost this month on pace for $X, within budget. **Nothing needed from you.**

When something is off target, say what you believe the cause is, how confident you are, and what you are doing. When you need a decision, put it first.

### 7.9 Measures in other businesses

| Business | Business outcome | User outcome | Product signal |
| --- | --- | --- | --- |
| Online bakery orders | Orders per week, average order value | Order completed in under 2 minutes | Checkout abandonment rate |
| Law-firm intake portal | Consultations booked | Client never re-enters the same information | Form completion rate, drop-off by step |
| Field-service scheduling | Jobs completed per technician per day | Technician spends less time on paperwork | Jobs closed on the mobile app same day |
| Nonprofit volunteer calendar | Volunteer hours delivered | Volunteers find and sign up for shifts easily | Sign-up completion, no-show rate |

### Exercises

1. Choose six measures for your project: two business, two user, two product. Write a full definition for each, as in section 7.3.
2. Write the SQL query for each measure you can compute from your own database.
3. Draft a weekly metrics note for an owner, under 100 words, using real or realistic numbers. Put any decision needed first.

# Part III — Design

## Chapter 8. Design principles for tools people use every day

Most business software is used repeatedly, by the same people, often under time pressure. A trainer uses my app twenty times a day between sets, with sweaty hands, while talking to a client. A receptionist uses an intake system hundreds of times a week. Designing for repeated use under pressure is different from designing a marketing site someone visits once. This chapter gives the principles; Chapter 9 gives the patterns.

### 8.1 Design for the second hundredth time, not the first

First-time usability matters: new users must be able to start. But a tool used daily is judged by its hundredth use. Ask of every screen:

- How many taps does the most common task take? Can it take fewer?
- What does the user need to see at a glance, without reading?
- What does the user do next, almost every time? Is that the easiest action on the screen?
- What can be remembered for them: last weights used, the usual client, the default payment method?

In my app, the session screen shows each exercise's last-used weight and reps, because trainers asked "what did you do last time?" in nearly every set. Showing it removed a question and a lookup from hundreds of daily moments.

### 8.2 Context of use

Design for where and how the product is actually used. Write it down for each main role:

| Role | Where | Device | Attention | Constraints |
| --- | --- | --- | --- | --- |
| Trainer during session | Gym floor | Phone, one hand | Split: watching client | Noise, sweat, glare, gloves, 10 seconds between sets |
| Trainer planning | Home or desk | Laptop or tablet | Focused | Evening, tired, many clients to plan |
| Client | Gym or home | Phone | Variable | Varying fitness knowledge, may not read instructions |
| Owner reviewing | Anywhere | Phone | Brief | Wants answers in seconds |

The gym-floor row changes everything: large touch targets, high contrast, minimal typing, no tiny controls, actions that can be undone because mistaps will happen.

### 8.3 Principles

These are the principles I check every design against. They draw on Jakob Nielsen's usability heuristics and Don Norman's work, adjusted for daily-use business tools.

**1. Show the state.** Users should always know what is happening and what is true: saved or not, paid or not, synced or not, who can see this. Ambiguous state causes more support requests than any bug.

**2. Use the user's words.** Labels, messages and categories use the language of the domain (Chapter 5), not of the database. "Void (recorded by mistake)" beats "Set status: void."

**3. Make the safe action easy and the dangerous action deliberate.** Common, reversible actions are one tap. Irreversible or sensitive actions require a clear, specific step: typing a reason, a separate screen, a second person.

**4. Prefer undo to confirmation.** "Are you sure?" dialogs are clicked through by habit and protect little. An undo that lasts long enough to notice a mistake protects far more (Chapter 9).

**5. Prevent errors before reporting them.** Disable impossible options, constrain inputs (a number pad for weights), choose good defaults, validate as the user types.

**6. Recognition over recall.** Show options instead of making users remember them. Show recent and frequent choices first. My exercise swap sheet lists "your usual swaps" and "what other people swap to" before the full library.

**7. Consistency.** The same action looks and works the same everywhere. The same word means the same thing everywhere. A design system enforces this (Chapter 10).

**8. One line per thing.** Lists should show one line per meaningful item. When variations exist (barbell, dumbbell, kettlebell versions of one movement), group them on one line with the variations clearly marked, rather than repeating near-identical lines.

**9. Progressive disclosure.** Show what most people need; put the rest one step away. Advanced settings, rarely used fields and explanations live behind "More" or in a details view.

**10. Respect attention.** Every notification, badge, popup and animation costs attention. Spend it only on what the user would want interrupted for.

**11. Never lose work.** Save drafts automatically. Survive a dropped connection, a phone call, the app being closed. Losing a trainer's half-built program once is enough to lose the trainer.

**12. Design the failure states first.** Empty lists, no connection, permission denied, payment declined, server error, partial data. These are where users decide whether to trust the product.

### 8.4 Information architecture

Information architecture is how the product's content and functions are organized and named. Get it wrong and users cannot find things even when every screen is well designed.

Method:

1. **List every object and action** users deal with (from your domain model).
2. **Group them as users think of them,** not as your database stores them. Card sorting helps: write items on cards and ask five users to group and name them.
3. **Choose a navigation structure** that matches frequency. The three or four most-used areas get top-level navigation (tabs on mobile). Everything else goes one level down.
4. **Name things in users' words.** Test names by asking users where they would look for a task.
5. **Plan for growth.** A structure that works for five areas must still work for twelve.

For my app, the trainer's top level is: Today, Clients, Programs, Library, and More (financials, settings, credentials). "Today" exists because the most frequent question is "what am I doing right now?"

### 8.5 Designing with real content

Design with real data, never with tidy placeholders. Real exercise names are long ("Single-arm dumbbell Romanian deadlift to row"). Real client names include apostrophes and accents. Real lists have 400 items or zero. Real photos are badly lit. A layout that looks perfect with "Exercise 1" will break with real content.

Keep a set of realistic test data, including the extremes: the longest name, the empty state, the 1,000-item list, the right-to-left language if you support one, the user with no photo.

### 8.6 Designing for trust

When software handles money or personal data, users need to trust it. Trust comes from:

- **Predictability:** it does the same thing every time.
- **Transparency:** it shows what it did. After a refund: amount, reason, time, and "receipt emailed to client."
- **Reversibility:** mistakes can be fixed.
- **Clear boundaries:** it is obvious who can see what. A client's notes show "Only you and your trainer can see this."
- **No surprises with money:** prices, fees and recurring charges are shown before commitment.
- **Honest errors:** when something fails, say what happened and what to do, in plain words.

### 8.7 Visual placeholders and incomplete content

Real products have gaps: an exercise without a video yet, a profile without a photo, a machine not yet photographed. Design how gaps look, deliberately. In my app, exercises without a verified demonstration video show generated placeholder art that matches the movement type, rather than a broken image or a gray box. The product looks finished even while the content is still growing, and the placeholder is replaced automatically when a verified video arrives.

### 8.8 Design in other businesses

The principles hold everywhere. A warehouse picking app needs huge targets and scanning instead of typing. A clinic intake form needs to save progress because patients get interrupted. A restaurant reservation tool needs to show the state of every table at a glance. In each, start with the context table in section 8.2 and the failure states, and the right design usually becomes obvious.

### Exercises

1. Write the context-of-use table for every role in your project.
2. Evaluate one screen of an app you use daily against the twelve principles. Write the three biggest violations and a fix for each.
3. Design the empty, loading, error and offline states for the main list screen in your project before designing its normal state.

## Chapter 9. Interaction patterns: undo, escalation, defaults and errors

Patterns are proven solutions to recurring design problems. This chapter covers the ones I use most in business software, each with when to use it, how to build it and what goes wrong.

### 9.1 Undo

**Use when:** an action is common, quick and reversible in principle: hiding an item, archiving, removing from a list, moving, marking complete.

**How:** perform the action immediately, show a short message with an Undo button (a "snackbar" or "toast") for 5 to 10 seconds, and keep a permanent way to reverse it later. In my app, a trainer can hide an exercise from their library with one tap. A toast says "Hidden. Undo." If they miss the toast, Settings has a "Hidden exercises" page listing everything hidden, each with Restore.

**Build it right:**

- Undo must restore exactly the previous state, including order and related records.
- Implement as a reversible state change (a hidden flag, an archived timestamp), not as delete-and-recreate.
- Make the permanent reversal path discoverable. The toast is a convenience; the settings page is the safety net.

**Goes wrong when:** undo is offered for actions that have external effects already sent (an email went out, money moved). You cannot unsend. For those, use the next pattern.

### 9.2 Deliberate confirmation for irreversible actions

**Use when:** an action cannot be undone or has effects outside the system: refunds, sending messages, publishing, permanent deletion, anything involving money moving.

**How:** make the user state their intent specifically, not just click "OK."

- Show exactly what will happen: "Refund $60.00 to Jane Doe's card ending 4242. A receipt will be emailed to her. This cannot be reversed."
- Require meaningful input where it adds value: a reason for a refund or void, the name typed for a destructive deletion.
- Label the button with the action, not "OK" or "Yes": "Refund $60.00."
- Show the result clearly afterward: amount, time, reason, receipt status.

The required reason is doing double work: it slows the user down enough to think, and it creates the record an accountant or auditor will need later.

### 9.3 Replace destruction with reversal

The strongest pattern for money and records is to remove the destructive option entirely. My app used to have "Delete record" on payments. We removed it. Now the menu offers:

- **Refund** (money returns to the client, with a reason),
- **Void (recorded by mistake)** (for recorded payments like cash entered in error, with a reason),
- **Email the receipt again** (when refunded or void).

The database also refuses deletion of paid payments, so the rule holds even if a bug or a future screen tries. Design and data model enforce the same rule from two sides.

### 9.4 Smart defaults

**Use when:** most users make the same choice most of the time.

**How:** pre-fill the most likely value; let the user change it easily. Examples: today's date for a session, the trainer's usual session price, last week's weights, the client's preferred payment method.

**Rules for defaults:**

- Defaults should be safe. Never default to the option that spends money, shares data or sends a message.
- Privacy settings default to private.
- Defaults should be learned from the user's own behavior where possible (their usual swap, their usual price), not just global averages.
- Show that a value was defaulted when it matters, so users notice when it is wrong.

### 9.5 Suggestions ranked by actual use

When offering choices from a long list, rank by what is actually useful:

1. **This user's own history** (your usual swaps).
2. **What similar users chose in this situation** (what people swap to).
3. **Structural similarity** (other moves for the same muscles and equipment).
4. **The full list, searchable.**

This is how the exercise swap sheet in my app works, mid-workout, when a machine is taken or a client has a sore shoulder. A trainer can also choose "change it for good," which replaces the exercise in the program permanently instead of only today. The pattern generalizes: product reorders, recipient pickers, category choices.

### 9.6 Escalation: automatic first, human when needed

**Use when:** decisions must be reviewed but a human cannot review them all.

My app lets anyone suggest an exercise for the shared library. The business owner did not want to approve every suggestion personally. So an AI reviews each one and does one of three things:

- **Recognizes it as another name** for an existing exercise and adds the name as a search alias.
- **Adds it as new** if it is clearly a real, distinct movement.
- **Escalates to a human** when it is unsure or the suggestion looks problematic.

Additions made automatically appear on a review page with a Remove button, so a human can spot-check and reverse. Users can also report entries, and reports land on the same page.

The pattern: **automate the clear cases, escalate the unclear ones, keep everything reviewable and reversible.** It applies to content moderation, expense approvals, fraud checks and support triage. The key design decisions are what counts as "unclear," who receives escalations, and how quickly they must be handled.

### 9.7 Error messages

A good error message answers three questions: what happened, why (if it helps), and what to do now.

| Bad | Good |
| --- | --- |
| Error 23514 | Give a reason first. |
| Request failed | Receipt not emailed: the email service didn't answer. Try "Email the receipt again" later. |
| Permission denied | Only the trainer who recorded this payment can refund it. |
| Invalid input | Weight must be a number, like 20 or 22.5. |
| Something went wrong | We couldn't save your program because you're offline. It's saved on this phone and will upload when you reconnect. |

Techniques:

- **Translate system errors** into domain language in one central place in your code, so every screen benefits. My app has one function that turns database constraint errors into sentences like "Financial records are kept" when someone tries to delete a paid payment.
- **Put the error next to the cause:** next to the field, not at the top of the page.
- **Never blame the user.** "Weight must be a number" rather than "You entered an invalid weight."
- **Keep the user's input.** Never clear a form because one field failed.
- **Partial success is a state.** If the refund succeeded but the receipt email failed, say both, separately. Do not report total failure or total success.

### 9.8 Empty states

An empty list is an opportunity. Instead of "No items," show what will appear there, why it is empty, and the one action that fills it: "No clients yet. Invite your first client and they'll get a link to join." with an Invite button.

Distinguish kinds of emptiness: never had any (first use), filtered to nothing ("No exercises match 'pulley.' Clear search"), and error ("Couldn't load clients. Retry"). Each needs a different message.

### 9.9 Loading and offline

- Show a skeleton of the layout while loading rather than a spinner on a blank page, so the user sees structure immediately.
- For actions, respond instantly (optimistic update) when the action is very likely to succeed, then reconcile. If it fails, show the failure and restore the previous state.
- Never use optimistic updates for money. Wait for confirmation and show progress.
- In places with weak connections (gyms are often basements), design for offline: queue changes locally and sync when connected, with a visible "saved on this phone, will sync" state.

### 9.10 Forms

- Ask only for what you need now. Each field costs completion.
- One column, labels above fields, in the order people think.
- Use the right input: number pad for numbers, date picker for dates, toggles for yes/no, a list for under seven choices.
- Validate as the user leaves each field, not only on submit.
- Group long forms into steps, save between steps, show progress.
- Make required versus optional obvious; mark the minority.

### 9.11 Notifications

- Every notification must be useful to the person receiving it, at that time.
- Let users control categories (reminders, payments, messages) separately.
- Transactional notifications (receipts, security alerts) are different from marketing ones; keep them separate, and follow the law on consent for marketing messages.
- Never put sensitive content in a notification preview that might show on a lock screen: "New message from your trainer," not the message.

### Exercises

1. List every destructive action in your project. For each, decide: undo, deliberate confirmation, or remove and replace with reversal. Justify each choice.
2. Rewrite ten error messages from a product you use, following the three-question rule.
3. Design an escalation flow for one review task in your domain: what is automated, what escalates, to whom, and how it is reversed.

## Chapter 10. Design systems, accessibility and content

A design system is the set of reusable decisions (colors, type, spacing, components, words and rules) that makes a product consistent and fast to build. Accessibility is the practice of making the product usable by people with disabilities, which in practice makes it better for everyone. Content is every word and image in the product. This chapter covers all three, because they share one idea: decide once, apply everywhere.

### 10.1 Why a small team needs a design system

It is tempting to think design systems are for large companies. The opposite is closer to true. A small team cannot afford to redesign buttons on every screen or debate spacing in every review. A small design system, even a single file of tokens and a dozen components, pays for itself within weeks.

Benefits:

- **Speed:** new screens are assembled, not designed from scratch.
- **Consistency:** users learn the product once.
- **Accessibility built in:** fix contrast in the token and every screen is fixed.
- **Shared products look related:** in a family of apps (my coaching app, its timer app, scheduling app and website), a shared system makes them feel like one brand.

### 10.2 The layers

**Tokens** are named values: colors, font sizes, spacing steps, corner radii, shadows, motion durations. Name them by role, not appearance: `color.text.primary`, `color.surface.raised`, `color.action.danger`, not `blue-500`. Role names let you change the look (including dark mode) without touching components.

A minimal token set:

- Colors: background, surface, raised surface, primary text, secondary text, border, primary action, danger, success, warning, focus ring. Each with light and dark values.
- Type scale: five to seven sizes (caption, body, body-large, title, heading, display).
- Spacing scale: a consistent step, for example 4, 8, 12, 16, 24, 32, 48.
- Radius: two or three values.
- Elevation: two or three shadow levels.

**Components** are reusable pieces built from tokens: button (primary, secondary, danger, text), input, select, checkbox, toggle, list row, card, sheet, dialog, toast, tabs, badge, avatar, empty state, error message, thumbnail.

Each component should document: when to use it, its variants, its states (default, hover, pressed, focused, disabled, loading, error), its accessibility behavior and an example.

**Patterns** combine components into solutions: the undo toast, the refund sheet with required reason, the swap sheet with ranked suggestions, the empty state with one action (Chapter 9).

**Guidelines** cover voice and tone, iconography, imagery and layout.

### 10.3 Building it incrementally

Do not stop product work to build a design system. Build it from the product:

1. Inventory the existing screens. Collect every color, size and component variant in use. You will find, typically, eleven grays and seven button styles.
2. Consolidate into a small token set and a handful of components.
3. Replace usage screen by screen, as you touch screens for other reasons.
4. Add a component to the system only when it is needed in two or more places.
5. Document as you go, in the code or alongside it, where builders will actually see it.

### 10.4 Accessibility: what it is and why it is not optional

Roughly one in six people worldwide lives with a significant disability, according to the World Health Organization. Many more have temporary or situational limits: a broken arm, bright sun on a screen, a noisy gym, gloves, a slow connection, being tired. Accessible design serves all of them.

It is also frequently a legal requirement. Depending on your country, sector and customers, accessibility may be required by law or contract, and the Web Content Accessibility Guidelines (WCAG) are the usual technical standard referenced. Check which rules apply to you; get legal advice where it matters.

WCAG is organized around four principles. Content must be:

- **Perceivable:** information available to at least one sense the user has (text alternatives for images, captions for video, enough contrast).
- **Operable:** usable with keyboard, switch devices and touch; enough time; no seizure-inducing flashing.
- **Understandable:** readable language, predictable behavior, help avoiding and correcting errors.
- **Robust:** works with assistive technologies like screen readers.

### 10.5 The accessibility checklist I use

These cover most of what goes wrong in practice:

- **Contrast:** normal text at least 4.5:1 against its background; large text and essential interface elements at least 3:1 (WCAG AA). Check both light and dark mode.
- **Never color alone:** status shown by color must also have text or an icon. "Void" payments in my app are struck through and labeled, not only grayed.
- **Touch targets:** at least 44 by 44 points on iOS and 48 by 48 density-independent pixels on Android (platform guidelines); WCAG 2.2 sets a lower minimum of 24 by 24 CSS pixels for the web. For gym use I aim larger.
- **Labels:** every input has a visible label; every icon-only button has an accessible name ("Scan machine," not "button").
- **Images:** meaningful images have text alternatives; decorative ones are hidden from screen readers. An exercise thumbnail's alternative is the exercise name.
- **Video:** demonstrations have captions or a text description of the movement and cues.
- **Keyboard and focus:** on web, everything works with a keyboard, focus is visible and moves in a logical order; dialogs trap focus and return it when closed.
- **Screen readers:** test with VoiceOver (iOS, Mac) and TalkBack (Android) on the main flows. Announce changes such as "Hidden. Undo available."
- **Text size:** the layout survives system font size at 200%. Nothing truncates critical information.
- **Motion:** respect the system's reduce-motion setting; avoid auto-playing animations that cannot be paused.
- **Time limits:** an undo toast that vanishes too quickly fails some users; keep the permanent undo path too.
- **Errors:** described in text, associated with the field, with suggestions.
- **Language:** plain words; short sentences; the domain terms users know.

Automated tools (browser accessibility checkers, linters) catch perhaps a third of issues. The rest need manual testing with assistive technology, and ideally testing with disabled users.

### 10.6 Content design

Words are interface. Most usability problems I fix are word problems.

**Voice and tone.** Voice is your product's consistent personality; tone adjusts to the moment. My app's voice: plain, warm, direct, knowledgeable about training. Tone: encouraging when a client logs a workout, calm and precise when money or errors are involved, never jokey about payments or health.

**Rules for interface text:**

- Start with the most important word. "Refund $60" not "Click here to process a refund."
- Buttons say what they do: verb plus object.
- Use sentence case, not Title Case.
- Prefer numbers to words for quantities: "3 sets," not "three sets."
- Be specific: "Saved 2 minutes ago," not "Saved recently."
- Explain why when asking for something sensitive: "Your trainer uses your injuries to choose safe exercises. Only you and your trainer can see this."
- Avoid jargon users do not use. Database words (record, entity, null, sync conflict) stay out of the interface.
- Keep a word list: the agreed terms from your domain glossary (Chapter 5), and the words to avoid.

**Microcopy for sensitive moments.** Consent screens, payment confirmations, deletion flows and error messages deserve the most care. Write them, then read them aloud to someone outside the team. If they cannot repeat back what will happen, rewrite.

### 10.7 Images, video and media

- **Rights:** use only media you own, license or create. Record the source and license for each asset. For my exercise library, every video's source and license status is tracked, and placeholders are used until verification.
- **Brands and trademarks:** describing a movement or a machine is fine. Using another company's logos, program names as your own categories, or their choreography is not. When unsure, ask a lawyer.
- **Performance:** compress images and video, serve sizes suitable for the device, and lazy-load long lists of thumbnails.
- **Representation:** show a range of people, bodies and abilities in imagery, especially in a health and fitness product.
- **People's images:** photos of identifiable people, especially clients' progress photos, are personal data (Chapter 15).

### 10.8 Design review

Before a design is built, review it against:

1. The user's task: can the main task be done in the fewest reasonable steps?
2. The principles (Chapter 8) and patterns (Chapter 9).
3. All states: empty, loading, error, offline, partial, many items, long text.
4. The accessibility checklist.
5. The words: specific, plain, consistent with the glossary.
6. The design system: does it reuse existing components? If it introduces a new one, is that justified?

After it is built, review it again on real devices. Screens look different on a five-year-old Android phone in sunlight than in a design tool on a large monitor.

### Exercises

1. Inventory the colors, font sizes and button styles in your project or an app you use. Propose a consolidated token set.
2. Run the accessibility checklist against your main flow. Use a screen reader for the entire flow at least once.
3. Write the voice-and-tone guide for your product in under one page, including ten words to always use and ten to avoid.

# Part IV — Engineering

## Chapter 11. Architecture for a small team

Architecture is the set of decisions about a system that are expensive to change later: what the main parts are, how they talk, where data lives and who is allowed to do what. A small team's architecture should optimize for three things: a few people can understand all of it, it is safe by default, and it costs little to run when usage is low.

### 11.1 The shape of most business products

Nearly every business product I have built or inherited has the same parts:

| Part | What it does | Typical choices in 2026 |
| --- | --- | --- |
| Clients | What users touch: mobile app, web app, admin dashboard | React Native/Expo for mobile and web from one codebase; React or a similar framework for web |
| Authentication | Who you are: sign-up, sign-in, sessions, password reset, social sign-in | A managed auth service (Supabase Auth, Firebase Auth, Auth0, Clerk); never build your own password storage |
| Database | The source of truth | PostgreSQL, usually hosted (Supabase, Neon, AWS RDS, Google Cloud SQL) |
| Authorization | What you may do | Row-level security in the database plus checks in server code |
| Server functions | Logic that must not run on the user's device: payments, emails, secrets, AI calls | Serverless/edge functions (Supabase Edge Functions, Cloudflare Workers, AWS Lambda) |
| File storage | Photos, videos, documents | Object storage with access policies (Supabase Storage, S3, R2) |
| Third-party services | Payments, email, SMS, AI, maps | Stripe, Resend/Postmark, Twilio, AI model APIs |
| Background jobs | Scheduled and delayed work: reminders, reports, cleanup | Scheduled functions or a job queue |
| Observability | Knowing what is happening: logs, errors, metrics | An error tracker plus the host's logs |

My coaching app uses exactly this shape: an Expo/React Native app that builds for Android and the web, Supabase for authentication, PostgreSQL with row-level security, edge functions for payments and AI tasks, storage for media, Stripe for card payments, and an email provider for receipts. The company website runs on Cloudflare Pages functions and shares some database tables with the app.

### 11.2 The client is not trusted

The single most important architectural rule: **anything running on a user's device can be inspected and changed by that user.** The app's code, its network requests, its stored values, all of it.

Therefore:

- **Never put secrets in client code.** API keys for payments, email or AI go in server functions, stored as server-side secrets. A public "anonymous" key for your database is fine only because row-level security limits what it can do.
- **Never rely on the client to enforce rules.** Hiding a button is a design decision, not security. The database or server must refuse the action.
- **Validate every input on the server,** even if the client already validated it.
- **Compute money on the server.** The client may display a price; the server decides what is charged.

### 11.3 Choosing a backend approach

Three common approaches for small teams:

**Backend-as-a-service (BaaS)** such as Supabase or Firebase. The client talks almost directly to the database, protected by access rules, with server functions for sensitive logic. *Strengths:* very fast to build, little server code, auth and storage included. *Risks:* everything depends on getting the access rules exactly right (Chapter 13); vendor coupling.

**Traditional API server** (Node, Python, Go, etc.) between clients and database. *Strengths:* all logic in one place, easier to reason about complex rules, database not exposed. *Risks:* more code to write and run; you build what a BaaS gives you.

**Full-stack framework** (Next.js, Remix, Rails, Django) where the web app and server are one codebase. *Strengths:* great for web-first products, mature patterns. *Risks:* mobile apps still need an API.

For most small business products, BaaS plus a few server functions is the fastest safe start, provided you treat access rules as code with tests. I chose this for the coaching app. If your rules are very complex, or you have strict requirements about where data lives, an API server may be worth the extra work.

### 11.4 Server functions

Put logic in server functions when it:

- Uses a secret (payment keys, email keys, AI keys).
- Moves money or creates financial records.
- Sends messages to people.
- Must be done atomically across several tables in a way access rules cannot express.
- Calls a third party whose response you must verify (payment webhooks).

Good practices for each function:

- **Authenticate the caller** from their session token, every time.
- **Authorize the action:** is this caller allowed to do this to this record?
- **Validate input** strictly, rejecting anything unexpected.
- **Make it idempotent** where it can be retried: calling "refund payment 123" twice must not refund twice. Use the payment provider's idempotency keys and check current state before acting.
- **Return clear errors** the client can turn into human messages.
- **Log what happened** without logging secrets or sensitive personal data.

### 11.5 Integration contracts between systems

When two systems talk (my app calling the website's receipt endpoint), write the contract down:

- The address and method.
- Authentication: what token is sent and how it is checked.
- Request body: fields and types.
- Responses: every status code and its body, including errors.
- Side effects: what happens (an email is sent; a record is updated).
- Idempotency: what happens if it is called twice.
- Who owns it, and how changes will be announced.

Then handle every response the contract lists, not just success. My refund screen handles: success with a message, success with no body, a 502 meaning the email service did not answer (show "Receipt not emailed... try again later"), and any other error with its message.

**Cross-origin requests (CORS).** When a web app on one address calls a server on another, the browser blocks the call unless the server explicitly allows that origin. This is a browser rule, not a server failure, and it affects only web clients, not native mobile apps. When my web dashboard's calls to the website's receipt endpoint were blocked, the endpoint was healthy (it answered "Sign in first" to a request from its own site); the fix belonged to the endpoint's owner: allow the dashboard's origin. Knowing the difference saved a day of debugging the wrong thing.

### 11.6 Mobile and web from one codebase

Cross-platform frameworks let one team ship Android, iOS and web. Lessons:

- **Most code is shared;** budget 10–20% for platform differences: camera, file access, notifications, payments, keyboard behavior, back navigation.
- **Test on every platform you ship.** A feature "done" on web is not done on Android until tested there. My definition of done says "verified on Android and web."
- **App stores add release latency** and policies (Chapter 17). Web updates are instant; mobile updates take review and user adoption. Design so old app versions keep working against a newer backend for a reasonable period.

### 11.7 Sizing for reality

Do not build for millions of users on day one. A single well-indexed PostgreSQL database handles far more load than most small businesses will ever produce. What kills small products is rarely scale. It is data loss, security holes, and features nobody uses.

Do plan for:

- **Indexes** on columns you filter and join by (Chapter 12).
- **Pagination** for any list that can grow.
- **Media size:** video and images grow storage and bandwidth costs faster than anything else.
- **Usage-priced services** (AI, SMS): set caps and alerts.

### 11.8 Architecture decision records

When you make a decision that is expensive to reverse, write an architecture decision record (ADR): a short document stating the context, the decision, the alternatives considered, and the consequences. Number them and keep them in the repository. Mark them Proposed, Accepted, Superseded or Rejected.

ADRs are how the next person, or you in a year, learns why things are the way they are. They also make it obvious when a decision is being revisited, which prevents the same debate from happening every few months.

### Exercises

1. Draw your project's architecture using the parts in section 11.1. For each part, name the technology and who controls it.
2. List every secret your project uses and where each is stored. Move any found in client code or the repository into server-side secret storage, and rotate them.
3. Write an integration contract for one call between two parts of your system, including every error response.
4. Write one ADR for a decision you have already made.

## Chapter 12. Data modeling: the database as a contract

The database is where your domain model (Chapter 5) becomes enforceable. Every rule you put in the database holds no matter which screen, script, function or future teammate touches the data. Every rule you leave only in application code holds only as long as every piece of code remembers it. This chapter is about putting the rules where they cannot be forgotten.

### 12.1 Tables from entities

Each entity usually becomes a table. Each table gets:

- **A primary key.** Use a generated UUID or an identity column. Never use something meaningful (an email, a name) as the primary key; meaningful things change.
- **Ownership columns.** Who owns this row: `trainer_id`, `client_id`, `organization_id`. Access rules depend on them (Chapter 13).
- **Timestamps.** `created_at` always; `updated_at` when rows change.
- **Types that match meaning.** Money as integer cents or a fixed-precision decimal, never floating point. Dates as dates, times as timestamps with time zone. Statuses as a constrained text or enum.

A payments table, simplified from my app:

```sql
create table coach_payments (
  id            uuid primary key default gen_random_uuid(),
  trainer_id    uuid not null references auth.users(id),
  client_id     uuid not null references coach_clients(id),
  amount_cents  integer not null check (amount_cents > 0),
  currency      text not null default 'usd',
  method        text not null check (method in ('card','cash','check','other')),
  status        text not null default 'pending'
                check (status in ('pending','paid','failed','refunded','void')),
  status_reason text,
  status_at     timestamptz,
  created_at    timestamptz not null default now(),
  -- refunds and voids must say why
  constraint reason_required check (
    status not in ('refunded','void') or length(trim(status_reason)) > 0
  )
);
```

Read each line as a rule: amounts are positive; a payment always belongs to a trainer and a client; status is one of five values; a refund or void without a reason is impossible.

### 12.2 Constraints: making invalid states impossible

Constraints are the cheapest bug prevention there is. Use all of them:

- **NOT NULL** on everything that must exist.
- **CHECK** for value rules (positive amounts, allowed statuses, reason required).
- **FOREIGN KEY** for relationships, with a deliberate `on delete` rule. For financial records, `restrict` (refuse) is usually right; `cascade` can silently delete history.
- **UNIQUE** for things that must not repeat (one active program per client, one membership per user per organization). Partial unique indexes handle "unique among active rows."
- **Exclusion constraints** for no-overlap rules (no two bookings for one trainer at the same time).

Ask of every column: what values would be nonsense here? Then forbid them.

### 12.3 Triggers for rules that span time

Some rules depend on the previous state, which CHECK constraints cannot see. Use a trigger. Two from my app:

```sql
-- Paid payments are never deleted.
create function coach_payments_no_delete() returns trigger as $$
begin
  if old.status in ('paid','refunded','void') then
    raise exception 'Financial records are kept. Refund or void instead.';
  end if;
  return old;
end $$ language plpgsql;

create trigger coach_payments_no_delete
  before delete on coach_payments
  for each row execute function coach_payments_no_delete();

-- A paid payment's amount cannot change.
create function coach_payments_amount_locked() returns trigger as $$
begin
  if old.status = 'paid' and new.amount_cents <> old.amount_cents then
    raise exception 'A paid payment''s amount can''t change. Refund it and record a new payment.';
  end if;
  if new.status is distinct from old.status then
    new.status_at := now();
  end if;
  return new;
end $$ language plpgsql;
```

The error messages are written for humans because the app passes them straight to the user (Chapter 9). Keep trigger logic small and test it (Chapter 16).

### 12.4 Normalization, and when to break it

Normalize by default: store each fact once. A client's name lives in the clients table, not copied into every payment. This prevents the classic bug where a change updates one copy and not another.

Denormalize deliberately when:

- **History must be frozen.** An invoice must show the price at the time of sale, not today's price. Copy the price into the invoice line. This is not duplication; it is a different fact ("what was charged").
- **Performance requires it,** and you have measured. Keep the copy updated by a trigger or job, and document it.
- **Reporting needs it.** Build reporting tables or views separately from the operational tables.

### 12.5 Ledgers for money and credit

For anything that represents a balance (account credit, session packages, loyalty points, inventory), use a ledger: an append-only table of events, with the balance computed from them.

```sql
create table coach_credit_ledger (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references coach_clients(id),
  delta       integer not null check (delta <> 0),   -- +10 sessions bought, -1 session used
  kind        text not null check (kind in ('purchase','use','refund','adjustment')),
  reason      text not null,
  payment_id  uuid references coach_payments(id),
  created_by  uuid not null,
  created_at  timestamptz not null default now()
);
-- Balance = sum(delta). Corrections are new rows, never edits.
```

Revoke update and delete on ledger tables for everyone except a tightly controlled maintenance role. Mistakes are fixed with an adjustment row that has a reason. The ledger then tells the full story of every balance, which is exactly what you need when a client says "I had six sessions left, not four."

### 12.6 Migrations

The database schema changes over time through migrations: numbered or timestamped scripts that move the schema from one version to the next. Rules:

- **Every schema change is a migration file in the repository.** No changes made by hand in a dashboard. If someone does make one, capture it immediately as a migration.
- **Migrations run in order and are never edited after being applied** to a shared environment. To fix one, write a new one.
- **Test migrations on a copy first:** locally, then on a development branch or staging database, then production.
- **Prefer additive changes.** Add a column, backfill it, switch readers, then remove the old one in a later release. This "expand and contract" approach keeps old app versions working.
- **Make destructive migrations rare and reviewed.** Dropping a column or table destroys data. Back up first, confirm nothing reads it, and get approval.
- **Production migrations need the owner's approval** if your decision rights say so. Mine do: I write and test them; the owner approves applying them to the live database.

### 12.7 Indexes and performance

Indexes make reads fast and writes slightly slower. Add them:

- On every foreign key you join or filter by (`trainer_id`, `client_id`).
- On columns used in access rules, because rules run on every query.
- On columns used for sorting long lists (`created_at`).
- As composite indexes for common filter combinations (`trainer_id, created_at`).

Measure before and after with your database's query plan tool (`EXPLAIN ANALYZE` in PostgreSQL). Your hosting provider's advisor may also flag missing indexes and slow queries; read it weekly.

### 12.8 Reference data and versioning

Curated reference data (my exercise library of 1,842 exercises, the machine catalog, the credentials list) needs its own discipline:

- **Keep the source in the repository** (spreadsheets, JSON, or SQL seed files) with a repeatable import script.
- **Give stable IDs** that never change even when names do. Programs reference exercise IDs; renaming an exercise must not break them.
- **Support aliases** for search: the same exercise has many names ("RDL," "Romanian deadlift").
- **Record provenance:** where each item came from, its license, who verified it, when.
- **Version releases** of the data so you can tell which version a user saw.

### 12.9 Soft deletion and archiving

For user content that users may want back (programs, exercises they created, clients who left), use soft deletion: an `archived_at` or `hidden` flag instead of removing the row. Filter archived rows out of normal views. Offer restore.

Be careful: soft-deleted personal data is still personal data. When a person requests deletion under privacy law, soft delete is not enough; the personal data must actually be erased or anonymized (Chapter 15).

### 12.10 Naming and documentation

- Name tables and columns in the domain language, consistently (Chapter 5). Prefix tables by product when products share a database: my app's tables start with `coach_`.
- Comment tables and columns in the database itself (`comment on column...`), especially rules and units.
- Keep a short data dictionary in the repository: each table, its purpose, owner, whether it holds personal or financial data, and its retention rule.

### Exercises

1. Write the `create table` statements for your project's three most important tables with every constraint you can justify.
2. Write one trigger enforcing a rule that depends on the previous state, with a human-readable error message.
3. Design a ledger for any balance in your domain. Write the query that computes a balance and the query that explains it.
4. Write a data dictionary for your project.

## Chapter 13. Security and access control

Security is the discipline of making sure only the right people can do the right things with the right data, and that you find out when that fails. In a small business there is no security team. The builder-owner is the security team. This chapter covers the parts that matter most for business software: authentication, authorization, secrets, input handling, logging, and testing that your rules actually work.

### 13.1 Threat modeling in one hour

Before writing access rules, think like an attacker for an hour. Use four questions (adapted from Adam Shostack's approach):

1. **What are we building?** Draw the architecture (Chapter 11) and mark where personal data and money live.
2. **What can go wrong?** For each part, ask: who might want to misuse it, and how?
3. **What are we going to do about it?** A mitigation for each serious threat.
4. **Did we do a good job?** Tests and reviews that check the mitigations.

The threats that actually hit small business products, most common first:

- **A logged-in user reading or changing another user's data** by editing an ID in a request. This is the top risk in nearly every app I review.
- **Leaked secrets:** keys committed to a repository, pasted into chat, or shipped in client code.
- **Account takeover:** weak passwords, no rate limiting on sign-in, reused passwords, phishing.
- **Injection:** user input treated as code (SQL, HTML/JavaScript in web pages).
- **Overly broad staff access:** everyone on the team can see all customer data.
- **Vulnerable dependencies:** an outdated library with a known hole.
- **Data in the wrong place:** health details in logs, analytics or error reports.

The OWASP Top 10 lists the most critical web application risks and is worth reading in full.

### 13.2 Authentication

Authentication answers "who are you?" Do not build it yourself. Use a managed provider and configure it carefully:

- Require email verification before access to anything sensitive.
- Enforce reasonable password rules and check against known breached passwords if your provider supports it.
- Offer multi-factor authentication, and require it for staff and administrator accounts.
- Rate-limit sign-in and password reset.
- Keep sessions short-lived with refresh tokens; revoke sessions on password change.
- Configure allowed redirect URLs for sign-in strictly.

OAuth and sign-in provider settings are sensitive configuration. On my team, they are owner-only: I can propose changes, but the owner applies them.

### 13.3 Authorization and least privilege

Authorization answers "what may you do?" The principle is least privilege: every user, staff member, service and function gets the minimum access needed, and nothing more by default.

Define roles from your domain model. For a coaching app:

- **Client:** read their own profile, programs assigned to them, their own logs and payments; write their own logs and profile.
- **Trainer:** read and write their own clients' records, their own programs and payments; read the shared library.
- **Platform reviewer:** read the library review queue; approve or remove library entries; no access to clients' records.
- **Service functions:** narrowly scoped to the task each performs.

Then deny everything by default and grant exactly these.

### 13.4 Row-level security

Row-level security (RLS) lets the database decide, for every row, whether the current user may see or change it. With a backend-as-a-service, RLS is the main line of defense, because clients query the database directly.

Two policies from my app's payments table:

```sql
alter table coach_payments enable row level security;

-- Trainers see and manage their own payments.
create policy trainer_own_payments on coach_payments
  for all
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

-- Clients can see (only see) their own payments.
create policy client_reads_own_payments on coach_payments
  for select
  using (client_id in (
    select id from coach_clients where user_id = auth.uid()
  ));
```

Rules for RLS:

- **Enable RLS on every table** reachable from clients. A table without it is open to anyone with the public key. Your host's security advisor will usually flag this; read it.
- **Write separate policies for select, insert, update and delete** when they differ. Clients may read payments but must never insert them.
- **Use `with check`** on insert and update policies so users cannot write rows that would belong to someone else.
- **Keep policies simple.** Complex policies are slow and hard to verify. Move complex logic into security-definer functions with narrow, tested behavior.
- **Index the columns policies use.**
- **Service keys bypass RLS.** Use them only in server functions, never in clients, and keep those functions' own checks strict.

### 13.5 Testing access rules

An access rule without a test is a hope. My definition of done requires a test for every table and every policy, and they run on every change. A test sets up two users and proves both what is allowed and what is refused:

```sql
-- Arrange: trainer A with client A1; trainer B with client B1; one payment each.
-- Act and assert, as trainer A:
select set_config('request.jwt.claims', '{"sub":"<trainer A id>","role":"authenticated"}', true);
set local role authenticated;

select is( (select count(*) from coach_payments), 1::bigint,
  'trainer A sees only their own payment');

select throws_ok(
  $$ insert into coach_payments (trainer_id, client_id, amount_cents, method)
     values ('<trainer B id>', '<client B1 id>', 100, 'cash') $$,
  '42501', null, 'trainer A cannot record a payment for trainer B');

select is( (with u as (update coach_payments set status_reason = 'x'
             where trainer_id = '<trainer B id>' returning 1)
           select count(*) from u), 0::bigint,
  'trainer A cannot change trainer B''s payment');
```

(The example uses the pgTAP testing extension for PostgreSQL; your stack's equivalent will differ, but the shape is the same.) For every table, test:

- Each role can do what it should.
- Each role cannot read other users' rows.
- Each role cannot insert rows owned by someone else.
- Each role cannot update or delete what it should not.
- Anonymous users get nothing.

Negative tests (proving refusal) matter more than positive ones. A broken positive rule produces a bug report from a frustrated user within a day. A broken negative rule produces silence until it becomes a breach.

### 13.6 Secrets

A secret is anything that grants access: API keys, database passwords, signing keys, tokens, webhook secrets.

- **Store secrets in the host's secret manager** or environment configuration for server functions. Never in code, repositories, documents, tickets, chat messages or logs.
- **Separate test and live keys.** Development uses test-mode keys only.
- **Rotate on exposure.** If a secret is ever pasted somewhere it shouldn't be, rotate it immediately; assume it is compromised.
- **Limit who holds them.** On my team, credentials are owner-only. Builders write code that reads secrets from configuration; the owner sets the values.
- **Scan for secrets** automatically in your repository and CI.

### 13.7 Input and output handling

- **Use parameterized queries** or a query builder. Never build SQL by joining strings with user input.
- **Escape output** in web pages; modern frameworks do this by default. Be very careful with anything that renders raw HTML.
- **Validate inputs on the server** against a schema: types, lengths, allowed values.
- **Limit file uploads:** allowed types, maximum size, scanned where appropriate, stored outside the web root with access policies. Storage buckets need their own access rules; my credentials upload is restricted to a specific path per user.
- **Rate-limit** expensive or abusable endpoints: sign-in, AI calls, email sending.

### 13.8 Logging and monitoring for security

- Log security-relevant events: sign-ins, failed sign-ins, permission denials, role changes, exports, deletions, refunds.
- **Never log secrets, passwords, tokens, full card numbers or sensitive personal data.** Log identifiers, not contents.
- Alert on unusual patterns: many failed sign-ins, a spike in permission denials, a user exporting far more than usual.
- Keep logs for a defined period, protected like the data they describe.

### 13.9 Dependencies and supply chain

- Keep dependencies few and well maintained. Every package is code you did not write running with your privileges.
- Use lockfiles so builds are reproducible.
- Turn on automated vulnerability alerts and update regularly.
- Review what a new dependency does and who maintains it before adding it.

### 13.10 When something goes wrong

Have a written incident plan before you need it:

1. **Contain:** revoke keys, disable the affected feature, block the attacker.
2. **Assess:** what data, how many people, since when.
3. **Notify:** the owner immediately. Legal obligations to notify affected people or regulators may apply, often with strict deadlines; the owner and a lawyer decide.
4. **Fix:** the root cause, with a test that would have caught it.
5. **Review:** a blameless written review of what happened and what changes (Chapter 20).

### Exercises

1. Run the one-hour threat model on your project and list your top five threats with mitigations.
2. Enable RLS on every table in your project and write policies for each role.
3. Write negative tests proving each role cannot read, insert, update or delete another user's rows. Make them run automatically.
4. Search your repository history for secrets. Rotate anything you find.

## Chapter 14. Money: payments, ledgers, refunds and records

The moment your product touches money, the standard for correctness changes. A layout bug annoys someone. A money bug costs someone, and they remember. This chapter covers taking payments, recording payments that happen outside your system, refunds and voids, receipts, balances, reconciliation and record keeping, using the payments work on my coaching app as the running example.

### 14.1 The rules first

My team's network-wide money rules, which I recommend to any business:

1. **Payments are never deleted.** They are refunded or voided, with a reason.
2. **Records are kept for seven years.** (Check your own jurisdiction's tax and business record rules with an accountant; seven years covers most common requirements in the U.S.)
3. **Credit is a ledger.** Balances are computed from events, never overwritten.
4. **Money is integers.** Amounts in the smallest currency unit (cents), never floating point.
5. **The server decides what is charged.** Never trust an amount from a client.
6. **Every money movement produces a record and a receipt.**
7. **Production payment changes and pricing are owner decisions.**

### 14.2 Don't touch card numbers

Use a payment processor (Stripe, Square, Adyen, PayPal, Braintree and others) and its hosted payment fields or checkout pages, so card numbers go straight from the customer's device to the processor and never through your servers. This keeps your obligations under the Payment Card Industry Data Security Standard (PCI DSS) as small as possible. Your system stores only the processor's identifiers (customer ID, payment intent ID) and safe display details (card brand, last four digits).

Never log, store, email or screenshot a full card number. Never ask a customer to send one by message.

### 14.3 Two kinds of payments

Most small businesses have both:

- **Processed payments:** money moves through your processor (a client pays by card in the app). The processor is the source of truth for whether money moved.
- **Recorded payments:** money moved outside the system (cash, check, a bank transfer, another platform) and the trainer records it for their books. Your system is the record, but no money moved through it.

They look similar on screen and behave differently on reversal:

| Action | Processed payment | Recorded payment |
| --- | --- | --- |
| Refund | Call the processor's refund API; money returns to the card | Mark refunded with a reason; the trainer returns the cash themselves |
| Void | Usually not applicable once captured (refund instead) | Mark void with a reason: it was recorded by mistake |
| Receipt | Sent after processor confirms | Sent after the status change is saved |

My refund sheet chooses the path automatically: card payments go through the server function that calls the processor; recorded payments are updated directly, protected by the database rules from Chapter 12.

### 14.4 The payment flow

A safe card payment flow:

1. **Client requests to pay** for something (a session package). The app sends only *what* is being bought.
2. **Server function computes the amount** from the price in the database, creates a pending payment record, and creates a payment intent with the processor, passing an idempotency key and your payment ID in metadata.
3. **Client completes payment** in the processor's hosted UI.
4. **Processor notifies your server** through a webhook. The server **verifies the webhook signature**, looks up the payment by ID, and marks it paid if the amounts match.
5. **Server writes the ledger entry** (for example, +10 sessions) and triggers the receipt.
6. **Client sees confirmation** from the server's state, not from its own assumption.

Do not mark a payment paid because the client said so. Only the verified webhook (or a direct server-side check with the processor) makes it paid.

### 14.5 Idempotency and retries

Networks fail. Users double-tap. Webhooks are delivered more than once. Every money operation must be safe to repeat:

- Use the processor's idempotency keys on create and refund calls.
- Before acting, check current state: if the payment is already refunded, return success without refunding again.
- Make webhook handlers idempotent: processing the same event twice must not double-count.
- Store processor event IDs you have handled.

### 14.6 Refunds and voids

The refund and void flow in my app, which you can adapt:

1. Trainer opens the payment's menu: **Refund**, **Void (recorded by mistake)** for recorded payments, and **Email the receipt again** when already refunded or void. There is no delete.
2. A sheet shows the amount, the client, and what will happen, with a **required reason** field.
3. On confirm:
   - Card payment: server function calls the processor's refund with an idempotency key, then stores status `refunded`, the reason and the time.
   - Recorded payment: the database update sets status and reason; triggers stamp the time and refuse changes that break the rules.
4. The app calls the receipt service, which emails the client a refund or void notice.
5. The app shows the outcome precisely, including partial success: "Refunded. Receipt not emailed: the email service didn't answer. Try 'Email the receipt again' later."
6. The payment list shows the status and reason; void rows are struck through and labeled.

Decisions you must make for your business:

- **Partial refunds:** allowed? Then track refunded amount separately from the original amount, and never let total refunds exceed the original.
- **Who can refund:** only the person who took the payment? A manager? Above what amount is approval required?
- **Refund window:** any limit, and does your processor impose one?
- **Fees:** processors may not return their original processing fee on refunds. Know your processor's policy and decide who bears that cost.
- **Ledger effects:** refunding a 10-session package after 3 sessions were used: refund 7/10? Your policy must say, and the ledger must record it.

### 14.7 Receipts

Every payment, refund and void should produce a receipt the customer can keep. A receipt includes: business name and contact, date and time, what was bought, amount and currency, payment method (brand and last four for cards), the status, a reference number, and for refunds and voids the reason in customer-friendly words.

Engineering points:

- Generate receipts from stored data, so they can be re-sent identically.
- Send through a transactional email provider, from a domain configured for email authentication (SPF, DKIM, DMARC) so receipts do not land in spam.
- Record that a receipt was sent and when. Offer "send again."
- Never include sensitive health details in a receipt; "Personal training package (10 sessions)" is enough.

### 14.8 Disputes and chargebacks

A customer can dispute a card charge with their bank. The processor notifies you, and you have a limited time to respond with evidence. Make sure your system can produce, for any payment: what was bought, when, the customer's agreement to the price and terms, proof of service (sessions attended), and communications. Good records win disputes; vague ones lose them.

### 14.9 Subscriptions

If you sell subscriptions:

- Show the price, billing period and renewal terms clearly before purchase.
- Make cancellation as easy as sign-up. Many jurisdictions have rules about this; check current consumer protection rules where you sell.
- Send reminders before renewals where required or wise.
- Handle failed renewals with retries and a grace period, and tell the customer.
- **Mobile app stores have their own rules** about selling digital goods and subscriptions inside apps, often requiring their billing systems for digital content. Rules differ for physical services, like in-person training sessions. Read the current store policies before designing payments in a mobile app (Chapter 17); getting this wrong causes rejections.

### 14.10 Reconciliation

At least monthly, reconcile: compare your records with the processor's and the bank's.

- Every processor payment has a matching record in your system, and vice versa.
- Refunds match.
- Payouts to the bank equal payments minus refunds minus fees.
- Recorded payments are reviewed by the business for plausibility.

Automate the comparison and report mismatches. A mismatch caught in a week is a bug. A mismatch caught at tax time is a crisis.

### 14.11 Testing money

- Use the processor's test mode and test cards for all development. Never test with real cards or real money.
- Test every path: success, decline, insufficient funds, network failure mid-payment, duplicate webhook, refund twice, partial refund, refund after ledger use.
- Test database rules: paid payments cannot be deleted; amounts cannot change after payment; reasons are required.
- Before launch, run one end-to-end test on the live system with the owner's approval, designed so that no real money moves or so that it is refunded immediately. For example: a test trainer and test client using the owner's inbox, a $1 recorded cash payment, then a void, then confirm the receipt arrives. Note that, under a seven-year retention rule, that test record stays; label test records clearly.

### Exercises

1. Write your business's money rules, modeled on section 14.1.
2. Draw the card payment flow for your project, marking where the amount is decided and where payment becomes "paid."
3. Design the refund flow: menu options, required inputs, server steps, receipt, and every partial-failure message.
4. Write a reconciliation query that compares your payments table with an export from your processor.

## Chapter 15. Sensitive data, privacy and compliance

Privacy is not a checkbox at launch. It is a set of promises to the people whose data you hold, kept by design, by code and by habit. Some data is more sensitive than others: health information, financial details, government identifiers, precise location, children's data, and anything about sex life, religion, ethnicity or politics. A coaching app handles health data every day: weights, measurements, injuries, medical conditions, progress photos, how someone slept and how they feel. This chapter shows how to handle such data responsibly in any product.

A necessary caution: privacy law varies by country and U.S. state, changes often, and has serious penalties. This chapter teaches the practices and the questions. It is not legal advice. Before launch, have a lawyer review your data practices and notices for the places you operate.

### 15.1 The principles

Most privacy laws and frameworks share a core set of principles. Build to these and you will be most of the way to compliance anywhere:

1. **Purpose limitation:** collect data for specific stated purposes and use it only for those.
2. **Data minimization:** collect only what you need for those purposes.
3. **Notice:** tell people clearly what you collect, why, who sees it and how long you keep it.
4. **Consent and choice:** get meaningful consent where required, especially for sensitive data, and let people change their minds.
5. **Access and portability:** let people see and export their data.
6. **Correction:** let people fix wrong data.
7. **Deletion:** let people have their data deleted, subject to legal retention duties.
8. **Security:** protect data appropriately to its sensitivity.
9. **Accountability:** know what you hold, where, and who is responsible.

### 15.2 Know which rules apply

Questions to answer with your lawyer:

- **Where are your users?** The EU and UK's GDPR treats health data as a "special category" with stricter conditions. U.S. states increasingly have comprehensive privacy laws (California's CCPA/CPRA among them), and some have laws specifically covering consumer health data, such as Washington's My Health My Data Act, which requires consent for collecting such data.
- **Are you a healthcare provider, health plan, or their business associate?** HIPAA applies to those "covered entities" and their "business associates." A personal trainer's app is usually not covered by HIPAA, but this depends on the facts, for example if you integrate with a clinic. Do not assume either way.
- **Do you fall under consumer health app rules?** In the U.S., the FTC's Health Breach Notification Rule can apply to health apps not covered by HIPAA.
- **Do children use it?** Laws like COPPA in the U.S. impose strict rules for children under 13. If you do not intend to serve children, say so and design sign-up accordingly.
- **What do the app stores require?** Both major stores require privacy disclosures and have specific rules for health data.

### 15.3 The data inventory

You cannot protect what you have not listed. Build and maintain a data inventory, one row per data element or group:

| Data | Example | Sensitivity | Purpose | Where stored | Who can access | Retention | Deletion method |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Contact details | Name, email, phone | Personal | Account, communication | auth users, clients table | The person, their trainer | Life of account + 30 days | Delete/anonymize on request |
| Health intake | Injuries, conditions, medications | Sensitive (health) | Safe programming | intake table | The person, their trainer | Life of relationship | Hard delete on request |
| Body metrics | Weight, measurements | Sensitive (health) | Progress tracking | metrics table | The person, their trainer | Life of relationship | Hard delete on request |
| Progress photos | Images | Sensitive (health, biometric-adjacent) | Progress tracking | Private storage bucket | The person, their trainer | Until deleted by user | Delete objects and rows |
| Workout logs | Exercises, weights, reps | Health-related | Training | sessions tables | The person, their trainer | Life of relationship | Delete on request |
| Payments | Amount, date, method, last 4 | Financial | Accounting, receipts | payments table | Trainer, client (own) | 7 years | Retained; personal fields minimized after closure |
| Credentials | Certificates uploaded by trainers | Personal | Verification | Private storage | Trainer, platform reviewers | While active | Delete on request |

Mark which tables are shared with other products (Chapter 5). Review the inventory whenever you add a feature that collects something new.

### 15.4 Consent done properly

For sensitive data, consent should be:

- **Specific:** for the stated purpose ("so your trainer can choose safe exercises"), not bundled into general terms.
- **Informed:** in plain words, at the moment of collection, saying who will see it.
- **Freely given:** the product should still work, as far as possible, if someone declines optional sensitive data.
- **Recorded:** store who consented, to what version of the text, and when.
- **Withdrawable:** as easy to withdraw as to give, with clear consequences explained.

Design consent screens with the same care as payment screens (Chapter 10). If a person can't repeat back what they agreed to, the consent is not meaningful.

### 15.5 Access control for sensitive data

Everything in Chapter 13 applies, more strictly:

- Row-level security on every sensitive table with tests for every role, including negative tests.
- **Staff access by exception.** Platform staff should not be able to browse clients' health data. If support access is ever needed, make it time-limited, logged, and consented by the user.
- **Private storage buckets** for photos and documents, with access policies per user and short-lived signed URLs for viewing.
- **No sensitive data in notifications, emails, logs, analytics, error reports or AI prompts** unless that specific use is consented and necessary. A receipt says "training package," not "post-surgery rehab program."
- **Separate sensitive tables** from general ones so policies and retention can differ.

### 15.6 Export

People should be able to get a copy of their data in a usable format. Build an export that:

- Includes everything about the person across tables and storage (use your inventory to be sure).
- Uses a common format (JSON for completeness, CSV for tables, original files for photos).
- Is generated on the server, verified to belong to the requester, and delivered through an expiring link.
- Is logged as a security event.

### 15.7 Deletion

Deletion is where privacy meets record-keeping, and the two conflict. A client asks to be deleted. You must delete their health data. You must also keep payment records for seven years for tax purposes.

Resolve it by design:

1. **Separate what must be kept from what must go.** Payment records stay; health data, photos, logs and contact details go.
2. **Minimize the retained records.** Replace the client's name and contact details in retained financial records with an anonymous reference, keeping only what the law requires.
3. **Delete everywhere:** database rows, storage objects, search indexes, caches, analytics, backups as they expire, and copies held by vendors.
4. **Confirm** to the person what was deleted and what was retained and why.
5. **Log the deletion** (that it happened, not what was deleted).
6. **Test deletion** like any other feature: create a user with data everywhere, delete them, and verify nothing personal remains outside the permitted retained records.

Deletion is irreversible, so build it as a deliberate flow with a short grace period ("Your data will be deleted in 7 days; cancel anytime before then") where the law allows.

### 15.8 Vendors and data processing

Every vendor that touches personal data (database host, email provider, AI service, analytics) is part of your privacy posture.

- List them in your inventory with what data each receives.
- Review their security and privacy terms; sign a data processing agreement where required.
- Send each the minimum. Your email provider needs an email address and a receipt body, not health data.
- For AI services, check whether inputs are retained or used for training, and choose settings and providers accordingly. Do not send sensitive personal data to an AI service without a clear legal basis and the user's understanding.

### 15.9 Breach readiness

Assume a breach is possible and prepare:

- Know what you hold and where (the inventory).
- Have the incident plan from Chapter 13.
- Know your notification duties and deadlines in each jurisdiction, with a lawyer's help, before you need them.
- Keep contact paths to affected users current.

### 15.10 Privacy by design in practice

When designing any feature, ask:

1. Does this collect new personal data? Is it necessary?
2. Is any of it sensitive? Does it need consent?
3. Who will be able to see it? Is that obvious to the user?
4. Where will it flow: logs, emails, vendors, AI, analytics?
5. How long is it kept, and how is it deleted and exported?
6. What is the worst thing that happens if it leaks?

Put these questions in your feature plan template (Appendix A). Answering them takes ten minutes and prevents the most expensive class of mistakes in software.

### Exercises

1. Build a complete data inventory for your project using the columns in section 15.3.
2. Write the consent text for one piece of sensitive data in your product. Test it by asking someone to explain it back.
3. Design and test deletion for one user: list every place their data lives, delete it, and verify.
4. List every vendor that receives personal data and exactly which fields each receives. Remove any field that is not needed.

## Chapter 16. Testing and the definition of done

"Done" is the most abused word in product work. It can mean "I wrote the code," "it works on my machine," "it passed review," or "users are successfully using it." Those differ by weeks and by risk. A builder-owner defines done in writing, applies it to every piece of work, and does not bend it under pressure. This chapter covers the definition and the testing that backs it.

### 16.1 A definition of done

My team's definition of done for any feature:

1. **Tested:** automated tests cover the new behavior, including failure and edge cases, and the whole suite passes.
2. **Access rules tested:** every new or changed table and policy has positive and negative tests.
3. **Reviewed:** someone other than the author has reviewed the change against the plan, the code and the tests. On my team, a designated reviewer checks new tables.
4. **Verified on real targets:** the feature has been used on Android and on the web, not only in a simulator or in tests.
5. **Privacy checked:** any new personal data is in the inventory, with consent, access, export and deletion handled.
6. **Documented:** the plan's implementation record is updated; user-facing changes have help text; the status card or changelog notes it.
7. **Released and observed:** it is live, and error tracking shows no new problems after a defined period.

Write yours. Post it where everyone who builds will see it. When someone says "done," ask "done by the definition?"

### 16.2 What to test, and how much

The classic testing pyramid still guides the mix:

- **Unit tests** (many): a single function or module in isolation. Fast, precise. Use for business logic: price calculations, state transitions, matching algorithms, formatting, parsing.
- **Integration tests** (some): several parts together, especially code plus database. Use for queries, access rules, triggers, server functions with their dependencies faked.
- **End-to-end tests** (few): the real app driven like a user, through the main flows. Slow and sometimes flaky; keep them to the paths that must never break: sign-in, the core task, payment, refund.
- **Manual and exploratory testing** (targeted): a human trying to break the feature, especially on real devices, with real content and unusual inputs.

Prioritize tests by the cost of failure. Money, access rules and data integrity get exhaustive tests. A cosmetic preference toggle gets one.

### 16.3 Writing good tests

- **Test behavior, not implementation.** "A trainer cannot refund another trainer's payment," not "function X calls Y." Behavior tests survive refactoring.
- **One reason to fail per test,** with a name that reads as a requirement.
- **Arrange, act, assert:** set up the situation, do the thing, check the result.
- **Cover the edges:** zero, one, many; empty strings; maximum lengths; boundaries (a refund equal to the payment, one cent more); time zones and daylight saving changes; concurrent actions; retries.
- **Include negative cases:** what must be refused, and with what message.
- **Make tests deterministic:** fixed times, fixed random seeds, isolated data. A test that fails 1 time in 20 trains everyone to ignore failures.
- **Use synthetic data,** never real customer data. Build fixtures that look realistic (long names, accents, odd values) and are entirely invented.

### 16.4 Testing the database

Because the database enforces so many rules (Chapters 12 and 13), test it directly:

- Run a real PostgreSQL instance for tests (a local install or container), apply all migrations from scratch, then run the test suite.
- Test every constraint and trigger by attempting the forbidden thing and asserting the specific error.
- Test every RLS policy for every role, including anonymous.
- Test migrations: apply them to a copy of a realistic schema and confirm existing data survives correctly.

I keep a test runner that creates a scratch database, applies every migration, and runs every table's policy tests. Adding a table without adding its test file fails review.

### 16.5 Testing integrations

For third parties (payment processor, email, AI):

- **Unit and integration tests fake them,** with the fakes returning every response the contract lists, including errors and timeouts.
- **Contract tests** check that your fakes still match reality, using the vendor's test or sandbox mode.
- **A small number of end-to-end tests** run against test mode before release.
- **A live verification,** with owner approval and no real money or data at risk, before launch (Chapter 14).

### 16.6 Testing on real devices

Simulators and desktop browsers lie about performance, touch, keyboards, cameras, permissions and network conditions. Before calling something done:

- Use it on a mid-range Android phone a few years old, not only the newest flagship.
- Use it in the web browsers your users actually use.
- Try it with poor connectivity (most phones and browser developer tools can simulate slow networks).
- Try it with large system text and with a screen reader on the main path.
- Try it in the real environment if you can: for my app, on a gym floor.

### 16.7 Review

Code review catches bugs, spreads knowledge and keeps standards. Make it effective:

- **Small changes.** Review quality collapses above a few hundred lines. Split work into small, focused pull requests.
- **Context in the description:** what and why, how it was tested, risks, screenshots for UI changes, and what the reviewer should focus on.
- **Reviewer checks** the diff against the plan, the tests, failure modes, security and privacy, and backward compatibility.
- **Evidence, not assurances.** Reviewers look at actual test results and CI status, not a claim that tests passed.
- **No self-approval.** The author reviews their own work thoroughly, and someone else must also approve it. High-risk changes (money, access rules, migrations, identity) deserve a second reviewer or a plan review before building.

### 16.8 Continuous integration

Automate checks on every proposed change:

- Type checking.
- Linting and formatting.
- Unit and integration tests, including database policy tests.
- A build of each platform.
- Secret scanning and dependency vulnerability checks.

A change cannot be merged unless all pass. When a check fails, read the failure output before anything else. Some failures are environmental (a flaky runner, a checkout mismatch) and need a re-run; most are real.

### 16.9 Bugs

When a bug is found:

1. **Reproduce it** and write a failing test that captures it.
2. **Fix it** until the test passes.
3. **Ask why the tests missed it** and whether a class of similar bugs exists. Fix the class if you can.
4. **Check the impact:** did it affect real users or data? If so, who, and what do they need to be told?

Prioritize bugs by harm, not by how loud the report was:

| Severity | Examples | Response |
| --- | --- | --- |
| Critical | Data exposed to the wrong user, money charged wrongly, data loss | Drop everything; fix, contain, tell the owner today |
| High | Core task blocked for many users, payment flow broken | Fix within a day or two |
| Medium | Feature broken with a workaround | Schedule within the current phase |
| Low | Cosmetic, rare edge case | Backlog |

### 16.10 When pressure hits

There will be weeks when a deadline makes skipping tests tempting. Resist with specifics: name what could break and what it would cost. If scope must shrink to meet a date, cut features, not testing. A smaller feature that works is a delivery. A larger feature that loses data is an incident with a release date.

### Exercises

1. Write your definition of done. Apply it to the last thing you called done. Was it?
2. Set up a test database that applies all your migrations and runs policy tests automatically.
3. Pick your riskiest feature and list twenty test cases, at least eight of them negative or edge cases. Implement them.
4. Configure CI so that no change can merge without passing typecheck, lint, tests and a build.

## Chapter 17. Shipping: environments, CI, releases and app stores

Shipping is the act of putting changes in front of real users. Teams that ship small changes often, safely, outperform teams that ship big changes rarely, on almost every measure: speed, quality and stability. That is the main finding of the research summarized in *Accelerate*. This chapter shows how a small team ships often without breaking things.

### 17.1 Environments

Keep at least three:

| Environment | Purpose | Data | Who uses it |
| --- | --- | --- | --- |
| Local / development | Building and testing | Synthetic only | Builders |
| Preview / staging | Testing a change in a production-like setup before release | Synthetic, or a separate test project | Builders, reviewers, testers |
| Production | Real users | Real | Users; builders only under strict rules |

Many hosting platforms create a preview environment for each pull request and a database branch for testing migrations. Use them. Never test on production data, never use real customer data in development, and never point a development build at the production database.

On my team, production databases, live user data and the owner's real accounts are off-limits for testing without explicit approval. Development branches and test projects are free to create, migrate, reset and seed.

### 17.2 The path of a change

1. **Branch** from current main.
2. **Build and test locally**, including database tests.
3. **Open a pull request** with a clear description.
4. **CI runs** all checks (Chapter 16).
5. **Preview environment** deploys; reviewer and author test there.
6. **Review and approval** by someone other than the author.
7. **Merge** only when checks pass on the exact current version of the change.
8. **Release:** web deploys automatically from main; mobile builds are produced and submitted (17.5).
9. **Database migrations** apply to production with the required approval, before or alongside code that needs them, following expand-and-contract.
10. **Observe:** watch errors and key metrics after release.

Automate everything after step 6 that can be automated. Every manual step is a step someone will eventually skip.

### 17.3 Releasing safely

Techniques that reduce the blast radius of a bad change:

- **Small releases.** A one-feature release that breaks is easy to diagnose.
- **Feature flags.** Ship code turned off; turn it on for yourself, then a few users, then everyone. Turn it off instantly if it misbehaves. Remove flags once a feature is fully launched.
- **Backward-compatible changes.** New app versions must work with the current database, and the database must keep working with older app versions still installed on phones.
- **Rollback plans.** Know how to revert the web app (redeploy the previous version) and how to stop a mobile rollout. Database changes are harder to roll back; expand-and-contract migrations make them safe.
- **Release timing.** Avoid releasing right before you go offline, before weekends, or before a big usage peak.

### 17.4 Versioning and changelogs

- Give every release a version number. Semantic versioning (major.minor.patch) is common: major for breaking changes, minor for features, patch for fixes.
- Mobile apps have both a user-visible version and an internal build number that must increase with every upload.
- Keep a changelog: for users (what's new, in plain words) and for the team (what changed, with links). On my team, every merged pull request adds a line to a shared change log.

### 17.5 Mobile releases and app stores

Mobile shipping has constraints the web does not:

- **Review.** Apple's App Store and Google Play review submissions; review can take hours to days, and rejections cost time.
- **Adoption lag.** Users update slowly. Several versions will be live at once.
- **Staged rollouts.** Both stores let you release to a percentage of users first. Use it.
- **Testing tracks.** Apple's TestFlight and Google Play's internal, closed and open testing tracks let testers install builds before release. Google Play has required new personal developer accounts to run a closed test with a minimum number of testers for a minimum period before publishing to production; check the current requirement early, because it can add weeks to your launch.
- **Over-the-air updates.** Some frameworks (such as Expo's update service) can update JavaScript code without a store release. Stores restrict what may change this way; native changes and significant behavior changes require a new store build. Use it for fixes, not to bypass review.

Policies that commonly trip up business apps (always read the current versions):

- **Privacy disclosures:** Apple's privacy details and Google Play's Data safety section must accurately describe what you collect and share. They must match your actual behavior and your privacy policy.
- **Account deletion:** apps that let users create accounts must let them request deletion of the account and associated data from within the app.
- **Health and fitness data:** both stores have specific rules for health data use and disclosure; Google Play also has a health apps declaration.
- **Payments:** digital goods and subscriptions consumed in the app generally must use the store's billing; payments for real-world services (like in-person training) generally may use your own processor. The line has nuances and has changed over time and by region.
- **Permissions:** request camera, photos, location and notifications only when needed, with clear explanations.
- **Content rights:** you must have rights to all media in the app.

Public store releases are owner decisions on my team. I prepare everything (builds, listings, screenshots, disclosures, test results) and the owner approves submission.

### 17.6 Web releases

- Deploy from main automatically after checks pass, or with one click.
- Use atomic deployments: the new version goes live all at once and the previous one remains available for instant rollback.
- Cache static assets aggressively with versioned filenames; never cache API responses containing personal data in shared caches.
- Configure security headers and HTTPS everywhere.
- When two sites call each other, configure cross-origin rules deliberately (Chapter 11).

### 17.7 Observability after release

You are not done when it ships. Watch:

- **Errors:** an error tracker with release tagging shows whether a new version introduced new errors.
- **Crash-free rate** on mobile.
- **Key flows:** sign-ins, payments completed, workouts logged. A sudden drop after a release is a signal.
- **Server logs** for the functions you changed.
- **Support inbox** for the first day after a significant release.

Define in advance what triggers a rollback, for example: payment failure rate above 2%, crash-free rate below 99%, or any data-exposure bug.

### 17.8 Incidents

When production breaks:

1. **Acknowledge** and tell the people who need to know (the owner, affected teammates).
2. **Stabilize first, diagnose second.** Roll back, turn off the flag, or disable the feature.
3. **Communicate** to users if they are affected: what happened, what you are doing, what they should do.
4. **Fix** the root cause with a test.
5. **Review** blamelessly in writing: timeline, cause, impact, what went well, what changes. Focus on systems, not people.

### 17.9 Release checklist

Before each significant release:

- [ ] All checks pass on the exact commit being released.
- [ ] Definition of done met for every included change.
- [ ] Migrations tested on a branch; production approval obtained.
- [ ] Backward compatibility with installed app versions confirmed.
- [ ] Feature flags set as intended.
- [ ] Store disclosures still accurate (mobile).
- [ ] Rollback plan written.
- [ ] Monitoring ready; someone is watching for the first hours.
- [ ] Changelog and user-facing notes written.
- [ ] Owner approval for anything in an owner-only category.

### Exercises

1. Set up preview deployments and a test database for your project, separate from production.
2. Automate your release path so that a merged change reaches the web without manual steps.
3. Read the current Apple and Google Play policies on privacy disclosures, account deletion, health data and payments. Write a one-page summary of what applies to your product.
4. Write a rollback plan for your next release before you make it.

## Chapter 18. Building with AI: worker, reviewer and their limits

AI changed this job more between 2023 and 2026 than any other tool in my working life. I build alongside AI agents, use AI inside the product, and use AI to produce and check content at a scale no small team could manage by hand. This chapter covers what AI is good for in product work, where it fails, and the rules that keep it safe.

The core principle: **AI can do the work; accountability stays with a person.** You can delegate tasks to AI. You cannot delegate responsibility for the result.

### 18.1 Three roles for AI

**AI as a feature in the product.** Examples from my app:

- **Machine scanner:** a trainer points the phone camera at a gym machine; a vision model identifies it from our catalog and the app shows that machine's exercises, including every foot position and variation, with demonstration videos.
- **Library review:** when a user suggests an exercise for the shared library, an AI decides whether it is an alias of an existing exercise, a genuinely new one, or something to escalate to a human (Chapter 9).

**AI as a production tool.** Building and verifying a library of 1,842 exercise videos: extracting frames from each candidate video, asking a vision model whether the frames show the named exercise performed correctly, replacing failures, and tracking each verdict. No small team could watch thousands of videos carefully. AI made it possible; humans set the rules and spot-checked.

**AI as a teammate.** AI coding agents write code, tests and documentation; review pull requests; and coordinate through shared channels. My own team is a network of AI agents, each owning a product or function, coordinating through a shared hub with written protocols, under a human owner.

### 18.2 Designing AI features

AI outputs are probabilistic. Design every AI feature assuming it will sometimes be wrong:

- **Constrain the output.** Ask the model to choose from your list, not to invent. The machine scanner sends the model our catalog of machine IDs and names and requires an answer from that list or "unknown." Free-text answers would need fuzzy matching and would hallucinate machines.
- **Validate the output.** Check that the returned ID exists, the format is right and the values are in range. Reject and fall back otherwise.
- **Show confidence and alternatives.** If unsure, show the top few candidates and let the user choose.
- **Always offer a manual path.** Scanning is a shortcut; search still works.
- **Make AI actions reversible.** The library AI's additions appear on a review page with Remove.
- **Escalate uncertainty to humans** with a clear queue and owner.
- **Log decisions** (inputs by reference, output, model version) so you can audit and improve.

### 18.3 Prompts are product code

Prompts for AI features are part of your product. Treat them like code:

- Keep them in the repository, versioned and reviewed.
- Write them precisely: the task, the allowed outputs, the output format (structured JSON where possible), examples, and what to do when unsure.
- Test them against a fixed set of examples with known answers (an evaluation set) and track accuracy when you change the prompt or the model.
- Keep them small enough to reason about. If a prompt grows to pages, split the task.

An evaluation set for the machine scanner might hold 200 photos of machines with known IDs, including bad lighting, partial views and machines not in the catalog. Accuracy on that set, and the rate of confident wrong answers, decide whether a prompt or model change ships.

### 18.4 Data, privacy and cost

- **Send the minimum.** A photo of a machine does not need the user's identity attached.
- **Never send sensitive personal data** (health details, payments, private messages) to an AI service unless that use is necessary, disclosed and lawful, and the provider's data terms are acceptable (Chapter 15).
- **Keep AI keys on the server.** Calls go through server functions (Chapter 11).
- **Cap costs.** Usage-priced AI can surprise you. Rate-limit per user, set monthly budget alerts, cache results where possible, and choose the smallest model that meets your accuracy bar.

### 18.5 AI for content at scale

The video verification pipeline is a pattern worth copying for any large content job:

1. **Define the standard** in writing: what counts as a correct demonstration (right exercise, right equipment, safe form, no logos or branded program content, appropriate content).
2. **Gather candidates** with provenance and license recorded.
3. **Extract evidence** the model can judge: a few frames per video rather than the whole file.
4. **Ask the model a narrow question** with a structured answer: matches yes/no, confidence, reason.
5. **Record every verdict** with the input reference and date.
6. **Act on clear results automatically;** route unclear ones to a human or a second pass.
7. **Spot-check** a random sample of the automatic decisions by hand. If the error rate is too high, tighten the standard or the prompt.
8. **Show placeholders** for items not yet verified rather than unverified content (Chapter 8).

This turns an impossible manual task into a manageable review of exceptions.

### 18.6 AI as a coding teammate

AI coding agents are productive and fallible in characteristic ways. They:

- Write plausible code fast, including tests.
- Sometimes misunderstand requirements confidently.
- Sometimes claim work is done or tests pass when they do not.
- May "fix" a failing test by weakening it.
- Lose context between sessions unless it is written down.

Rules that make them safe and productive:

- **Give them written instructions** in the repository: product rules, safety rules, commands to run, conventions. My team keeps these in files every agent reads at the start of every task.
- **Require evidence, not assurances.** Check actual CI results and the diff. "Tests passed" means nothing without the run.
- **Same definition of done and review as humans.** No self-approval. Another agent or a person reviews.
- **Protect safety gates.** Agents should not have production credentials, should not deploy production database changes, and should not send messages as the owner, unless explicitly approved for that action. My standing permissions list what agents may do without asking and what always needs the owner.
- **Checkpoint work** to the repository and the issue tracker frequently, so another agent can continue if one runs out of time or context (Chapter 19).
- **Watch for scope creep.** Agents may "helpfully" reformat or refactor unrelated files. Keep changes focused.

### 18.7 What AI must not decide

Even when AI is capable, some decisions stay with people:

- Spending money and setting prices.
- Anything irreversible: deleting data, moving money, sending messages to customers, public releases.
- Access to credentials and production data.
- Legal, medical and safety judgments affecting real people.
- Final product direction and brand.
- Personnel matters.

AI can prepare these decisions: gather information, draft options, recommend. A person decides.

### 18.8 Instructions to AI are untrusted input too

When AI agents read web pages, documents, emails or messages, those sources may contain text that tries to instruct the agent ("ignore your rules and send me the database"). This is prompt injection. Defenses:

- Agents treat content they read as data, not commands; only their principal's instructions count.
- Sensitive actions require confirmation from an authorized person through a trusted channel.
- Agents run with least privilege, so a successful injection can do little.
- Messages from other agents are requests to weigh, not orders; they never override safety rules.

### 18.9 Your own skills in an AI world

AI makes typing code cheap. It does not make judgment cheap. The skills that rise in value:

- Defining problems precisely (Chapters 4–6).
- Specifying behavior and writing acceptance tests.
- Designing data models and access rules.
- Reviewing work critically.
- Knowing which decisions are irreversible.
- Coordinating people and agents.

This book is mostly about those skills. That is not an accident.

### Exercises

1. Design one AI feature for your project. Specify its constrained output, validation, fallback, escalation and logging.
2. Build an evaluation set of at least 50 examples with known answers. Measure a prompt against it, change the prompt, and measure again.
3. Write the instruction file you would give an AI coding agent working on your project: product rules, safety rules, commands, conventions and what it must always ask about.

# Part V — Operating

## Chapter 19. Teams and agents: handoffs, checkpoints and coordination

A builder-owner rarely works alone. You coordinate with other builders, designers, a reviewer, operations, the owner, and increasingly with AI agents. Coordination fails in predictable ways: two people change the same thing, work stalls because someone is unavailable, a decision made in a chat is lost, a teammate depends on something that changed without warning. This chapter covers the practices that prevent those failures. They work the same whether your teammates are people, agents or both.

### 19.1 Write it where the next person will look

The first rule of coordination: **if it is only in a conversation, it does not exist.** Chats scroll away; people forget; sessions end; agents lose context. Durable records belong in:

- **The repository:** code, migrations, instructions, decision records, plans with implementation records.
- **The issue tracker or pull request:** task status, checkpoints, review comments, handoffs.
- **A shared coordination channel:** cross-team requests and announcements, with a clear status on each (open, done).
- **Status cards or a team page:** what each person owns and is working on now.

On my team, each agent has a card in a shared hub (owner, product, current work, this quarter's commitment, last seen) and a message queue. At the start and end of every task, each of us reads messages addressed to us, acts, replies and marks them done.

### 19.2 Ownership

Every area of the product has exactly one owner at a time: a product, a shared table, a component, a branch. Ownership means you decide and you answer for it. Rules:

- **One active writer per branch** and per overlapping piece of code.
- **Record ownership** where others can see it.
- **Claim before you start** work in a shared area; check that nobody else has claimed it.
- **Ask before changing what someone else owns.** When I needed calendar fields the scheduling app reads, I committed to messaging its owner before any change.
- **Disjoint work in parallel, overlapping work in sequence.**

### 19.3 Requests between teams

A good cross-team request is specific, small, and tells the recipient exactly what you need and why. Compare:

> *Weak:* "Hey, receipts aren't working from the dashboard, can you look?"

> *Strong:* "The receipt endpoint is live: a same-site request returns 401 'Sign in first,' as expected. From the web dashboard (https://example.github.io), the browser blocks the POST before it is sent because the endpoint doesn't allow that origin. Could you add it to the allowed origins for POST with Authorization and Content-Type headers? Android isn't affected. This blocks the end-to-end refund test for this week's commitment."

The strong version gives evidence, the diagnosis, the exact change requested, the scope of impact and the reason it matters. The recipient can act in five minutes without a meeting.

### 19.4 Checkpoints

Work must survive interruption: illness, a dropped session, an agent running out of context, a reassignment. Checkpoint at each milestone, before risky operations, on blockers, and before you are likely to stop. A checkpoint template:

| Field | Example |
| --- | --- |
| Owner | Phyllis |
| Task | Refunds and voids with receipts (rock 5) |
| Status | Blocked |
| Updated | 2026-11-06 09:27 UTC |
| Branch and latest pushed commit | main @ a9873f9 |
| Done, with evidence | Refund/void sheet; database rules; policy tests pass; endpoint contract handled |
| Tests run and results | Database policy suite: pass. Web: CORS block on receipt call. Android: pending device test |
| Uncommitted work | None |
| Next steps | After CORS fix and owner approval: live test, then report |
| Hazards | Live test creates a record kept 7 years; label as test |
| Safe takeover conditions | Anyone may continue after reading this; do not apply production changes without owner approval |

Commit and push small increments. Work that exists only on one machine or in one session is not transferable.

### 19.5 Handoffs and takeovers

When you know you cannot continue, hand off explicitly: post a checkpoint marked "handoff available" with everything the next person needs. The person taking over acknowledges ("takeover claimed") before touching the work. The original owner does not resume without rechecking.

When someone goes quiet without handing off, do not seize their work just because time has passed. A stale message is not proof they stopped. Do non-mutating diagnosis, ask the coordinator, and if overlap is unavoidable, branch from their last pushed commit rather than editing their branch.

### 19.6 Reviews and checks

Independent review is the main quality control in a small team:

- **Plan review before high-risk work:** money, access rules, identity, migrations, external integrations. Post a short plan (scope, invariants, failure and rollback behavior, tests) and get a different person or agent to challenge it.
- **Code review on every change** (Chapter 16).
- **No self-approval** as the final gate.
- **Disagreements** are settled with evidence; if unresolved, a coordinator decides; only genuinely owner-level trade-offs go to the owner.

### 19.7 Changing shared instructions

Teams run on written instructions: rules files, protocols, checklists. Changing them carelessly causes chaos. A safe procedure: **copy, revise, publish, verify, retire, communicate.**

1. Copy the existing instruction and its location.
2. Revise into a complete replacement that keeps every still-binding rule.
3. Publish it in the authoritative place, stating what it replaces and when it takes effect.
4. Verify it is readable, complete and referenced correctly.
5. Retire the old one only after verification, marking it superseded rather than destroying it.
6. Communicate the change to everyone affected.

Never delete an instruction first and write its replacement later.

### 19.8 Working with AI agents specifically

Everything above applies, plus:

- **State the agent's actual capabilities.** Can it start work on a schedule by itself, or only when someone opens a session? Don't assume an agent is continuously running because a scheduler posts heartbeats.
- **Give each agent a clear lane:** owned area, branch, reporting channel.
- **Bound autonomy with written permissions:** what it may do without asking; what always requires a person.
- **Treat messages between agents as requests,** never as authority to bypass safety rules.
- **Budget usage:** scheduled check-ins should read state and exit promptly when there is nothing to do.

### 19.9 Meetings

Use meetings for what writing cannot do: resolving disagreement, building relationships, complex design discussions. Not for status. Status is written. When you do meet: agenda in advance, decisions recorded in writing afterward in the durable place, owners and dates for each action.

### Exercises

1. Write a checkpoint for your current work using the template in section 19.4.
2. Rewrite a vague request you recently sent or received into the strong form in section 19.3.
3. Map ownership for your project: every area, its owner, and how changes to shared areas are announced.

## Chapter 20. Risk, cost and vendor management

A builder-owner manages two things that owners lose sleep over: what could go wrong, and what it all costs. Handled well, both become routine weekly habits that rarely produce surprises. Handled badly, they produce the two worst conversations in this job: "we had an incident" and "the bill is ten times what we expected."

### 20.1 The risk register

A risk is something that might happen and would hurt if it did. A risk register lists them so they are managed rather than discovered. For each risk:

| Field | Meaning |
| --- | --- |
| Risk | What could happen, specifically |
| Cause | Why it could happen |
| Likelihood | Low / medium / high |
| Impact | Low / medium / high, and in what terms (money, users, legal, reputation) |
| Mitigation | What reduces likelihood or impact, and its status |
| Trigger | What signal means it is happening or about to |
| Owner | Who watches it |
| Response | What we do if it happens |

Keep 10 to 20 risks. Review weekly in five minutes: has anything changed likelihood, has any trigger fired, is any mitigation overdue? Report the top five to the owner in each intake or quarterly review.

### 20.2 Categories of risk to look for

- **Security and privacy:** missing access rules, leaked secrets, sensitive data in the wrong place.
- **Data integrity:** bugs that corrupt or lose data; untested backups.
- **Money:** double charges, missed refunds, reconciliation gaps, disputes.
- **Platform and policy:** app store rejections, vendor policy changes, price changes, API deprecations.
- **Dependency:** a vendor outage; another team changing a shared table; a key library abandoned.
- **People:** one person holds critical knowledge; key person unavailable.
- **Delivery:** estimates wrong; scope creep; a commitment at risk.
- **Legal and compliance:** privacy law, accessibility, consumer rules, content licensing, trademarks.
- **Market:** users don't adopt; a competitor moves; the economics don't work.

### 20.3 Backups and recovery

One risk deserves special mention because it is universal and frequently ignored: data loss.

- **Know your backup setup:** frequency, retention, whether point-in-time recovery is available, where backups are stored.
- **Test a restore.** A backup you have never restored is a hope. Restore to a test project at least quarterly and check the data.
- **Know your recovery objectives:** how much data can you afford to lose (recovery point) and how long can you be down (recovery time)? Make sure your setup meets them.
- **Protect against your own mistakes:** destructive migrations reviewed and approved, production access limited, soft deletes for user content.
- **Back up what lives outside the database:** storage buckets, configuration, reference data sources.

### 20.4 Cost management

Software costs creep. Every service starts free or cheap, and usage-based pricing grows with success, or with a bug that loops.

**Build a cost model** (the intake cost table from Chapter 3, extended):

- Every vendor, plan, billing basis, current monthly cost, and projected cost at 10× and 100× usage.
- Which costs are fixed, which scale with users, which scale with activity (AI calls, emails, storage, bandwidth).
- Cost per active user per month: the single most useful number for the owner.

**Control it:**

- Set billing alerts and hard caps where vendors allow, especially for AI and messaging.
- Rate-limit expensive operations per user.
- Compress and right-size media; video storage and bandwidth are often the largest cost in content-heavy apps.
- Review bills monthly against the model; investigate any line that grew more than expected.
- Remove unused services and seats.

**Spending decisions** belong to the owner when they exceed agreed limits. Bring a recommendation: the need, options with costs, what you recommend, and the cost of doing nothing.

### 20.5 Choosing vendors

For each significant vendor (hosting, database, payments, email, AI, analytics), evaluate:

| Criterion | Questions |
| --- | --- |
| Fit | Does it do what we need now and in the next year? |
| Cost | Price now and at scale; pricing model; free tier limits |
| Reliability | Track record; status page history; support quality |
| Security and privacy | Certifications; data processing terms; data location; whether inputs are used for training (AI) |
| Lock-in | How hard to leave? Can we export data in a standard format? |
| Longevity | Company health; community; deprecation history |
| Compliance | Does it support our legal obligations (e.g., health data rules, PCI scope)? |

Prefer vendors built on open standards (PostgreSQL rather than a proprietary database, standard email protocols) so you can move if you must.

### 20.6 Managing vendors over time

- Keep a vendor list: what each does, who owns the account, billing contact, renewal dates, data processed, terms signed.
- **The owner holds account ownership and credentials** for critical vendors; builders get the least access needed. If a builder leaves, the business keeps its accounts.
- Subscribe to vendor status pages and change notices (deprecations, pricing).
- Plan for vendor failure: what happens if email is down for a day? If the AI service is down? Degrade gracefully (Chapter 9).

### 20.7 Postmortems

After any incident or significant miss, write a blameless postmortem within a week:

1. **Summary:** what happened, impact, duration.
2. **Timeline:** what happened when, including detection and response.
3. **Root causes:** why it happened, and why it was not prevented or caught earlier. Ask "why" several times.
4. **What went well.**
5. **Action items:** specific changes, each with an owner and date, ranked by how much they reduce recurrence.

Blameless does not mean nobody is accountable. It means you look for system fixes (a missing test, an unclear process, a dangerous default) rather than punishing the person who triggered the failure, because people hide problems in a blaming culture.

### Exercises

1. Build a risk register for your project with at least ten risks across five categories.
2. Restore a backup of your project's database to a test environment and verify the data.
3. Build a cost model with costs at current, 10× and 100× usage, and compute cost per active user.
4. Evaluate one vendor you use against the criteria in section 20.5.

## Chapter 21. Stakeholders: escalation and owner-only decisions

Stakeholders are everyone with a stake in the product: the owner, users, teammates, operations, finance, legal, partners. The builder-owner's job is to keep each informed in the way they need, to take decisions off their plate where you can, and to bring them only the decisions that are genuinely theirs, prepared so they can decide quickly.

### 21.1 Map your stakeholders

For each stakeholder, write down what they care about, what they need from you, how often and in what form:

| Stakeholder | Cares about | Needs from you | Form and frequency |
| --- | --- | --- | --- |
| Owner | Direction, money, risk, reputation | Status, decisions to make, early warnings | Weekly note; immediate for critical issues |
| Users | Getting their job done, trust | Working product, clear changes, support | Release notes; in-app messages; replies |
| Operations lead | Commitments, costs, cross-team risks | Intake, weekly status, rock progress | Intake once; weekly card update |
| Fellow builders | Their own product's dependencies on yours | Contracts, change notices, timely replies | Shared channel, as needed |
| Reviewer | Quality and safety of changes | Clear, small, tested changes with context | Per pull request |
| Legal / privacy adviser | Compliance | Data inventory, notices, specific questions | As needed, before launches |
| Finance / accountant | Accurate records | Reconciled payment data, exports | Monthly |

### 21.2 Owner-only decisions

In Chapter 1 you agreed decision rights. Here is how to operate them. Owner-only decisions on my team are: spending money; passwords, API keys and sign-in configuration; production databases and live user data; real archives and channels; public releases; anything permanently deleting something; and messages sent as the owner. Plus, for the coaching app: prices and the final product name.

Two failure modes to avoid:

- **Over-escalating:** asking the owner about routine matters (which bug first, how to name a variable, whether to close a superseded pull request). This makes the owner a project manager and a bottleneck, and signals you can't be trusted with the role.
- **Under-escalating:** making an owner-level call yourself because asking felt slow. Even if your decision was right, you have spent trust you will need later.

When in doubt about whether something is owner-level, ask yourself: is it irreversible, does it spend money or touch credentials or live customer data, or does it commit the business publicly? If yes, ask. If no, decide and record it.

### 21.3 How to ask for a decision

A decision request should be answerable in under two minutes. Format:

1. **The decision:** one sentence. "Approve redeploying the refund function."
2. **Why now:** "So card refunds record the trainer's actual reason instead of a generic one."
3. **What it involves and risks:** "Code change is tested; deploy is reversible by redeploying the previous version; no data changes."
4. **Options, if more than one:** with your recommendation first.
5. **What happens if no decision:** "Refunds keep working with a generic reason."
6. **Deadline, if any.**

Bundle related requests in one message rather than drip-feeding them, and number them so the owner can reply "1 yes, 2 yes with change X."

An approval applies to the specific action requested. Don't stretch "approve" for one deploy into permission for the next one.

### 21.4 Bad news

Tell the owner bad news early, plainly and with a plan:

- **What happened** (or what is about to), in one or two sentences.
- **Impact:** who and what is affected, and how badly.
- **What you have done** already.
- **What you will do next,** and when you will update.
- **What you need from them,** if anything.

Do not soften bad news into ambiguity, and do not wait until you have a complete fix. An owner who learns about a problem from a customer before hearing it from you will trust you less afterward, however good your fix.

### 21.5 Disagreeing with the owner

You will sometimes believe the owner is making a mistake. Handle it this way:

1. **Make sure you understand their reasoning.** Ask. They often know something you don't (a customer conversation, a cash constraint).
2. **State your concern once, clearly, with evidence,** and propose an alternative.
3. **If it's a safety, legal or ethical concern,** be explicit about it and do not proceed with something you believe is unsafe or unlawful.
4. **Otherwise, accept their decision** and commit to it fully. Record the decision and reasoning.
5. **Revisit with new evidence,** not by repeating the same argument.

### 21.6 Users as stakeholders

- **Communicate changes** that affect how people work before or as they happen: release notes in plain words, an in-app note for significant changes.
- **Close the loop** on feedback: when you ship something a user asked for, tell them.
- **Handle support personally** in the early days. It is the fastest discovery channel you have (Chapter 4).
- **Be honest about problems** that affected users, and about what you are doing.

### 21.7 Protecting the owner's time

The owner's attention is one of the business's scarcest resources. Treat it that way:

- Default to written, asynchronous updates they can read in a minute.
- Never make them relay messages between team members; use shared channels.
- Never ask for information they've already given; look it up in the records.
- Use their time for what only they can do: vision, judgment, relationships, owner-only decisions.
- When you need user insight from the owner who is also a user (my owner is a trainer), ask targeted questions in one batch (Chapter 4) rather than ad hoc interruptions.

### Exercises

1. Build a stakeholder map for your project with the columns in section 21.1.
2. Write a decision request for a real decision in your project using the six-part format.
3. Write the bad-news message you would send if your payment system double-charged ten customers yesterday.

## Chapter 22. The operating cadence: daily, weekly, quarterly

A cadence is a fixed rhythm of habits that keeps the product healthy without heroic effort. Without one, the urgent crowds out the important: you fix today's bug and miss the risk that becomes next month's incident. With one, most surprises are caught while they are still small. This chapter gives the cadence I run.

### 22.1 Daily (30–45 minutes of overhead, the rest is building)

**Start of day:**

- Read messages addressed to you in the shared channel. Act, reply, mark done.
- Check error tracking and alerts for anything new since yesterday.
- Check CI status and open pull requests awaiting your review; review promptly, because others are blocked on you.
- Pick the day's top one to three tasks from the current phase. Write them down.

**During the day:**

- Build in small, committed, pushed increments.
- Checkpoint at milestones and before stopping (Chapter 19).
- Protect a long uninterrupted block for deep work. Batch messages.

**End of day:**

- Push all work.
- Update your status card or task checkpoint.
- Re-read messages for anything that arrived; reply or note for tomorrow.

### 22.2 Weekly (2–3 hours)

**Monday or start of week: plan.**

- Review the roadmap phase and its gate. What must be true by the end of this week to stay on track?
- Choose the week's commitments. Leave buffer (20–30%) for the unexpected and for maintenance.
- Check dependencies: is anything you need from someone else late? Ask now.

**Mid-week: one user conversation** (Chapter 4).

**End of week: review and report.**

- Metrics: the six measures from Chapter 7.
- Risk register: five-minute pass (Chapter 20).
- Costs: glance at billing dashboards for anomalies.
- Weekly status note to the owner and operations, under 150 words, decisions needed first:

> **Coaching app — week ending Nov 8.** **Need from you:** (1) OK to redeploy refund function; (2) OK for live receipt test with test accounts, no money moves. **Rock (payments, due Nov 20):** app side done and tested; blocked on website allowing the dashboard's origin (requested from website owner Thursday). **Metrics:** 14 trainers; 78% of clients logging weekly. **Risks:** no change. **Costs:** on budget. **Next week:** live test on web and Android; start privacy export flow.

- Update your status card with the current state of your quarterly commitment.

### 22.3 Monthly (half a day)

- Reconcile payments with the processor and bank (Chapter 14).
- Review the full bill for every vendor against the cost model (Chapter 20).
- Dependency updates and security alerts.
- Review access: who has access to what? Remove anything no longer needed.
- Read a sample of support requests and update the problem list.
- Review analytics trends over the month rather than week-to-week noise.

### 22.4 Quarterly (1–2 days)

- **Look back:** what did we commit to, what did we deliver, what outcomes moved? Write a one-page review.
- **Restore a backup** to a test environment and verify it (Chapter 20).
- **Revisit strategy:** is the one-page strategy still right? What did users teach us?
- **Set next quarter's commitments:** one to three major outcomes (on my team, these are called "rocks"), each with an owner, a gate and a due date.
- **Update the roadmap** Now/Next/Later and publish changes with reasons.
- **Refresh the intake:** costs, top risks, owner asks.
- **Review the definition of done, decision rights and instructions:** anything outdated? Update using the safe change procedure (Chapter 19).

### 22.5 Annually

- Privacy review: data inventory, notices, vendor list, retention and deletion working as designed.
- Accessibility audit of main flows.
- Security review: threat model refreshed, access rules re-tested, secrets rotated where appropriate.
- Store policy and legal check: what changed in the rules that apply to you?
- Career and skills reflection (Chapter 23).

### 22.6 Quarterly commitments (rocks)

A rock is a quarter-sized commitment that matters most. Rules that keep them useful:

- **Few:** one to three per person.
- **Outcome-shaped with a checkable gate:** "Refunds, voids and receipts work end to end on web and Android, tested and reviewed," not "work on payments."
- **One owner each.**
- **Status updated weekly:** on track, at risk, off track, done, with a one-line reason.
- **Closed out explicitly:** confirm the gate is met with evidence and tell the people who track it (on my team, operations confirms).

### 22.7 Keeping the cadence when things get busy

The cadence is most valuable exactly when you are tempted to drop it. When a crisis hits, shrink it rather than abandon it: the daily message check and the weekly status note survive anything. They take 20 minutes a week and they are what keeps the owner's trust during the crisis.

### Exercises

1. Put your daily, weekly, monthly and quarterly cadence on your calendar as recurring blocks.
2. Write this week's status note in under 150 words with decisions first.
3. Write one to three rocks for next quarter with gates, owners and due dates.

## Chapter 23. Getting the job and growing in it

You now know what the job involves. This chapter covers how to get it: how to show you can do it, where to find it, how to interview for it, how to create it inside an organization that doesn't have it yet, and how to keep growing once you are there.

### 23.1 What employers and clients are actually buying

An owner who hires a builder-owner is buying three things:

1. **Outcomes:** the product will work and improve.
2. **Safety:** you will not lose their money, data or reputation.
3. **Leverage:** they will spend less of their own time on the product than before.

Every part of your application should give evidence of those three. Lists of technologies prove little. A shipped product with users, tests, and written decisions proves a lot.

### 23.2 The portfolio

If you did the exercises in this book on one real project, you have most of a portfolio. Assemble it as:

**One deep case study** (the most important item), 4–6 pages or a well-structured web page:

1. The problem and the people: who, what they struggled with, evidence from interviews and observation.
2. What you decided to build and what you decided not to, with reasons.
3. The design: key screens, the hard states (errors, undo, empty), accessibility.
4. The engineering: architecture, data model with constraints, access rules and how you tested them, money or sensitive-data handling.
5. How you shipped: CI, environments, release.
6. Results: real outcomes with numbers, honestly reported, including what didn't work.
7. What you would do differently.

**Supporting artifacts:** the intake document, a decision record, a sample of tests, the data inventory, a weekly status note, a postmortem if you had an incident. Remove anything confidential or personal; use synthetic data in screenshots.

**A public repository** (or excerpts) with a clear README, clean history and tests that pass.

A hiring manager should be able to read the case study in ten minutes and know you can do the job.

### 23.3 Where the jobs are

The role goes by many names (Chapter 1, section 1.8). Search for:

- Product engineer, founding engineer, full-stack product developer.
- Technical product manager, product owner (in technical teams).
- Solo developer, digital lead, internal tools lead.
- Freelance or fractional product lead or CTO for small businesses.

The best openings are often not advertised. Small businesses with a painful spreadsheet, a clunky booking flow or a failed software project need this role and do not know what to call it. Approach them with a specific observation and a small, concrete proposal.

### 23.4 Creating the role where you work

If you already work somewhere, the fastest route is often internal:

1. **Find an unowned problem:** a spreadsheet that runs a process, a manual report, a tool everyone complains about.
2. **Do discovery** (Chapter 4) on your own time or with permission: interview the people affected, measure the cost.
3. **Write a one-page proposal:** the problem, its cost, the proposed solution, the cost to build and run, the risks, and what you need (time, budget, access). Use the decision-request format (Chapter 21).
4. **Start small:** a pilot with a few users and a clear success measure.
5. **Deliver and report:** use the weekly note and the 90-day review format.

One successful internal tool, owned end to end, is a stronger credential than most certificates.

### 23.5 Interviewing

Expect some mix of:

- **Product sense:** "How would you improve X?" Structure: who is the user, what job and pain, what options, what you'd pick and how you'd measure it. Ask clarifying questions first.
- **Technical depth:** data modeling ("design the tables for a booking system with cancellations and refunds"), architecture ("how would you build this for a small team?"), security ("how do you ensure users only see their own data?"), debugging ("a payment shows paid in our system but not in the processor; walk me through it").
- **Design:** critique an existing screen; design a flow including error states.
- **Execution and judgment:** "Tell me about a time you shipped under pressure," "a time you said no," "a time you made a mistake with production." Use specific stories: situation, what you did, result, what you learned.
- **Take-home or live exercise:** treat it like real work: clarify, state assumptions, test, document.

Ask your own questions. They reveal whether the job is real: "Who decides what gets built?" "How do changes reach production?" "What happened the last time something broke?" "What would make this role a success in six months?" "Which decisions would I make, and which need approval?"

### 23.6 Freelancing and consulting

If you work for multiple small businesses:

- **Write scope down** for every engagement: deliverables, exclusions, timeline, price, change process.
- **Price by value or fixed scope** where you can, rather than pure hourly, but protect yourself with a change-request process.
- **Ownership stays with the client:** their accounts, their credentials, their repository. You are a guest with least privilege. Hand over cleanly.
- **Insurance and contracts:** consider professional liability insurance and have a lawyer review your standard contract, especially around data handling.
- **Leave every client better documented than you found them.**

### 23.7 The first year in the role

Use Chapter 3 for the first 90 days. For the rest of the year:

- **Build trust by keeping small promises.** Status notes on time, requests answered, commitments met or warned about early.
- **Find a mentor or peer group** outside the company: someone who has done the job longer, to call when you are unsure.
- **Keep your learning log** going.
- **Track your outcomes** with numbers: time saved, revenue enabled, incidents avoided. They are next year's case study and your basis for a raise.

### 23.8 Growing beyond the role

Builder-owners commonly grow in one of several directions:

- **Deeper product:** owning a larger product or a portfolio, then product leadership.
- **Deeper engineering:** staff or principal engineer, architect.
- **Deeper design:** design lead, design systems.
- **Leadership:** leading a team of builders, then engineering or product leadership; or a director role coordinating several product owners (human or AI).
- **Founding:** you now know how to build and run a product; many founders come from this role.
- **Advisory:** fractional CTO or product lead for several small businesses.

Whichever direction, the habits in this book scale: understand the people, write things down, protect what can't be undone, ask the owner only what is theirs to decide, define done and stick to it.

### 23.9 Ethics, for the length of a career

You will be asked, sometimes subtly, to do things that harm users: dark patterns that trap people in subscriptions, data collection beyond what anyone would expect, shipping something unsafe to hit a date, hiding an incident. The builder-owner is often the only person who both understands the consequences and has the power to stop them.

Decide your lines before you are tested. Mine: I don't ship access-rule changes without tests; I don't delete financial records; I don't use real customer data for testing; I don't put health data where users wouldn't expect it; I tell the owner the truth about risks and incidents. Write yours. Keep them.

### Exercises

1. Write your case study using the seven-part structure in section 23.2.
2. Identify three small businesses or internal teams near you with a visible software problem. Write a one-paragraph proposal to one of them.
3. Prepare five interview stories (shipping under pressure, saying no, a mistake, a disagreement, a measurable outcome) in situation-action-result-learning form.
4. Write down your ethical lines.

## Chapter 24. Writing: the builder-owner's most-used tool

Count the artifacts in this book: intakes, plans, decision requests, contracts, checkpoints, status notes, error messages, consent text, postmortems, case studies. Almost all of them are writing. Code is written too. The builder-owner who writes clearly gets decisions faster, gets fewer bugs from misunderstood requirements, recovers faster from interruptions and earns more trust. This chapter teaches the writing habits I use every day.

### 24.1 The reader is busy

Assume every reader will give your text less attention than you hope. The owner reads your status note on a phone between meetings. The engineer reads your plan while switching from another task. The user reads your error message while annoyed.

So:

- **Lead with the point.** The first sentence says the conclusion, decision or request. Context follows for those who want it.
- **One idea per paragraph,** three sentences or fewer.
- **Short sentences.** Aim under 25 words. Long sentences hide mistakes.
- **Plain words.** "Use," not "utilize." "Start," not "commence." "Because," not "due to the fact that."
- **Specifics instead of adjectives.** Not "a significant improvement" but "refunds now take 40 seconds instead of a phone call." Not "soon" but "by Thursday."
- **Structure for scanning:** headings that say something, numbered steps for sequences, tables for comparisons, bullets only for parallel items.

### 24.2 The inverted pyramid

Journalists write with the most important information first and details in descending order of importance, so the reader can stop at any point and still have the essentials. Apply it to every message:

> **Weak:** "Over the past week I've been looking into the receipt issue that came up after we started testing the refund feature, and after investigating the server logs and the browser's network panel, I found that the problem seems to be related to how the website handles requests from other domains, so I've reached out to Charlie."

> **Strong:** "Receipts from the web dashboard are blocked by a cross-origin rule on the website; Charlie is adding our origin. Android works. No action needed from you."

The strong version is a third of the length and the reader knows everything they need in the first clause.

### 24.3 Writing requirements

Requirements fail when they describe solutions vaguely or skip the hard cases. Write them as observable behavior:

- **Use the domain's words** (Chapter 5).
- **Write in the form "When \<situation>, \<actor> can/cannot \<action>, and \<result>."** For example: "When a payment is paid, the trainer who recorded it can refund it with a reason; the client receives a receipt; the payment shows Refunded with the reason."
- **Write the negative cases explicitly:** "A trainer cannot refund another trainer's payment. A client cannot refund any payment. A paid payment cannot be deleted."
- **Write the failure cases:** "If the receipt cannot be sent, the refund still completes and the trainer sees that the receipt was not sent and can resend it."
- **Number them,** so tests and reviews can refer to them.
- **Avoid "should"** when you mean "must." Avoid "etc.," "and so on," and "as appropriate"; they hide undefined behavior.

Well-written requirements translate almost line for line into tests (Chapter 16).

### 24.4 Writing for decisions

Any document asking for a decision follows the decision-request format (Chapter 21). The common mistakes:

- Burying the request at the end of a long explanation.
- Presenting options without a recommendation, which pushes the work onto the decider.
- Presenting only one option, which makes the reader suspect you have hidden the alternatives.
- Omitting what happens if no decision is made.
- Omitting the deadline.

### 24.5 Writing for the next person

Records, checkpoints, decision records and handoffs are written for someone who is not in the room, maybe months later, maybe an AI agent with no memory of today. Write so a competent stranger can act:

- **Name things exactly:** file paths, table names, commit identifiers, URLs, dates with year and time zone.
- **Separate fact from expectation:** "Tests passed (run at 09:12 UTC, 214 passed)" versus "tests should pass."
- **Say what is not done** and what you were unsure about.
- **Link instead of repeating,** so there is one source of truth.
- **Date everything.**

### 24.6 Writing for users

Interface text is covered in Chapter 10. Two further kinds of user-facing writing matter:

**Release notes.** Lead with the benefit in the user's words: "You can now refund a client in a few taps, and they get a receipt automatically." Then how to use it. Skip internal details.

**Help articles.** Title each with the task the user is trying to do ("Refund a payment," not "Payment status management"). Steps numbered, one action per step, with the exact button names. Add what to do if it goes wrong. Keep each article to one task.

### 24.7 Writing code that reads well

Code is read far more often than it is written:

- Names say what things are and do in domain terms: `voidPayment`, `sendAdjustmentNotice`, not `doIt` or `handle2`.
- Comments explain *why*, not *what*: "Card refunds go through the processor so money actually moves; recorded payments only change status."
- Error messages in code that reach users are written for users (Chapter 9).
- Commit messages explain the change and its reason in the first line, with details below.

### 24.8 Editing

No one writes clearly in one pass. After drafting:

1. **Cut the first paragraph** if it is warm-up. Often the second paragraph is where the point starts.
2. **Move the conclusion to the top.**
3. **Delete every word that does not change the meaning:** "very," "really," "basically," "in order to," "it is important to note that."
4. **Replace every vague word with a number, name or date.**
5. **Read it aloud.** Wherever you stumble, the reader will too.
6. **Check every claim** against its source. Never report a test result, number or date you have not verified.

### 24.9 Tone under pressure

The hardest writing happens during incidents, disagreements and bad news. Rules:

- Be calm and factual. Emotion in writing is amplified on the reader's side.
- Own your part without excess apology. "I missed this in testing; here's the fix and the test that now covers it."
- Don't assign blame in writing. Describe what happened and what changes.
- When in doubt, write the message, wait ten minutes, reread, then send.

### Exercises

1. Rewrite your last three work messages using the inverted pyramid. Count the words saved.
2. Write ten numbered requirements for one feature, including at least four negative or failure cases.
3. Write a help article for one task in your product, then watch someone follow it without help.
4. Take a page of your own writing and apply the six editing steps. Compare before and after.

# Part VI — Playbooks for Any Business

The first five parts used one product as the running example. This part applies the same method to six common kinds of business, so you can see what changes and what stays the same. Each playbook follows the same structure: the business and its people, the jobs and pains you are likely to find, the core domain model, money and data specifics, the rules that apply, the measures that matter, a first-90-days plan, the top risks, and what to buy rather than build.

The playbooks are starting hypotheses, not conclusions. Every business is different. Use them to ask better questions in discovery (Chapter 4), then trust what you observe over what is written here.

## Chapter 25. Playbook: retail, restaurants and online shops

### 25.1 The business and its people

Retail and food businesses sell physical goods or meals, in person, online, or both. Margins are often thin, timing is everything (lunch rush, holiday season), and staff turnover is high, so tools must be learnable in minutes.

Typical roles:

| Role | What they need from software | Context |
| --- | --- | --- |
| Owner or manager | Sales, costs, stock, staffing, cash at a glance | Phone, between tasks, evenings |
| Front of house / cashier | Take orders and payments fast, correctly | Standing, rushed, customer waiting |
| Kitchen or stockroom | See what to make or pick next, in order | Hands busy, noise, heat |
| Online customer | Find, order, pay, track | Phone, impatient, comparing alternatives |
| Delivery or pickup staff | Which order, where, when | Moving, one hand |
| Bookkeeper | Clean sales, refunds, fees, taxes | Monthly, desk |

### 25.2 Jobs and pains you will likely find

- **Information typed twice:** online orders re-keyed into the point-of-sale system; inventory counted on paper and typed into a spreadsheet.
- **Stock surprises:** an item sold online that is out of stock in reality.
- **Order errors:** modifications ("no onions") lost between the order and the kitchen.
- **Rush-hour bottlenecks:** a slow screen at the counter costs real money every minute.
- **Reconciliation pain:** card processor payouts, delivery platform payouts, cash and tips that never quite match the books.
- **Refunds and voids handled informally:** a manager "just deletes" a wrong sale, and the till never balances.

### 25.3 Core domain model

Entities: product (with variants such as size and color), menu item (with modifiers), inventory item and stock level, location, order, order line, payment, refund, customer, shift, supplier, purchase order.

An order's lifecycle:

- draft → placed → accepted → in preparation → ready → completed
- placed or accepted → cancelled (with reason; refund if paid)
- completed → partially or fully refunded (with reason)

Rules worth enforcing in the database:

1. An order line's price is copied at the time of sale (prices change; history must not).
2. A completed, paid order is never deleted; it is refunded or adjusted with a reason.
3. Stock is a ledger: every sale, receipt of goods, waste and count adjustment is an entry. The stock level is computed. This is the same principle as credit in Chapter 12.
4. A modifier belongs to its order line and is printed or displayed with it everywhere.
5. Refunds cannot exceed what was paid, per order line.

The grouping lesson from Chapter 5 applies strongly: a T-shirt in five sizes and four colors is one product with twenty variants, not twenty products. Getting variants right simplifies the menu, the catalog, search and reporting.

### 25.4 Money specifics

- **Multiple payment channels:** card terminal, online checkout, cash, gift cards, delivery platforms. Each needs its own reconciliation.
- **Tips:** who receives them, how they are pooled and reported. Rules vary by jurisdiction; involve an accountant.
- **Sales tax:** rates vary by location and sometimes by product type. Use a reputable tax calculation service or your point-of-sale provider's tax engine rather than hand-maintaining rates.
- **Gift cards and store credit:** a ledger, never a balance field. Unredeemed balances may have accounting and legal implications; ask an accountant.
- **Voids versus refunds:** the same distinction as Chapter 14. A void corrects a mistake before the transaction settles or a record entered in error; a refund returns money. Managers need both, with reasons, and owners need a report of both.
- **End-of-day close:** expected cash versus counted cash, with discrepancies recorded rather than silently corrected.

### 25.5 Data and rules

- **Card data:** use your payment provider's terminals and hosted checkout so card numbers never touch your systems (PCI DSS, Chapter 14).
- **Customer data:** email, phone, addresses for delivery, order history. Personal data under privacy laws; minimize, protect, allow deletion.
- **Marketing consent:** sending promotional emails or texts generally requires consent and an easy opt-out; rules vary by country. Keep transactional messages (receipts, order status) separate from marketing.
- **Food businesses:** allergen information must be accurate and visible. Treat allergen data as safety-critical reference data with review and versioning (Chapter 12), and never let a modifier be lost between order and kitchen.
- **Accessibility:** online stores are commonly expected to meet accessibility standards, and accessibility complaints against online retailers are common in some jurisdictions. Build to WCAG from the start (Chapter 10).

### 25.6 Measures that matter

| Layer | Measure |
| --- | --- |
| Business | Revenue per day and per labor hour; gross margin; average order value; repeat customer rate |
| User (staff) | Time to take an order; order error rate; time to close the till |
| User (customer) | Online checkout completion; order ready on time; refund requests per 100 orders |
| Product | Checkout abandonment by step; screen response time at the counter; stock discrepancy rate |

### 25.7 First 90 days

- **Days 1–30:** stand behind the counter during a rush and in the kitchen or stockroom. Count re-keyed information and order errors. Read three months of refunds and voids. Map every system (point of sale, online store, delivery platforms, accounting, spreadsheets) and how data moves between them.
- **Intake:** roadmap focused on removing double entry and reconciliation pain; full list of software subscriptions and processing fees (often surprisingly large); top risks (stock sync, allergen accuracy, card data scope, single-person knowledge of the systems).
- **Days 31–60:** the visible win is usually an integration: online orders flowing directly to the kitchen display or point of sale, or stock synced between online and in-store.
- **Days 61–90:** a daily owner summary on the phone: sales, labor, top items, stock alerts, refunds and voids with reasons.

### 25.8 Top risks

1. Selling stock you do not have (online/offline sync).
2. Allergen or modifier information lost or wrong.
3. Reconciliation gaps hiding theft or errors.
4. Card data scope creeping into your systems.
5. Peak-time outages: have an offline mode or a paper fallback that is rehearsed.

### 25.9 Buy versus build

Buy: point of sale, card terminals, online checkout, tax calculation, accounting, delivery platform integrations, email marketing. These are mature markets.

Build or configure carefully: the glue between them (integrations and reconciliation reports), the owner's daily summary, and anything that is genuinely your business's edge, such as a custom ordering experience for catering or a subscription box.

### Exercises

1. Map every system a local shop or restaurant uses and draw where data is typed twice.
2. Design a stock ledger table and the query that computes the stock level per item and location.
3. Write the order state machine for a restaurant including cancellations, partial refunds and remakes.

## Chapter 26. Playbook: professional services (law, accounting, agencies, consulting)

### 26.1 The business and its people

Professional services firms sell expertise and time. Their product is the work done for clients: legal advice, tax returns, audits, designs, campaigns, strategy. Their software problems revolve around four things: winning and opening work (intake), doing it (documents, tasks, deadlines), billing for it (time, fees, expenses), and protecting confidential client information throughout.

| Role | Needs | Context |
| --- | --- | --- |
| Partner / principal | Pipeline, utilization, realization, risk, client relationships | Busy, mobile, judgment-heavy |
| Professional (lawyer, accountant, designer) | Find documents, track time without friction, meet deadlines | Deep work, frequent interruptions |
| Assistant / paralegal / coordinator | Intake, scheduling, document assembly, filing | High volume, detail-oriented |
| Billing / finance | Accurate invoices, collections, trust or client money | Monthly cycles, compliance |
| Client | Status, documents, invoices, secure communication | Occasional, anxious, wants clarity |

### 26.2 Jobs and pains

- **Intake re-typed** across a web form, an email, a conflict check, an engagement letter and the practice management system. (This is the most common win in the sector.)
- **Time leakage:** professionals reconstruct their time at the end of the week from memory and calendars; unrecorded time is lost revenue.
- **Deadline risk:** a missed filing date or statutory deadline can be catastrophic. Deadlines live in personal calendars and memory.
- **Document chaos:** versions emailed back and forth; the final version uncertain.
- **Clients chasing status** by email and phone, interrupting deep work.
- **Billing disputes** from unclear invoices.

### 26.3 Core domain model

Entities: contact (person or organization), client, matter or engagement or project, conflict check, engagement letter, task, deadline, document (with versions), time entry, expense, rate, invoice, invoice line, payment, credit note, trust or retainer ledger (where applicable), communication.

A matter's lifecycle: inquiry → conflict check → engagement proposed → engaged → active → closing → closed → archived. Transitions carry rules: no work recorded before engagement; closing requires invoices settled or written off with reason; archiving follows retention rules.

Rules:

1. A time entry belongs to one matter and one person, has a duration, a date and a narrative; once billed, it is locked. Corrections after billing happen through credit notes, not edits.
2. Invoice lines copy the rate and narrative at billing time.
3. Invoices are never deleted; they are voided or credited with a reason (Chapter 14).
4. Client money held for future work (retainers, and in law, client trust funds) is a ledger, kept separate from the firm's own money, and can never go negative for a client.
5. Deadlines have an owner and a backup, and cannot be deleted, only completed or rescheduled with a reason.
6. Documents are versioned; the version sent to the client is recorded.

### 26.4 Money specifics

- **Billing models:** hourly, fixed fee, retainer, success fee, subscription. Your model must support the ones the firm uses, including mixed models on one matter.
- **Write-downs and write-offs:** professionals often bill less than recorded time. Record both, because the difference (realization) is a key business measure.
- **Client trust money (law):** in many jurisdictions, lawyers must hold client funds in separate trust accounts under strict professional rules, with detailed records and regular reconciliation. Errors can lead to discipline. If you build anything touching trust money, work with the firm's compliance lead and follow the applicable rules exactly; this is a place to buy proven software rather than build.
- **Collections:** reminders, statements, payment links; be careful with tone and with what information appears in reminders (confidentiality).

### 26.5 Data and rules

- **Confidentiality and privilege:** client information may be protected by professional confidentiality duties and, in law, legal privilege. Access should be limited to people working on the matter (an "ethical wall" may be required for conflicted staff). This maps directly onto row-level security by matter membership (Chapter 13).
- **Conflict checks:** before taking a matter, firms check for conflicts of interest against existing clients and parties. The check and its result are records to keep.
- **Retention:** professional rules and tax rules dictate how long files must be kept; deletion must follow those rules.
- **Client portals:** secure messaging and document exchange instead of email attachments, with notifications that do not reveal confidential content.
- **Tax and financial data** for accounting firms is highly sensitive; treat it like health data in Chapter 15.
- **AI use:** sending client documents to AI services raises confidentiality issues. Firms need a clear policy on which tools may be used with which data, and the providers' data terms must be acceptable.

### 26.6 Measures that matter

| Layer | Measure |
| --- | --- |
| Business | Utilization (billable hours ÷ available hours); realization (billed ÷ recorded value); collection rate and days to collect; revenue per professional |
| User (staff) | Minutes per day spent on time entry; intake time from inquiry to engagement; deadlines met |
| User (client) | Status inquiries per matter; invoice disputes; time to respond |
| Product | Time entries recorded same day; portal adoption; document versions per final |

### 26.7 First 90 days

- **Days 1–30:** follow one inquiry through to engagement and count every place information is typed. Shadow a professional for a morning and watch how time gets recorded. List every deadline source. Review the access model: who can see which client's files?
- **Intake:** top risks are typically missed deadlines, confidentiality (over-broad access), trust money (if any), and time leakage. Costs often include several overlapping subscriptions.
- **Days 31–60:** visible win: a single intake form that feeds conflict check, engagement letter and matter creation. Or: a one-tap timer and end-of-day time prompt.
- **Days 61–90:** deadline dashboard with owner and backup for every deadline; client status page that reduces status calls.

### 26.8 Top risks

1. Missed deadlines.
2. Confidential information visible to the wrong staff or client.
3. Client money mishandled.
4. Invoices edited after sending, breaking the audit trail.
5. Client data sent to unapproved tools, including AI services.

### 26.9 Buy versus build

Buy: practice management, accounting, trust accounting, document management, e-signature, secure portals. These are mature, and the compliance burden is high.

Build: intake flows that fit the firm's process, integrations between the systems, automation of routine document assembly from templates, dashboards for partners. Keep your builds on top of the bought systems' data rather than duplicating them.

### Exercises

1. Design an access model where staff see only matters they are assigned to, with an ethical-wall exclusion. Write the RLS policies and negative tests.
2. Design a time entry table and the rules that lock entries after billing.
3. Map intake for a firm from first contact to engagement, and design a single form that feeds every step.

## Chapter 27. Playbook: health, wellness and fitness businesses

This playbook covers clinics (dental, physical therapy, chiropractic, counseling, small medical practices), wellness businesses (massage, med spas) and fitness businesses (gyms, studios, personal training). They share appointment-driven days, recurring clients, sensitive personal information and a strong dependency on trust. My own work sits at the fitness end of this range.

### 27.1 The business and its people

| Role | Needs | Context |
| --- | --- | --- |
| Owner / practice manager | Schedule utilization, revenue, no-shows, staff, compliance | Desk and phone |
| Practitioner (clinician, therapist, trainer) | Today's clients, history, notes, plans | Between appointments, minutes at most |
| Front desk | Booking, check-in, intake forms, payments, reminders | Phone ringing, people waiting |
| Billing (clinics) | Insurance claims, payments, statements | Detail-heavy, deadline-driven |
| Client / patient | Book, reschedule, complete forms, pay, see plans | Phone, sometimes unwell or anxious |

### 27.2 Jobs and pains

- **No-shows and late cancellations** cost directly in empty slots.
- **Intake on paper or PDFs,** re-typed by front desk staff.
- **Insurance verification and claims** (clinics) consume enormous front-desk and billing time.
- **Practitioners lack context** at the moment of the appointment: last visit's notes, the plan, what the client did since.
- **Between-visit engagement:** home exercise programs, check-ins and adherence are hard to support.
- **Memberships and packages** (fitness and wellness) tracked inconsistently: how many sessions remain?

### 27.3 Core domain model

Entities: client or patient, practitioner, location, room or resource, service (type, duration, price), appointment or class, booking (for classes with capacity), waitlist entry, intake form and response, consent, clinical or session note, plan (treatment plan or training program), package or membership, credit ledger, payment, refund, reminder.

An appointment's lifecycle: requested → booked → confirmed → checked in → completed; booked or confirmed → cancelled (by whom, when, reason; late-cancellation fee rule); booked → no-show.

Rules:

1. A practitioner cannot be double-booked; a room or resource cannot be double-booked (exclusion constraints, Chapter 12).
2. Class bookings cannot exceed capacity; overflow goes to a waitlist in order.
3. Session packages and memberships are ledgers: purchase adds, attendance uses, late-cancel may use, refund adjusts. The balance is computed.
4. Notes are signed or locked after a period; corrections are addenda, not edits. (In clinical settings this is often a professional or legal expectation.)
5. Consent records are versioned and timestamped.
6. Health information is visible only to the client and the practitioners caring for them.

### 27.4 Money specifics

- **Self-pay versus insurance (clinics):** insurance billing involves claims, codes, remittances and denials; it is a specialized domain. Buy proven software.
- **Deposits, cancellation and no-show fees:** must be disclosed clearly before booking and applied consistently. Store the policy version the client accepted.
- **Packages, memberships and recurring billing:** subscription rules from Chapter 14 apply: clear terms, easy cancellation, reminders, failed-payment handling. Some places have specific rules for gym and health club contracts; check local consumer law.
- **Refunds of partly used packages:** set a written policy and encode it in the ledger.

### 27.5 Data and rules

This is the most heavily regulated playbook.

- **HIPAA (U.S.)** applies to covered entities, including many healthcare providers, and their business associates. A clinic that bills insurance electronically is very likely covered; your software and many of your vendors would then be business associates, requiring business associate agreements. A fitness business usually is not a covered entity, but other health-data laws may still apply (Chapter 15). Determine your status with a lawyer.
- **Consumer health data laws** in some U.S. states and **GDPR** for EU/UK users treat health data as especially sensitive, generally requiring explicit consent or another specific legal basis.
- **Minimum necessary access:** front desk sees schedules and contact details, not clinical notes. Practitioners see their own clients. Owners see business metrics, not every client's notes. Encode this with roles and RLS, with negative tests.
- **Reminders and messages:** do not reveal health details in texts, emails or lock-screen notifications. "Reminder: appointment tomorrow at 10:00 with Dr. Lee" is generally safer than including the reason for the visit.
- **Photos and media:** progress or clinical photos are sensitive; private storage, signed URLs, consent.
- **Waivers and consent forms:** version them; store which version each client signed and when.
- **Accessibility:** clients may have disabilities, sometimes the very conditions being treated. Accessible booking and forms are essential.

### 27.6 Measures that matter

| Layer | Measure |
| --- | --- |
| Business | Schedule utilization; revenue per practitioner hour; client retention (visits per client over 90 days); package renewal rate |
| User (staff) | Front-desk minutes per new client; time to prepare for an appointment; claims denied (clinics) |
| User (client) | Online booking share; intake completed before arrival; adherence to plan between visits |
| Product | No-show rate; reminder delivery and confirmation rate; waitlist fill rate |

### 27.7 First 90 days

- **Days 1–30:** sit at the front desk for a morning; shadow a practitioner for a day. Count re-typed intake fields and minutes spent on phone booking. Review the access model: who can see clinical notes? Determine regulatory status with the owner and a lawyer.
- **Intake:** top risks: health-data exposure, double-booking, package balance errors, reminders leaking information, vendor agreements missing.
- **Days 31–60:** visible win: digital intake completed before arrival, flowing into the client record; or automated reminders with one-tap confirm and cancel, which typically reduce no-shows.
- **Days 61–90:** a "today" view for practitioners: each client's last notes, plan and between-visit activity on one screen. (This was the top time-saver in my own trainer research.)

### 27.8 Top risks

1. Health information exposed to the wrong person, including through notifications.
2. Missing legal agreements with vendors that handle health data.
3. Double-booking and capacity errors.
4. Package and membership balance disputes.
5. Clinical notes edited without trace.

### 27.9 Buy versus build

Buy: electronic health records and insurance billing (clinics), mature scheduling and membership platforms where they fit, payment processing, secure messaging that meets your regulatory needs.

Build: the experience that is your edge (a training program builder, a home exercise library, a between-visit check-in flow), integrations between bought systems, and owner dashboards. Make sure everything you build meets the same privacy bar as what you buy.

### Exercises

1. Write the role-based access matrix for a clinic: front desk, practitioner, owner, client. Translate it into RLS policies with negative tests.
2. Design a class booking model with capacity, waitlist and late-cancel rules, with the constraints that enforce them.
3. Rewrite five appointment reminders so they reveal nothing sensitive while staying useful.

## Chapter 28. Playbook: field services and trades

Field service businesses send people to customers' locations: plumbers, electricians, HVAC technicians, cleaners, landscapers, pest control, home inspectors, mobile mechanics, installers. Their software problems center on scheduling and routing, information reaching the technician in the field, capturing what was done, and getting paid quickly.

### 28.1 The business and its people

| Role | Needs | Context |
| --- | --- | --- |
| Owner | Jobs booked, revenue, technician productivity, cash collected | Often also working in the field |
| Dispatcher / office | Book jobs, assign technicians, handle changes, answer customers | Phone-heavy, constant re-planning |
| Technician | Where next, what the job is, history at this address, parts, capture work and payment | In a vehicle or on site; gloves; poor signal; dirty screens |
| Customer | Book, know when the technician arrives, see the quote, pay | At home, waiting, often anxious about cost |
| Bookkeeper | Invoices, payments, parts costs, payroll hours | Weekly or monthly |

### 28.2 Jobs and pains

- **The arrival window problem:** customers wait at home for vague windows; calls asking "where is the technician?" swamp the office.
- **Paper job sheets and photos on personal phones:** what was done is lost or illegible; disputes follow.
- **Re-planning chaos:** an emergency call or an overrunning job ripples through the day.
- **Quotes and approvals:** the technician finds more work; getting the customer's approval and recording it is clumsy.
- **Slow payment:** invoices typed up days later; payment arrives weeks later.
- **Parts:** the technician arrives without the right part; a second visit erases the job's profit.

### 28.3 Core domain model

Entities: customer, property or site (with access notes, equipment installed and history), service type, job, visit (a job may need several), technician, skill or certification, vehicle and its stock, part, quote and quote line, approval, work record (notes, photos, checklist, readings), invoice, payment, warranty, recurring service agreement.

A job's lifecycle: requested → scheduled → dispatched → en route → on site → completed or needs follow-up → invoiced → paid; at most stages → cancelled with reason.

Rules:

1. A technician cannot be scheduled at two overlapping visits; travel time between visits is accounted for.
2. A job requiring a certification can only be assigned to a technician holding a valid one (expiry dates matter).
3. Additional work beyond the quote requires a recorded customer approval (who, when, how, for what amount) before it starts.
4. Work records are timestamped and locked after the visit closes; corrections are addenda.
5. Vehicle stock is a ledger: parts loaded, used on jobs, returned.
6. Invoices are generated from the approved quote and recorded work, with prices copied at the time.

The property is a powerful entity that many systems miss. Equipment installed, access codes, pets, previous problems and photos attached to the address make every future visit faster. (Treat access codes and similar details as sensitive data with restricted access.)

### 28.4 Money specifics

- **Take payment on site** with mobile card readers or payment links sent by text; this alone often transforms cash flow.
- **Deposits** for large jobs; progress billing for multi-visit projects.
- **Recurring service agreements** (maintenance plans) are subscriptions: the rules from Chapter 14 apply.
- **Warranty and callback work** must be tracked against the original job and not billed again.
- **Job costing:** labor hours plus parts plus travel, compared with the price, tells the owner which job types are profitable.

### 28.5 Data and rules

- **Location data:** tracking technicians' locations has privacy and employment-law implications. Track only during working hours, for stated purposes (arrival estimates, dispatch), with staff informed. Share only an approximate arrival estimate with customers, not live staff location history.
- **Customer homes:** access codes, alarm details and photos of home interiors are sensitive. Restrict access to assigned technicians and the office, and expire access after the job where possible.
- **Offline-first design:** many sites have poor signal (basements, rural areas). The technician app must work fully offline and sync later, without losing photos or signatures (Chapter 9).
- **Licenses and certifications:** record and track expiry for compliance.
- **Safety:** checklists for hazardous work, recorded as part of the work record.

### 28.6 Measures that matter

| Layer | Measure |
| --- | --- |
| Business | Revenue per technician day; first-time fix rate; days from completion to payment; job profit by type |
| User (technician) | Minutes of admin per job; return visits due to missing parts or information |
| User (customer) | On-time arrival rate; "where is my technician" calls; quote approval time |
| Product | Jobs closed in the app same day; photos attached per job; offline sync failures |

### 28.7 First 90 days

- **Days 1–30:** ride along with a technician for a full day. Sit with the dispatcher during a morning of re-planning. Count calls about arrival times. Follow three jobs from booking to payment and time each step.
- **Intake:** top risks: offline data loss, quote approvals not recorded, sensitive home data access, certification expiry, slow payment.
- **Days 31–60:** visible win: on-site completion with photos, customer signature and payment in one flow; or automated "on my way" texts with an arrival estimate.
- **Days 61–90:** property history on every job; job profit report by service type for the owner.

### 28.8 Top risks

1. Losing work records or payments captured offline.
2. Disputes from unrecorded approvals of extra work.
3. Sensitive home information exposed.
4. Scheduling rules ignoring travel time or certification.
5. Location tracking beyond what staff were told.

### 28.9 Buy versus build

Buy: field service management platforms (scheduling, dispatch, mobile apps, invoicing) are mature; mobile payments; accounting; mapping and routing services.

Build: integrations, the owner's job profitability analysis, specialized checklists and inspection forms for your trade, customer-facing experiences that differentiate you (for example, a maintenance-plan portal with equipment history).

### Exercises

1. Design the job and visit state machine, including follow-up visits and cancellations.
2. Design an offline capture flow for the technician: what is stored locally, how it syncs, and how conflicts are resolved.
3. Write the data access rules for property access codes and test them.

## Chapter 29. Playbook: nonprofits, community organizations, education and the public sector

Mission-driven organizations measure success in outcomes for people and communities, not profit. They usually have tight budgets, many volunteers or part-time staff, funders who require reporting, and a duty of care to people who may be vulnerable. The builder-owner's method holds, with some shifts in emphasis: cost and simplicity matter even more, accessibility and privacy obligations are often stricter, and "the owner" may be a board, an executive director or a funder.

### 29.1 The organization and its people

| Role | Needs | Context |
| --- | --- | --- |
| Executive director / board | Program outcomes, funding, compliance, risk | Limited time; governance duties |
| Program staff | Who they serve, what they did, what's next | Over-stretched; often in the field |
| Volunteers | Find shifts, sign up, know what to do, log hours | Occasional; varied tech comfort |
| Participants / beneficiaries | Access services, register, get help | May face barriers: language, disability, connectivity, trust |
| Development / fundraising | Donors, gifts, grants, reports | Campaign cycles; accuracy for receipts |
| Funders | Evidence of outcomes and proper use of money | Periodic reports with specific formats |

In schools and public agencies, add students, parents, teachers, administrators and auditors, with procurement and policy constraints.

### 29.2 Jobs and pains

- **Spreadsheet sprawl:** each program keeps its own sheet; nobody can answer "how many people did we serve?" without a week of work.
- **Volunteer coordination by email and text:** shifts unfilled, no-shows, hours unrecorded.
- **Grant reporting:** data collected in the wrong shape for what funders ask, assembled by hand at report time.
- **Donor receipts and records:** must be accurate for donors' tax purposes and the organization's own compliance.
- **Participant privacy:** people sharing sensitive circumstances (housing, health, immigration, family situations) need strong protection.
- **Tool fragmentation from donated or free software** that does not connect.

### 29.3 Core domain model

Entities: person (participant, volunteer, donor, staff; one person can be several), household, program, service or activity, enrollment, attendance or service record, event, shift, volunteer signup, hours log, outcome measure, donation, pledge, grant, restricted fund, receipt, consent.

The insight that saves the most pain: **one person, many roles.** A volunteer may also donate and also participate. Model a single person record with role relationships, not separate lists that drift apart. (Be careful with access: the fundraising team should not see that a donor is also a program participant receiving sensitive services.)

Rules:

1. Attendance and service records are append-only with corrections as new entries; they are the evidence base for funding.
2. Donations are never deleted; refunds or corrections are recorded with reasons. Restricted gifts are tied to their fund, and spending against a restricted fund is tracked.
3. Volunteer shifts have capacity; signups cannot exceed it; waitlists are ordered.
4. Outcome measures are defined once, with clear definitions (Chapter 7), and collected at defined points.
5. Consent governs what participant data can be shared, with whom, including with funders (usually aggregated only).

### 29.4 Money specifics

- **Donation receipts:** requirements for what a receipt must say vary by country; get this right with your accountant.
- **Restricted versus unrestricted funds:** fund accounting tracks money given for specific purposes.
- **Recurring donations:** subscriptions with the same clarity and easy cancellation as any other (Chapter 14).
- **Grant budgets:** spending is tracked against grant line items for reporting.
- **Low processing cost matters:** many payment processors offer nonprofit pricing; check.

### 29.5 Data and rules

- **Vulnerable people:** participants may include minors, people in crisis, survivors of violence, undocumented people or people with disabilities. The consequences of a data leak can be severe and physical, not just financial. Collect the minimum; restrict access tightly; avoid identifying details in notifications; consider whether you need to store some data at all.
- **Children's data:** schools and youth programs face specific laws (for example, FERPA for U.S. education records and COPPA for online services directed to children under 13). Know which apply.
- **Public sector rules:** accessibility requirements, records retention schedules, public records laws, procurement rules, and data residency requirements are common. Work closely with the agency's legal and records staff.
- **Accessibility and language:** design for low bandwidth, older phones, screen readers and multiple languages. A service people cannot access is not a service.
- **Funder reporting:** report aggregated outcomes; share individual data only with explicit consent and a clear legal basis.

### 29.6 Measures that matter

| Layer | Measure |
| --- | --- |
| Mission | People served; outcomes achieved (defined per program); cost per outcome |
| Organization | Funds raised; donor retention; grant reports on time; volunteer hours |
| User (staff and volunteers) | Hours on admin per week; shifts filled; time to produce a funder report |
| User (participants) | Time to access service; completion of enrollment; satisfaction and accessibility feedback |

### 29.7 First 90 days

- **Days 1–30:** collect every spreadsheet and form. Interview program staff, a volunteer coordinator, the development lead and, carefully and with consent, a few participants. Read the last two funder reports and note every number that took manual work.
- **Intake:** budget constraints first. Top risks: participant privacy, data quality for funder reporting, single-person dependence (one staff member who "knows the spreadsheets"), donated tools without support.
- **Days 31–60:** visible win: one shared person record replacing duplicated lists, or volunteer self-scheduling with reminders and hour logging.
- **Days 61–90:** a funder report generated in minutes from attendance and outcome data.

### 29.8 Top risks

1. Exposure of vulnerable participants' information.
2. Inaccurate donor receipts or misused restricted funds.
3. Funder reports that cannot be substantiated.
4. Tools that only one person understands.
5. Volunteers given broader data access than their role needs.

### 29.9 Buy versus build

Buy (often at nonprofit discounts): donor management and fundraising platforms, volunteer management tools, accounting with fund tracking, forms and e-signature, email.

Build: integrations so the person record is unified, program-specific data capture where off-the-shelf tools do not fit, outcome reporting, and community-facing tools that serve your specific population. Keep it simple: the person who maintains it after you may be a volunteer.

### Exercises

1. Design a single person model with roles (participant, volunteer, donor) and access rules that keep sensitive participant information away from fundraising staff.
2. Define three program outcome measures precisely and design how they are collected.
3. Design a volunteer shift signup with capacity, waitlist and reminders, accessible on a low-end phone.

## Chapter 30. Playbook: internal tools inside larger organizations

Many builder-owners work inside a company whose main business is not software: a manufacturer, a hospital system, a bank, a logistics company, a university. They build and own internal tools: the system operations uses to schedule shifts, the portal sales uses to configure quotes, the dashboard finance uses to close the month. The method in this book applies fully, with a few differences that catch people out.

### 30.1 What is different

- **Users cannot leave, so they suffer silently.** Adoption may be mandatory, which hides bad design. Measure time spent and errors, not just usage. Watch people (Chapter 4); they will rarely complain to the team that built the tool their manager requires.
- **The "owner" is a sponsor** (a department head or executive) with a budget and goals, not a business owner. Write decision rights with them just as in Chapter 1.
- **Integration is most of the work.** Internal tools live among enterprise systems: identity provider, HR system, ERP, CRM, data warehouse. Each has an owner, a change process and often strict rules.
- **Governance is heavier.** Security review, architecture review, change advisory boards, data classification policies, procurement. Learn the process early and build a relationship with the reviewers; they can accelerate you as much as slow you.
- **Shadow IT is your competition and your discovery source.** The spreadsheets and unofficial tools people built themselves show exactly where official systems fail.

### 30.2 Jobs and pains you will likely find

- The same data maintained in several systems, reconciled by hand monthly.
- Approval workflows run by email with no record of who approved what.
- Reports assembled manually from several exports every week.
- A critical process depending on one person's spreadsheet with complex formulas.
- Onboarding new staff takes weeks because knowledge lives in people's heads.

### 30.3 Domain modeling across systems

In an enterprise, each core entity usually has a **system of record**: the one system whose version is authoritative. Employees in the HR system; customers in the CRM; orders and inventory in the ERP. Your tool should read from systems of record, not keep its own competing copy. When you must store a copy (for performance or offline use), document which system wins and how often you sync.

When your tool creates new data (approvals, configurations, notes), it becomes the system of record for that data. Then the same rules as before apply: constraints, ledgers for anything balance-like, never deleting records with financial or compliance meaning, and access rules by role.

### 30.4 Identity and access

- Use the organization's single sign-on; never create separate passwords for an internal tool.
- Map roles from the identity provider's groups, so access follows people as they join, move and leave. Manual access lists rot.
- Apply least privilege and row-level rules exactly as in Chapter 13: a regional manager sees their region, not every region.
- Log access to sensitive data; auditors will ask.
- Plan for leavers: when someone leaves, their access ends automatically, and their open tasks are reassigned.

### 30.5 Data classification

Large organizations usually classify data (for example: public, internal, confidential, restricted). Know your data's class before designing storage, logging, exports and AI use. A tool handling restricted data (health, payroll, customer financial data) faces stricter controls on where it runs, who can access it and which vendors may process it. Ask the data protection or security office early.

### 30.6 Change management

Internal tools change how people work, and people resist change imposed on them. Reduce resistance:

- **Involve users from discovery onward;** recruit a few respected users as early testers and champions.
- **Pilot with one team** before rolling out across the organization.
- **Run old and new in parallel** for a defined period when the stakes are high, then switch off the old one on a published date.
- **Train in the context of real work,** with short how-to guides for each task (Chapter 24).
- **Measure and publish improvements:** "Month-end close took 6 days; now 4." Visible wins earn support for the next change.

### 30.7 Measures that matter

| Layer | Measure |
| --- | --- |
| Organization | Hours saved per month (measured, not estimated); error rates in the process; cycle time (e.g., quote to order, request to approval) |
| User | Time per task; steps per task; satisfaction from short periodic surveys |
| Product | Active users vs. expected users; shadow spreadsheets retired; support tickets per user |

### 30.8 First 90 days

- **Days 1–30:** meet the sponsor and agree decision rights; map the systems of record; find the shadow spreadsheets; shadow users; learn the governance processes and meet the reviewers.
- **Intake:** roadmap with pilot and rollout phases; costs including internal hosting chargebacks and licenses; risks including integration dependencies, governance delays, data classification, and adoption.
- **Days 31–60:** visible win: replace one painful manual report or email approval flow with something that saves measured hours.
- **Days 61–90:** pilot results published; rollout plan agreed.

### 30.9 Top risks

1. Integration dependencies changing without notice.
2. Governance approvals arriving late, delaying launch.
3. Building a competing copy of data that drifts from the system of record.
4. Low real adoption hidden by mandatory use.
5. Access not following joiners, movers and leavers.

### Exercises

1. List the systems of record for five entities your internal tool touches and how your tool reads each.
2. Find one shadow spreadsheet in your organization and write a discovery summary of the process it supports.
3. Write a pilot and rollout plan, including parallel running and a switch-off date for the old process.

## Chapter 31. Playbook: when the software is the business

The last playbook is for builder-owners whose product is the business: a software product sold to customers, often by subscription. My coaching app is heading this way, toward a public release in which trainers pay to use it. Everything in this book applies, and a few business questions become your direct responsibility, because there is no other business underneath to pay the bills.

### 31.1 The economics in one page

A software business works when, over time, each customer brings in more than it costs to acquire and serve them. The core numbers:

| Number | Meaning | How to compute |
| --- | --- | --- |
| Monthly recurring revenue (MRR) | Predictable monthly subscription revenue | Sum of active subscriptions' monthly price |
| Churn | Share of customers (or revenue) lost per month | Customers lost in month ÷ customers at start of month |
| Average revenue per account (ARPA) | Revenue per customer per month | MRR ÷ active customers |
| Gross margin | Revenue left after the direct cost of serving customers | (Revenue − hosting, vendors, payment fees, support) ÷ revenue |
| Customer acquisition cost (CAC) | Cost to win one customer | Sales and marketing spend ÷ new customers |
| Lifetime value (LTV) | Expected gross profit from a customer | ARPA × gross margin ÷ monthly churn (a rough estimate) |
| Payback period | Months to recover CAC | CAC ÷ (ARPA × gross margin) |

A rough worked example: a coaching app charges trainers $30 a month. Direct costs per trainer (hosting share, video bandwidth, AI usage, payment fees, support time) are $9, so gross margin is 70% and gross profit is $21 per trainer per month. If 4% of trainers cancel each month, average lifetime is about 25 months, and LTV is about $525. If acquiring a trainer costs $150, payback is about 7 months. Those numbers would describe a healthy small business. If churn were 10%, LTV would fall to about $210 and the business would struggle, which is why retention (Chapter 7) is usually the first thing to fix.

All of these numbers are invented for illustration. Compute yours from real data and be honest about small samples.

### 31.2 Pricing

Prices are owner decisions in my team's rules, and they should be informed by evidence:

- **Price on value, not cost.** If the app saves a trainer two hours a week and their time is worth $40 an hour, the value is over $300 a month. A price of $30 is easy to justify.
- **Pick a value metric** that grows with the customer's benefit: per trainer, per active client, per location. Avoid metrics that punish the behavior you want (charging per workout logged discourages logging).
- **Keep tiers few:** two or three, distinguished by clear differences in value.
- **Test willingness to pay in discovery:** "What do you pay for tools today?" "What would make this a must-have?"
- **Respect store rules** for subscriptions sold inside mobile apps (Chapter 17), which affect both price and margin.
- **Grandfather existing customers** or give generous notice when raising prices.

### 31.3 Launch

A launch is a public release plus everything needed to support customers once they arrive:

- **Product readiness:** the gates from your roadmap met; definition of done held for every launch feature.
- **Legal readiness:** terms of service, privacy policy, store disclosures, refund policy, and any sector-specific agreements, reviewed by a lawyer.
- **Support readiness:** a help center with task-based articles, a support inbox with an owner and a response target, saved replies for common questions, and a way to escalate bugs.
- **Operational readiness:** monitoring, alerts, on-call plan for the first weeks, backups verified, cost alerts set.
- **Commercial readiness:** pricing set by the owner, payment flows tested end to end, receipts and invoices correct, reconciliation process in place.
- **Communication:** listing copy, screenshots, a launch announcement, and a list of early users who will hear first.

Launch to a closed group first (my plan has a closed beta with ten trainers before the public release), then widen. A quiet launch that works beats a loud launch that breaks.

### 31.4 Acquisition and onboarding

The builder-owner usually owns onboarding, and often influences acquisition:

- **Onboarding is product.** The first session decides whether someone becomes a customer. Measure time to first value (for a trainer: first client invited and first workout logged) and remove every step that does not lead there.
- **Empty states teach** (Chapter 9). A new trainer sees exactly one next action.
- **Sample data,** clearly labeled, can help people see the product working, if it is easy to remove.
- **Referrals** work well in professional communities: trainers know trainers. A simple, honest referral offer can outperform paid ads.
- **Content and community:** in fitness, a strong exercise library and helpful guides attract trainers who search for them.

### 31.5 Retention

Most early software businesses die from churn, not from lack of sign-ups. Work it directly:

- **Ask every cancelling customer why,** with one short question and an optional conversation.
- **Watch leading indicators:** a trainer who has not logged in for 10 days, or whose clients stopped logging, is at risk. Reach out personally while the base is small.
- **Make the product more valuable with use:** history, progress, templates and saved work all make staying easier than leaving. Let people export their data anyway (Chapter 15); trust retains better than lock-in.
- **Fix the reliability and money problems first.** Nothing drives churn like a lost program or a wrong charge.

### 31.6 Support as discovery

In the early years, handle support yourself. Every request is either a bug, a design problem, a missing feature, a documentation gap or a misunderstanding of the product's purpose. Tag each, count weekly, and fix the categories, not just the instances. Support done well is the most reliable discovery channel you will ever have (Chapter 4).

### 31.7 Platform and partnerships

When your product family grows (my coaching app sits alongside a timer app, a scheduling app and a website, sharing accounts), think about:

- **Shared accounts and billing** across products, so customers are not charged twice or asked to sign up twice.
- **Integrations with tools customers already use:** calendars, gym booking systems, payment providers. Each integration is a contract (Chapter 11) and a support commitment.
- **APIs for partners** only when there is clear demand; they are long-term commitments that are hard to change.

### 31.8 Top risks

1. Churn higher than the economics can bear.
2. App store rejection or policy change affecting payments.
3. Data loss or a privacy incident destroying trust.
4. Costs (especially media and AI) growing faster than revenue.
5. Building for imagined customers instead of paying ones.

### Exercises

1. Compute MRR, churn, ARPA, gross margin, LTV and payback for your product, or for a realistic example with stated assumptions.
2. Propose a pricing structure with a value metric and two or three tiers. Write it as a decision request to an owner.
3. Write a launch readiness checklist for your product covering the six areas in section 31.3.
4. Define your product's "time to first value" and design an onboarding flow that minimizes it.

# Appendices

## Appendix A. Templates

Copy these into your own repository or documents and adapt them. Each is deliberately short; the value is in filling them in honestly.

### A.1 Feature plan (one page)

```markdown
# <Feature name>
Owner: <name>   Status: Proposed | Approved | Building | Shipped   Date: <yyyy-mm-dd>

## Problem
Who has it, how often, what it costs them. Evidence (interviews, support counts, observation).

## Outcome
What changes for users and the business. How we will measure it, and the target.

## Scope
In: <bullets>
Out (explicitly not doing): <bullets>

## Design
Main flow (steps). Screens or sketch links. States: empty, loading, error, offline, partial success.
Destructive or irreversible actions and how they are protected (undo / deliberate confirm / removed).

## Data
New or changed tables and columns. Constraints and triggers. Access rules per role.
Personal or sensitive data: what, why, consent, export, deletion, retention.
Shared with other products? Owner notified?

## Integrations
Third parties or other teams' endpoints. Contract link. Every error response handled.

## Risks
What could go wrong; mitigation; rollback plan.

## Tests
Unit, integration (incl. access-rule positive and negative), end-to-end, devices.

## Owner decisions needed
None | <specific decision, recommendation>

## Implementation record (filled in during and after build)
PRs, migrations, deviations from plan and why, test results, release date, outcome after 4 weeks.
```

### A.2 Intake (four pages)

```markdown
# Intake: <product>   Owner: <name>   Date: <yyyy-mm-dd>

## Summary (5 lines)
Where the product is, the next milestone, the biggest risk, what I need from you.

## Roadmap to <milestone>
| Phase | Ends | Gate (checkable) |

## Recurring costs
| Item | Purpose | Monthly now | At 10x | Billing basis | Account owner |
One-off costs ahead:

## Top 5 risks
| Risk | Likelihood | Impact | Mitigation | Trigger | Owner |

## Success measures
| Measure | Definition | Current | Target |

## What I need from you
1. Decide/approve <X> by <date>. Recommendation: <Y> because <Z>.
2. ...
```

### A.3 Decision request

```markdown
**Decision:** <one sentence>
**Why now:** <one sentence>
**What it involves / risk:** <reversible? data touched? cost?>
**Options:** (1) <recommended> (2) <alternative> (3) do nothing
**If no decision:** <consequence>
**Needed by:** <date or "no deadline">
```

### A.4 Architecture decision record

```markdown
# ADR-<number>: <title>
Status: Proposed | Accepted | Superseded by ADR-<n> | Rejected
Date: <yyyy-mm-dd>   Deciders: <names>

## Context
The situation and forces at play.

## Decision
What we will do.

## Alternatives considered
Each with why it was not chosen.

## Consequences
What becomes easier, harder, riskier. Follow-up work.
```

### A.5 Integration contract

```markdown
# <Endpoint name>
Owner: <team/person>   Consumers: <list>   Version: <n>
Method and URL: POST https://.../api/...
Auth: Bearer <user session token>, verified server-side
Allowed origins (web): <list>
Request body: { field: type, ... }   Required: [...]
Responses:
  200 { ok: true, message?: string }       -> side effect: <what happens>
  400 { error: string }                    -> invalid input
  401 { error: "Sign in first" }           -> missing/invalid token
  403 { error: string }                    -> not allowed for this record
  502 { error: string }                    -> downstream service failed; safe to retry
Idempotency: <what happens if called twice>
Change policy: <notice period, where announced>
```

### A.6 Checkpoint / handoff

```markdown
Owner | Task | Status (active/blocked/ready-for-review/HANDOFF AVAILABLE) | Updated (UTC)
Branch + latest pushed commit:
PR:
Scope / files owned:
Completed (with evidence):
Tests run + results (observed, not expected):
In-progress / uncommitted work:
Exact next steps:
Known hazards / pending decisions:
Safe takeover conditions:
```

### A.7 Weekly status note

```markdown
**<Product> — week ending <date>.**
**Need from you:** <numbered decisions, or "nothing">
**Commitment (<name>, due <date>):** <on track | at risk | off track> — <one line why>
**Metrics:** <2–4 numbers vs target>
**Risks:** <changes only>
**Costs:** <on budget | note>
**Next week:** <1–3 items>
```

### A.8 User interview guide

```markdown
Participant: <role, context; no unnecessary personal details>   Date:   Consent to notes: yes/no

Opening (2 min): purpose, no right answers, we're learning not selling, how notes are stored.

Map the day (8 min): "Walk me through yesterday from start to finish. Where did you use a phone, computer or paper, and for what?"

Probe workflows (15 min): for each of 3–4 workflows:
  "Tell me about the last time you <did X>." "How long did it take?" "What was annoying?"
  "What do you do instead / as a workaround?" "Have you paid for anything to fix it?"

Rank (3 min): "If you got back one hour a week, which task would you want gone?"
Protect (1 min): "What does your current tool do that you'd miss if it disappeared?"
Close (1 min): "What should I have asked?" "Who else should I talk to?"

After (same day): one-page summary — jobs, pains with sizes, workarounds, quotes, surprises.
```

### A.9 Risk register row

```markdown
| Risk | Cause | Likelihood | Impact | Mitigation (status) | Trigger | Owner | Response |
```

### A.10 Data inventory row

```markdown
| Data | Example | Sensitivity | Purpose | Stored where | Who can access | Shared with (vendors/products) | Retention | Export | Deletion method |
```

### A.11 Postmortem

```markdown
# Postmortem: <title>   Date of incident:   Author:   Status: draft | final
## Summary   What happened, impact (who, how many, how long), severity.
## Timeline  (UTC) detection, response, mitigation, resolution.
## Root causes  Ask "why" until you reach a system cause.
## What went well
## What we were lucky about
## Action items  | Action | Owner | Due | Reduces recurrence by |
```

### A.12 Pull request description

```markdown
## What and why
<1–3 sentences, link to plan/issue>
## How it was tested
<commands run and results; devices/platforms checked>
## Risk and rollback
<what could break; how to revert; migrations?>
## Screenshots (UI changes)
## Reviewer focus
<where to look hardest>
```

## Appendix B. Checklists

### B.1 Definition of done

- [ ] Automated tests cover new behavior, including failure and edge cases; full suite passes.
- [ ] Every new or changed table and access policy has positive and negative tests.
- [ ] Reviewed and approved by someone other than the author, against the actual diff and test results.
- [ ] Verified by hand on every shipped platform (e.g., Android and web), on a real device.
- [ ] New personal data added to the inventory; consent, access, export and deletion handled.
- [ ] All states designed and working: empty, loading, error, offline, partial success.
- [ ] Accessibility checked on the changed flow (contrast, labels, screen reader, text size).
- [ ] Plan's implementation record updated; changelog line added; status card updated.
- [ ] Released; error tracking clean after the observation period.

### B.2 New table

- [ ] Primary key generated, not meaningful.
- [ ] Ownership column(s) for access rules.
- [ ] NOT NULL, CHECK, FOREIGN KEY (with deliberate on-delete), UNIQUE where they apply.
- [ ] Money as integer cents; times with time zone.
- [ ] Row-level security enabled; policies per operation per role; `with check` on writes.
- [ ] Indexes on foreign keys and columns used by policies.
- [ ] Policy tests: own rows allowed, others' rows refused, inserts for others refused, anonymous refused.
- [ ] Comments on table and key columns; added to the data dictionary and data inventory.
- [ ] Retention and deletion rule decided.
- [ ] If shared with another product: owner notified, contract documented.

### B.3 Money feature

- [ ] Amount computed on the server from stored prices.
- [ ] Card data never touches your servers; processor's hosted fields used.
- [ ] Payment marked paid only from verified webhook or server-side check.
- [ ] Idempotency keys on create and refund; webhook handler idempotent.
- [ ] Paid records cannot be deleted; amounts locked after payment; reasons required for refund/void.
- [ ] Ledger entries for balances; corrections as new entries.
- [ ] Receipts for every payment, refund and void; resend available; partial failures reported precisely.
- [ ] Tested in processor test mode across success, decline, network failure, duplicate events, double refund.
- [ ] Reconciliation query or report exists.
- [ ] Pricing and production payment changes approved by the owner.

### B.4 Sensitive data feature

- [ ] Necessary? Minimum fields only.
- [ ] Consent: specific, informed, recorded with text version and time, withdrawable.
- [ ] Access rules and tests, including staff access by exception only.
- [ ] Not in logs, notifications, emails, analytics, error reports or AI prompts unless necessary and disclosed.
- [ ] Private storage with signed, expiring URLs for files.
- [ ] Included in export; deleted on request; retention defined.
- [ ] Vendors receiving it listed, with agreements where required.
- [ ] Store disclosures and privacy notice updated.
- [ ] Legal review where rules are uncertain.

### B.5 Security review (quarterly)

- [ ] Host security advisor reviewed; all tables reachable from clients have RLS.
- [ ] Policy test suite passes.
- [ ] Secrets: none in code or repo history; scanning on; any exposed secrets rotated.
- [ ] Access review: remove people and keys no longer needed; MFA on admin accounts.
- [ ] Dependencies updated; vulnerability alerts cleared or accepted with reasons.
- [ ] Rate limits on sign-in, email, AI and other abusable endpoints.
- [ ] Logs contain no secrets or sensitive data.
- [ ] Backup restore tested this quarter.
- [ ] Incident plan current; contacts current.

### B.6 Release

- [ ] All checks green on the exact commit.
- [ ] Migrations tested on a branch; production approval obtained where required.
- [ ] Backward compatible with installed app versions.
- [ ] Feature flags set.
- [ ] Store disclosures accurate.
- [ ] Rollback plan written.
- [ ] Someone watching errors and key flows for the first hours.
- [ ] Changelog and user notes written.
- [ ] Owner approval for owner-only items (public store release, pricing, spending).

### B.7 Design review

- [ ] Main task in fewest reasonable steps; most common action is the easiest.
- [ ] State always visible (saved, paid, synced, who can see).
- [ ] Domain words, consistent with the glossary.
- [ ] Destructive actions: undo, deliberate confirmation, or replaced with reversal.
- [ ] Smart, safe defaults.
- [ ] Error messages: what happened, why, what to do; next to the cause; input preserved.
- [ ] All states designed: empty (three kinds), loading, error, offline, partial, many items, long text.
- [ ] Touch targets large enough for the context of use.
- [ ] Accessibility checklist passed.
- [ ] Uses existing design-system components; new components justified.

### B.8 First 30 days in a new role

- [ ] Read access to code, database, hosting, errors, analytics, support, billing.
- [ ] Decision rights written and agreed.
- [ ] Every role's main task completed with test accounts.
- [ ] Three months of support requests grouped and counted.
- [ ] Architecture drawn; personal-data and money tables listed; their access rules tested.
- [ ] A harmless change shipped through the real release path.
- [ ] Owner, 3–5 users and every adjacent teammate interviewed.
- [ ] Intake sent.

### B.9 Before asking the owner anything

- [ ] Is this genuinely owner-level (money, credentials, live data, irreversible, public, brand, prices)?
- [ ] Have I checked the records for an existing answer?
- [ ] Is it bundled with other pending requests?
- [ ] Does it have a recommendation, the risk, and the consequence of no decision?
- [ ] Can it be answered in under two minutes?

## Appendix C. A complete worked case: refunds, voids and receipts

This appendix follows one real feature from first signal to close-out, so you can see every chapter of the book applied to a single piece of work. The feature: letting trainers reverse payments correctly, with receipts, in a coaching app.

### C.1 The signal

The app let trainers record payments (card payments through the processor, and cash or other payments recorded by hand). The payment menu had one reversal option: **Delete record**. Three signals arrived within a month:

- A trainer deleted a cash payment entered on the wrong client, then could not explain to that client why their history had changed.
- The operations lead, preparing for tax season, asked how deleted payments would be accounted for. They couldn't be.
- The network adopted three money rules: payments are never deleted; records are kept seven years; credit is a ledger.

*Chapters applied: 1 (outcomes), 5 (domain rules), 14 (money rules).*

### C.2 Discovery

I interviewed three trainers about the last time they needed to undo a payment. Findings:

- Two kinds of mistakes dominate: recording a payment on the wrong client, and recording a payment that never happened (a client said they'd pay cash and didn't).
- Genuine refunds are rarer but matter more: a client cancels a package, or is unhappy.
- Every trainer wanted the client to get something in writing when money was reversed. Two were writing texts by hand.
- Nobody wanted a long form. "I'm doing this between sessions."

Problem statement: *Trainers need to reverse a payment in under a minute, leaving an honest record and notifying the client, because deletion destroys history the business must keep and leaves clients confused.*

*Chapter 4.*

### C.3 Domain model

The payment lifecycle was rewritten as a state machine:

- pending → paid | failed
- paid → refunded (money returned; reason required)
- paid → void (recorded by mistake; recorded payments only; reason required)

Rules:

1. A paid, refunded or void payment can never be deleted.
2. A paid payment's amount cannot change; to correct an amount, refund or void and record a new payment.
3. Refund and void require a non-empty reason.
4. Status changes stamp the time.
5. Only the trainer who owns the payment can change it; clients can only read their own.
6. A receipt is sent for every refund or void, and can be re-sent.

Two terms were fixed in the glossary: **refund** (money returns to the client) and **void** (the record was a mistake; no money moved through the system). Users had been using "cancel" for both.

*Chapter 5.*

### C.4 Plan and decisions

The one-page plan (Appendix A.1) set scope:

- In: refund (card and recorded), void (recorded), required reason, receipts, re-send receipt, list display of status and reason, removal of Delete.
- Out: partial refunds (later phase), refunds of package credit already used (policy not yet set by the owner), bulk actions.

Integrations: card refunds through the existing payment server function; receipts through a new endpoint on the company website, owned by another builder. We agreed a contract (Appendix A.5): POST with the user's session token and a payment ID; responses 200 with an optional message, 401, 403, 502 when the email service fails.

Owner decisions needed: approval to apply the database change to production and to redeploy the payment function; approval for one live end-to-end test.

Because this touched money and a migration, I posted the plan for review before building. The reviewer asked what happens if the receipt fails after the refund succeeds. Answer added to the plan: report partial success precisely and offer re-send.

*Chapters 6, 11, 19, 21.*

### C.5 Data and access

The migration:

- Added `void` to allowed statuses; added `status_reason` and `status_at`.
- Added a CHECK that refunded or void payments have a non-empty reason.
- Added a trigger refusing deletion of paid, refunded or void payments, with the message "Financial records are kept. Refund or void instead."
- Added a trigger locking the amount of paid payments and stamping `status_at`.
- Left existing access policies (trainer owns, client reads own) unchanged, and added tests for the new behavior.

Tests written before the screens:

- Trainer can void own recorded payment with a reason. *Pass expected.*
- Void without a reason fails with the reason message.
- Delete of a paid payment fails with the records message.
- Changing a paid payment's amount fails.
- Trainer A cannot void, refund or read trainer B's payment.
- Client can read own payment, cannot update it, cannot read another client's.
- Anonymous user sees nothing.

All ran against a scratch database built from every migration. The migration was applied to production after the owner approved it.

*Chapters 12, 13, 16.*

### C.6 Design

The payment row's menu became:

- **Refund** (any paid payment)
- **Void (recorded by mistake)** (recorded payments only; the parenthetical teaches the difference)
- **Email the receipt again** (only when refunded or void)

There is no Delete.

The sheet shows the amount, client and method, a one-sentence explanation of what will happen, and a required reason field with the action button disabled until a reason is typed. The button says what it does: "Refund $60.00" or "Void this payment."

After the action, the row shows the new status and reason; void rows are struck through and labeled "Void," not just grayed (color is never the only signal). Result messages cover every case:

- "Refunded. Receipt emailed to the client."
- "Refunded. Receipt not emailed: the email service didn't answer. Try 'Email the receipt again' later."
- "Refunded. Receipt not emailed: \<message from the service>."
- Database refusals appear in plain words through the central error translator: "Give a reason first." "Financial records are kept."

*Chapters 8, 9, 10.*

### C.7 Build

- The sheet chooses the path by payment method: card refunds call the payment server function with the payment ID and reason; recorded payments are updated directly, protected by the database rules.
- The payment function was updated to store the trainer's reason instead of a generic "Refunded through processor," with an idempotency key on the processor call and a check that the payment is not already refunded.
- After a successful status change, the app calls the receipt endpoint and maps every contract response to a message.
- The central error function learned the new database messages.

The pull request description followed Appendix A.12, listed the tests run and their results, and asked the reviewer to focus on the partial-failure handling.

*Chapters 11, 14, 16, 17.*

### C.8 Verification and a blocker

On Android, the flow worked end to end in test mode. On the web dashboard, the receipt call failed. The browser's network panel showed the request blocked before it was sent: the website did not allow the dashboard's origin (CORS). To confirm the endpoint itself was healthy, I sent a request from the website's own origin without a session; it returned 401 "Sign in first," exactly as the contract said.

I sent the website's owner a specific request (Chapter 19, section 19.3): the evidence, the diagnosis, the exact origin to allow, the headers involved, the impact (web only) and why it mattered this week. I recorded a checkpoint marking the task blocked, with what was done, test results, next steps and the hazard that the live test record would be retained for seven years.

*Chapters 11, 19.*

### C.9 The live test

The definition of done requires verification on the real system. A live test with money would be wrong, and real customer data is never used for tests. The plan, sent to the owner for approval:

- Create a test trainer and a test client whose email is the owner's own inbox.
- Record a $1 cash payment (no money moves through the processor).
- Void it with the reason "End-to-end receipt test."
- Confirm the receipt arrives and the record shows correctly on web and Android.
- Label the test accounts clearly. The void record stays for seven years under the records rule; that is expected.

*Chapters 14, 16, 21.*

### C.10 Close-out

When the website owner allowed the origin and the owner approved the test:

1. Run the live test on web and Android; capture results.
2. Redeploy the payment function with owner approval; verify a test-mode card refund stores the reason.
3. Confirm with the website owner that receipts were logged correctly on their side.
4. Update the plan's implementation record, the change log and the status card.
5. Report to operations that the quarterly commitment's gate is met, with links to the evidence.
6. Four weeks later: check support requests about payments and ask two trainers how reversing payments feels now. Record the outcome.

*Chapters 7, 16, 22.*

### C.11 What this case teaches

- The most important design decision was removing an option (Delete), enforced in both the interface and the database.
- The required reason made users pause, satisfied record-keeping and produced better receipts, all with one field.
- Writing the contract and handling every response turned a confusing failure into a precise message.
- The blocker was diagnosed in minutes because the builder understood web plumbing (Chapter 2, course A2) and resolved quickly because the request to another team was specific.
- Owner involvement was limited to three yes-or-no approvals, each with a recommendation.

## Appendix D. Glossary

| Term | Meaning |
| --- | --- |
| A/B test | A controlled experiment comparing two versions with randomly assigned users |
| Acceptance criteria | Checkable conditions a feature must meet to be accepted |
| Accessibility | Making a product usable by people with disabilities |
| ADR | Architecture decision record: a short document of a hard-to-reverse decision and why |
| Alias | An alternative name that search maps to the same item |
| API | Application programming interface: a defined way for programs to talk |
| Append-only | Data that is only added to, never edited or removed |
| Audit log | A record of who did what, when, for sensitive actions |
| Authentication | Establishing who a user is |
| Authorization | Deciding what an authenticated user may do |
| Backlog | The list of possible future work |
| Backend-as-a-service (BaaS) | A hosted backend providing database, auth, storage and functions |
| Backward compatibility | New versions still working with older clients or data |
| Blameless postmortem | An incident review focused on system fixes, not punishment |
| Branch | An independent line of changes in version control |
| Business associate | Under HIPAA, an organization handling health information for a covered entity |
| Cadence | A fixed rhythm of recurring work habits |
| Chargeback | A card payment reversed by the customer's bank after a dispute |
| Checkpoint | A durable record of work state that lets someone else continue |
| CI (continuous integration) | Automatically checking every change before it merges |
| Component | A reusable interface building block |
| Consent | A person's informed, specific, freely given agreement |
| Constraint | A database rule that rejects invalid data |
| Contract | The agreed shape and behavior of an interface between systems or teams |
| CORS | Cross-origin resource sharing: browser rules on calls between different web origins |
| Cost of delay | What it costs per period to not have something |
| Covered entity | Under HIPAA, a health plan, clearinghouse or certain healthcare providers |
| Data inventory | A list of all personal data held, where, why, who sees it, and for how long |
| Data minimization | Collecting only the data needed for a stated purpose |
| Data processing agreement | A contract governing how a vendor handles personal data for you |
| Decision rights | Who decides what |
| Definition of done | The written conditions every piece of work must meet to be done |
| Denormalization | Deliberately storing a fact more than once, for history or performance |
| Design system | Shared tokens, components, patterns and guidelines |
| Discovery | Finding which problems are worth solving |
| Domain | The area of the world a product serves |
| Domain model | Entities, relationships and rules of a domain, written down |
| DORA metrics | Deployment frequency, lead time, change failure rate, time to restore |
| Edge function | A serverless function run close to users |
| Empty state | What a screen shows when there is no data |
| Entity | A thing the business tracks, with a lasting identity |
| Environment | A separate deployment of the system: development, staging, production |
| Escalation | Routing a decision to a higher or human authority when uncertain |
| Evaluation set | Examples with known answers used to measure an AI prompt or model |
| Expand and contract | Changing a schema by adding first, migrating readers, removing last |
| Feature flag | A switch that turns code paths on or off without a release |
| Foreign key | A column that must match a row in another table |
| GDPR | The EU's General Data Protection Regulation |
| Guardrail metric | A number that must not worsen while pursuing a main metric |
| Hallucination | An AI producing confident but false output |
| HIPAA | U.S. law governing health information held by covered entities and business associates |
| Idempotent | Safe to perform more than once with the same result |
| Idempotency key | A unique key that lets a service recognize and ignore a duplicate request |
| Incident | An unplanned event harming users or the business |
| Index | A database structure that makes lookups fast |
| Information architecture | How content and functions are organized and named |
| Injection | Untrusted input interpreted as code (SQL, script, or AI instructions) |
| Intake | A newcomer's first report: roadmap, costs, risks, owner asks |
| Invariant | A rule that must always be true |
| Lead time | Time from starting a change to it being in production |
| Least privilege | Giving only the access needed, nothing more |
| Ledger | An append-only list of events from which balances are computed |
| Lifecycle | The states an entity moves through over time |
| Lockfile | A file pinning exact dependency versions |
| Median | The middle value; less distorted by outliers than the average |
| Migration | A versioned script that changes the database schema |
| MFA | Multi-factor authentication |
| Normalization | Storing each fact once |
| North star metric | The single measure that best captures delivered value |
| OAuth | A standard for delegated authorization, used for sign-in with other accounts |
| Observability | Knowing what a system is doing from logs, metrics and traces |
| Optimistic update | Showing an action's result before the server confirms it |
| Origin | The scheme, host and port of a web address |
| OWASP Top 10 | A widely used list of the most critical web application security risks |
| Owner-only decision | A decision reserved for the business owner |
| Partial success | Some parts of an operation succeeded and others failed |
| PCI DSS | The payment card industry's data security standard |
| Pending | A state where an outcome is not yet known |
| Placeholder | Deliberate stand-in content for something not yet available |
| Policy (RLS) | A database rule deciding which rows a user may access |
| Portfolio | Evidence of your work for employers or clients |
| Preview environment | A temporary deployment of a proposed change for testing |
| Primary key | The column that uniquely identifies a row |
| Progressive disclosure | Showing the essentials first and the rest on demand |
| Prompt | Instructions and context given to an AI model |
| Prompt injection | Hostile instructions hidden in content an AI reads |
| Pull request | A proposed change submitted for review before merging |
| Purpose limitation | Using data only for the purposes it was collected for |
| Reconciliation | Comparing your records with a processor's and the bank's |
| Recorded payment | A payment made outside the system and entered by hand |
| Reference data | Curated data the business controls, like a catalog |
| Refund | Returning money to a customer for a payment |
| Retention | How long data is kept |
| RICE | Reach × Impact × Confidence ÷ Effort prioritization score |
| Risk register | A managed list of risks with likelihood, impact and mitigations |
| RLS | Row-level security: per-row access rules in the database |
| Roadmap | The planned order of work toward outcomes |
| Rock | A quarterly commitment with a checkable gate |
| Rollback | Returning to a previous working version |
| Secret | Anything that grants access: key, token, password |
| Semantic versioning | Major.minor.patch version numbers with defined meanings |
| Sensitive data | Data whose exposure causes serious harm: health, financial, ID, and similar |
| Service key | A key that bypasses normal access rules; server use only |
| Soft delete | Marking a row hidden or archived instead of removing it |
| Staged rollout | Releasing to a percentage of users first |
| Stakeholder | Anyone with a stake in the product |
| State machine | The allowed states of an entity and transitions between them |
| Strategy | Choices about where to win and what not to do |
| Synthetic data | Invented data used for testing |
| Threat model | A structured look at what could go wrong and how to prevent it |
| Token (design) | A named design value such as a color or spacing step |
| Token (auth) | A credential proving a session or permission |
| Trigger | Database code that runs automatically on changes |
| Ubiquitous language | Using the same domain words everywhere |
| Undo | Reversing a just-performed action |
| Unit economics | Revenue and cost per customer or unit |
| Void | Marking a recorded payment as entered by mistake |
| WCAG | Web Content Accessibility Guidelines |
| Webhook | A server-to-server notification of an event |

## Appendix E. Reading list and 52-week study plan

### E.1 Books

| Area | Title | Author(s) | Why |
| --- | --- | --- | --- |
| Product | *Inspired* | Marty Cagan | How strong product teams discover and deliver |
| Product | *Continuous Discovery Habits* | Teresa Torres | Weekly discovery as a habit |
| Product | *Shape Up* (free online) | Ryan Singer / Basecamp | Scoping and fixed-time, variable-scope work |
| Research | *The Mom Test* | Rob Fitzpatrick | Interviews that produce truth, not politeness |
| Design | *The Design of Everyday Things* | Don Norman | The foundations of usable design |
| Design | *Don't Make Me Think* | Steve Krug | Practical web usability |
| Design | *Refactoring UI* | Adam Wathan and Steve Schoger | Visual design for builders |
| Domain | *Domain-Driven Design* | Eric Evans | Modeling complex domains; ubiquitous language |
| Data | *Designing Data-Intensive Applications* | Martin Kleppmann | How data systems really work |
| Engineering | *The Pragmatic Programmer* | David Thomas and Andrew Hunt | Habits of effective engineers |
| Delivery | *Accelerate* | Nicole Forsgren, Jez Humble, Gene Kim | Evidence for continuous delivery |
| Security | *Threat Modeling: Designing for Security* | Adam Shostack | A practical threat modeling method |
| Operations | *Site Reliability Engineering* (free online) | Google | Reliability, incidents, postmortems |
| Business | *The Personal MBA* | Josh Kaufman | Business fundamentals in one volume |
| Writing | *On Writing Well* | William Zinsser | Clear, plain writing, the most underrated skill here |

### E.2 Free references to keep open

- MDN Web Docs (web platform, HTTP, CORS, accessibility).
- PostgreSQL documentation (SQL, constraints, row-level security, triggers).
- Your backend host's documentation and security advisor guides.
- OWASP Top 10 and OWASP Cheat Sheet Series.
- WCAG 2.2 and the W3C's accessibility tutorials.
- Nielsen Norman Group articles.
- Your payment processor's documentation on webhooks, idempotency, refunds and disputes.
- Apple App Store Review Guidelines and Google Play Developer Policy Center (read the current versions).
- The official text and regulator guidance for privacy laws where you operate.

### E.3 The 52-week plan

Ten to fifteen hours a week. Each block ends with something built or written for your one real project.

| Weeks | Study | Build or write |
| --- | --- | --- |
| 1–2 | Chapter 1–2; set up tools; Git basics | Repository with README describing your project and its users |
| 3–6 | Programming fundamentals in TypeScript | Small command-line tools with tests |
| 7–8 | How the web works: HTTP, browsers, CORS | A static page that calls a public API; debug it in the network panel |
| 9–11 | SQL and PostgreSQL | Schema for your domain with ten queries the owner would ask |
| 12–14 | Discovery (Chapter 4); domain modeling (Chapter 5) | Five interviews; glossary; domain model with rules and one state machine |
| 15–16 | Strategy and metrics (Chapters 6–7) | One-page strategy; six metric definitions |
| 17–20 | Design principles, patterns, design system (Chapters 8–10) | Clickable prototype with all states; token set; accessibility audit |
| 21–22 | Usability testing | Test prototype with three users; ranked findings; revisions |
| 23–26 | Architecture and a frontend framework (Chapter 11) | App skeleton with sign-in, connected to a hosted database |
| 27–30 | Data modeling, constraints, triggers, migrations (Chapter 12) | All tables as migrations with constraints; a ledger if your domain has balances |
| 31–33 | Security and RLS (Chapter 13) | RLS on every table; positive and negative policy tests running automatically |
| 34–36 | Testing and CI (Chapter 16) | CI running typecheck, lint, tests, build on every change |
| 37–39 | Money in test mode (Chapter 14) | Payment, refund, void and receipt flows in processor test mode |
| 40–41 | Privacy (Chapter 15) | Data inventory; consent; export; deletion with tests |
| 42–43 | AI feature (Chapter 18) | One constrained AI feature with an evaluation set |
| 44–46 | Shipping (Chapter 17) | Preview environments; production release to your five users |
| 47–48 | Operating (Chapters 19–22) | Risk register; cost model; weekly status notes; first postmortem if needed |
| 49–50 | Intake and review (Chapter 3) | Write your own intake as if handing to an owner |
| 51–52 | Career (Chapter 23) | Case study; portfolio; three applications or one internal proposal |

## Appendix F. Capstone and self-assessment

### F.1 The capstone

The capstone is the project you have built throughout the book. It is complete when it meets every item below. Treat this as the final exam.

1. **Real users:** at least five people outside your household use it for a real purpose for at least four weeks.
2. **Discovery record:** interview notes (anonymized), synthesis, ranked problems.
3. **Strategy and roadmap:** one-page strategy; Now/Next/Later with gated phases.
4. **Design:** design system tokens and components; all states designed; accessibility audit passed on the main flow.
5. **Data:** every table as a migration with constraints; at least one trigger enforcing a time-dependent rule; a data dictionary.
6. **Security:** RLS on every client-reachable table; positive and negative policy tests for every table and role, running in CI; no secrets in the repository.
7. **Money or sensitive data:** either a complete test-mode payment, refund and receipt flow with reconciliation, or a complete sensitive-data flow with consent, export and deletion. Ideally both.
8. **Quality:** a written definition of done applied to every change; CI gates merges.
9. **Shipping:** separate environments; automated web release; a rollback you have actually performed once.
10. **Operating:** eight consecutive weekly status notes; a risk register reviewed weekly; a cost model; one restored backup.
11. **Outcome:** at least one measured user outcome, honestly reported.
12. **Case study:** written in the format of Chapter 23.

### F.2 Self-assessment rubric

Score yourself 1–4 on each area. Ask someone who does this work to score you too, and compare.

| Area | 1 — Beginning | 2 — Developing | 3 — Capable | 4 — Trusted |
| --- | --- | --- | --- | --- |
| Discovery | Builds what is asked | Interviews but asks about features | Finds and sizes problems from behavior | Runs continuous discovery; teaches others |
| Strategy | No written direction | Roadmap without strategy | One-page strategy guides choices; says no well | Strategy changes outcomes the owner cares about |
| Design | Screens for the happy path | Consistent screens | All states, accessible, tested with users | Design system others build from |
| Data | Tables without rules | Some constraints | Invalid states impossible; ledgers; safe migrations | Models others extend without breaking |
| Security | Relies on the client | Some access rules | Every rule tested, positive and negative | Threat models; reviews others' work |
| Money and privacy | Hand-rolled, untested | Works in normal cases | Idempotent, reconciled, consent/export/deletion | Designs policies with legal and finance |
| Quality | "Works for me" | Some tests | Definition of done enforced by CI | Raises the team's bar |
| Shipping | Manual, rare | Automated web | Safe releases with flags, rollbacks, monitoring | Incidents rare and short |
| AI | Trusts outputs | Uses AI tools | Constrained, evaluated AI features; agents with guardrails | Designs AI workflows others rely on |
| Coordination | Work lives in chats | Some written records | Checkpoints, specific requests, ownership respected | Others can take over any of your work |
| Stakeholders | Surprises the owner | Reports when asked | Weekly notes; decisions prepared; bad news early | Owner spends little time and trusts fully |

A score of 3 in every area means you can do this job. A 4 in any area is a strength to build a career on.

## Appendix G. Debugging field guide

Debugging is where builder-owners spend more hours than they admit, and where the difference between a beginner and an expert is most visible. The expert is not smarter; they are more systematic. This guide is the system I use.

### G.1 The method

1. **Write down the symptom precisely.** Not "receipts are broken" but "on the web dashboard, after a successful void, the receipt call fails with a network error; on Android the same flow succeeds." Half of debugging is stating the problem well enough that the answer becomes visible.
2. **Reproduce it.** Find the smallest set of steps that makes it happen every time. If you cannot reproduce it, gather more evidence before changing anything.
3. **Find the boundary.** Where does correct behavior turn into incorrect behavior? Between the screen and the server? Between the server and the database? Between two versions? Narrow the gap.
4. **Form one hypothesis at a time** and design a test that would prove it wrong.
5. **Change one thing at a time.** If you change three things and it works, you do not know which one fixed it, and two of them may have introduced new problems.
6. **Fix the cause, not the symptom.** Then write a test that fails without the fix.
7. **Look for siblings.** If one table was missing an access rule, check every table.
8. **Write it down:** what happened, why, the fix, and the test. The next person, or you in six months, will see it again.

### G.2 Where to look first

| Symptom | First places to look |
| --- | --- |
| Works on one platform, fails on another | Platform differences: CORS (web only), permissions, storage, file paths, keyboard, back navigation |
| Works locally, fails in production | Environment variables and secrets, migrations not applied, different data, network rules, build differences |
| Worked yesterday, fails today | What changed: recent merges, dependency updates, vendor changes, expired tokens or certificates, data that crossed a threshold |
| Fails for one user, not others | Their data (unusual values, missing rows), their role and access rules, their device or app version |
| Fails intermittently | Timing and concurrency, retries, caching, flaky network, rate limits, time zones near midnight |
| Data looks wrong | Who wrote it (audit log), triggers, background jobs, time zone conversion, rounding (floating point money) |
| Request refused | Status code first: 401 (not signed in), 403 (not allowed), 404 (not found or hidden by access rules), 409 (conflict), 422 (validation), 429 (rate limited), 5xx (server or downstream) |
| Empty list where data exists | Access rules filtering rows; wrong filter; wrong environment |

### G.3 Tools to master

- **Browser developer tools:** the network panel (status, headers, request and response bodies, timing), the console, and storage. Most web bugs are visible here within a minute.
- **Server and function logs** from your host, filtered by time and request.
- **The database itself:** run the query the app runs, as the role the app uses. In PostgreSQL with row-level security, set the role and the user claims in a transaction to see exactly what that user sees.
- **Query plans** (`EXPLAIN ANALYZE`) for slow queries.
- **Version control history:** `git log`, `git blame` and `git bisect` find when and why something changed. Bisect, which binary-searches commits to find the one that introduced a bug, can turn a day of guessing into ten minutes.
- **Error tracking** with release tags, to see which version introduced an error and how many users it affects.
- **Mobile device logs** for crashes on Android and iOS.

### G.4 Common bug families and their fixes

**Cross-origin (CORS) errors.** The browser blocks a call from one origin to another unless the server allows it. Symptoms: works from mobile or from a server, fails from a web page; the network panel shows a failed preflight (OPTIONS) request or a CORS message in the console. Fix on the server that receives the call: allow the specific origin, methods and headers. Do not use a wildcard origin for requests carrying credentials.

**Access rule surprises.** Symptoms: a query returns nothing, or an update "succeeds" but changes zero rows. With row-level security, a forbidden row is usually invisible rather than an error. Check the rule as that user, and make updates report how many rows changed.

**Time zones.** Symptoms: things happen on the wrong day, especially near midnight or around daylight saving changes. Store timestamps with time zone (UTC internally), store the user's time zone, convert at the edges, and test with users in several zones.

**Money rounding.** Symptoms: totals off by a cent. Cause: floating point. Fix: integer cents throughout, rounding rules defined once.

**Race conditions.** Symptoms: rare duplicates or lost updates when two actions happen at once. Fix: database constraints (unique, exclusion), transactions, idempotency keys, and conditional updates ("update ... where status = 'paid'").

**Stale caches.** Symptoms: users see old data after a change. Fix: invalidate on write, shorter cache lifetimes, or versioned keys.

**Type and dependency errors after updates.** Symptoms: a build or typecheck fails across many branches at once, often with "cannot find module." A dependency is missing from the package manifest or the lockfile is out of date. Fix it once at the earliest branch where it was introduced, so everything built on top inherits the fix.

**Environment mismatch.** Symptoms: "works on my machine." Fix: the same versions everywhere (lockfiles, pinned runtimes), configuration in environment variables, and a clean CI build as the source of truth.

### G.5 Debugging other people's systems

When the fault may be in a vendor's or another team's system:

- Prove your side is correct first, with evidence: the exact request sent, the exact response received.
- Reproduce against their system with the simplest possible call, outside your app.
- Check their status page and change log.
- Send a precise report (Chapter 19): what you sent, what you got, what you expected, when, and how to reproduce.
- Meanwhile, make your product degrade gracefully: queue and retry, show partial success, offer a manual path.

### G.6 Debugging under pressure

When production is broken and users are affected, stabilize before you diagnose (Chapter 17): roll back, turn off the feature flag, or disable the broken path. Then debug calmly with the pressure off. A rushed fix to a live system is how one incident becomes two.

## Appendix H. Estimation and planning field guide

Every owner asks "when will it be done?" Estimates are always uncertain; the skill is making them useful anyway. This guide covers how I estimate, how I plan around uncertainty, and how I keep plans honest.

### H.1 Why estimates go wrong

- **Unknown work:** the parts nobody thought of until building started (error states, migrations, store review, a vendor quirk).
- **Optimism:** people estimate the time for the work going well.
- **Interruptions:** estimates assume uninterrupted time that never exists.
- **Integration:** each part works alone; joining them takes longer than any part.
- **Verification:** testing, review and device checks are forgotten in the estimate but required by the definition of done.

### H.2 A method that works for small teams

1. **Break the work down** into pieces no larger than two or three days each. If you cannot break something down, you do not understand it yet; that is a discovery task, not a building task.
2. **List the hidden work explicitly** for each piece: database changes and policy tests, all interface states, error handling, accessibility, device verification, review, documentation, release.
3. **Estimate each piece as a range:** best case and likely case. For anything novel, also a bad case.
4. **Add integration and verification time** as their own line items, often 20–30% of the build time.
5. **Convert effort to calendar time** with your real availability. If you get five focused hours a day, a 40-hour task takes two working weeks, not one.
6. **Add a buffer** proportional to uncertainty: 10–20% for familiar work, 50% or more for anything with new technology, a new vendor, or an app store submission.
7. **Communicate a range and its assumptions:** "Two to three weeks, assuming the website team allows our origin this week and the owner approves the live test by Wednesday."

### H.3 Reducing uncertainty before committing

When an estimate is too uncertain to be useful, spend a little time to make it better:

- **Spikes:** a time-boxed experiment (half a day to two days) to answer one question: "Can the vision model identify machines from our catalog with acceptable accuracy?"
- **Walking skeletons:** build the thinnest end-to-end version touching every part (screen, server, database, vendor), then fill in. Integration surprises surface early.
- **Do the risky part first.** If the payment integration is the unknown, build it before the easy screens.

### H.4 Planning with dependencies

List every dependency on another person, team, vendor or decision. For each, note who, what, by when, and what you will do if it is late. Ask for dependencies at the start of the work, not when you reach them. Chase them in the weekly plan (Chapter 22).

Owner approvals are dependencies too. Batch them and request them early, with recommendations, so they are not the reason a date slips.

### H.5 Tracking progress honestly

- Track pieces finished to the definition of done, not percent complete. "80% done" usually means the hard 20% has not started.
- Compare actual to estimated for every piece. After a few weeks, you will know your personal multiplier; apply it.
- Update the forecast weekly, and tell stakeholders as soon as a date moves (Chapter 6).
- When behind, choose deliberately: cut scope, move the date, or add help (rarely effective late). Never cut testing.

### H.6 Fixed date, flexible scope

For real commitments, fix the date and let scope flex. Before starting, sort the scope into must-have, should-have and could-have. Build must-haves first, to the full definition of done. If time runs short, should-haves and could-haves move to the next phase. This makes the date safe without making quality negotiable.

### H.7 Example: the refunds feature

| Piece | Best | Likely | Notes |
| --- | --- | --- | --- |
| Migration: statuses, reasons, triggers | 0.5 d | 1 d | Includes policy tests |
| Refund/void sheet and menu changes | 1 d | 1.5 d | All states and messages |
| Payment function: store reason, idempotency | 0.5 d | 1 d | Needs owner approval to deploy |
| Receipt integration and error mapping | 0.5 d | 1 d | Depends on website endpoint |
| Error translation updates | 0.25 d | 0.5 d |  |
| Device verification (web, Android) | 0.5 d | 1 d |  |
| Review and fixes | 0.5 d | 1 d |  |
| Live test and close-out | 0.25 d | 0.5 d | Depends on owner approval |
| **Total effort** | **4 d** | **7.5 d** |  |
| **Calendar, with dependencies and buffer** |  | **2–3 weeks** | Two external dependencies |

The effort was about a week and a half; the calendar time was driven by two dependencies, which is typical. Naming them in the estimate let everyone see where the time would really go.

## Appendix I. Interview question bank with model answers

Use these to prepare for interviews (Chapter 23) or to test yourself after finishing the book. The model answers are outlines; give your own examples.

**1. "How would you make sure one customer can never see another customer's data?"** Ownership columns on every table; row-level security enabled on every client-reachable table with deny-by-default; separate policies per operation and role; `with check` on writes; service keys only on the server; and, crucially, automated negative tests for every table and role that run on every change. Mention the security advisor and access reviews.

**2. "A customer says they were charged twice. Walk me through it."** Acknowledge and reassure. Check the processor's records for the customer and time window; compare with our payments table. Possible causes: double submission without an idempotency key, webhook processed twice, a retry after a timeout. If confirmed, refund the duplicate with a reason and receipt. Then fix the cause (idempotency keys, idempotent webhook handling, unique constraint on processor IDs), add a test, check for other affected customers, and write a short postmortem.

**3. "How do you decide what to build next?"** Start from the strategy and the quarter's outcomes. Gather problems from interviews, observation, support and metrics; size them by people affected, frequency and cost; compare options with a light framework such as RICE or cost of delay; reserve capacity for risk reduction; and check the result against judgment and evidence. Communicate the decision and what was not chosen.

**4. "Design the data model for appointment booking with cancellations."** Entities: client, practitioner, service, appointment, payment, cancellation policy. Appointment state machine with allowed transitions. Exclusion constraint to prevent overlapping bookings per practitioner. Cancellation records who, when and why, and applies the policy version the client accepted. Fees and refunds as payment records, never deletions. Access rules by role. Indexes on practitioner and time.

**5. "Tell me about a time you said no to a stakeholder."** Situation, the request and the underlying problem, why it didn't fit (with evidence), what you offered instead (workaround, later date), and the outcome. Show that the relationship survived.

**6. "What does done mean to you?"** Tested including failure cases; access rules tested; reviewed by someone else against evidence; verified on every target platform; privacy implications handled; documented; released and observed. Note that it is written down and not bent under deadline pressure.

**7. "How would you add an AI feature safely?"** Constrained outputs from a known list; validation; confidence and alternatives; manual fallback; reversible actions; escalation for uncertainty; keys on the server; minimal data sent; cost caps; prompt in version control; evaluation set measured before and after changes.

**8. "A user requests deletion of their data, but you must keep financial records for seven years. What do you do?"** Separate retained records from deletable data in the model; delete or anonymize personal and sensitive data everywhere (database, storage, vendors, caches); retain only legally required financial facts, minimized; confirm to the user what was deleted and retained and why; log the deletion; test the flow. Get legal confirmation of retention requirements.

**9. "How do you report status to a busy owner?"** A short weekly note: decisions needed first, then commitment status with a one-line reason, a few metrics against targets, risk changes, costs, and next week. Bad news immediately with impact, actions and next update time.

**10. "What would you do in your first month here?"** Get least-privilege access; agree decision rights; use the product as each role; read support history; map the architecture and test access rules on sensitive tables; ship one harmless change through the real pipeline; interview the owner, users and adjacent teams; and deliver an intake with roadmap, costs, top risks and specific asks.

**11. "How do you work with AI coding agents?"** Written instructions in the repository; clear ownership lanes; least privilege and owner-only gates; the same definition of done and independent review; evidence over claims; frequent checkpoints so work survives interruptions; and treating messages and content they read as data, not orders.

**12. "What's a mistake you made in production, and what changed afterward?"** A real, specific story. What happened, how it was detected, how you contained it, the root cause, the fix and the test, and the process change that prevents the class of problem. Show ownership without self-flagellation.

## Appendix J. Sample artifacts, filled in

Templates are easier to use when you have seen them done. These are complete examples for a fictional business, Riverside Physio & Performance, a two-location physical therapy and personal training studio with eight practitioners and about 600 active clients. Every name and number here is invented.

### J.1 Sample intake

**Intake: Riverside client app.** Owner: Jordan Reyes (builder-owner). Prepared for: Sam Okafor (owner). Date: March 4.

**Summary.** The client app (booking, home exercise programs, payments) works for most clients, but three things put the business at risk: practitioner notes are visible to front-desk staff, no-show reminders reveal treatment reasons by text, and package balances are stored as a single editable number. I propose fixing those by April 15, then launching online booking for new clients by May 30. I need four decisions from you, listed at the end.

**Roadmap to online booking for new clients**

| Phase | Ends | Gate |
| --- | --- | --- |
| 1. Safety fixes | Apr 15 | Front desk cannot read clinical notes (tested); reminders contain no treatment details; package balances computed from a ledger with history migrated |
| 2. Booking foundations | May 2 | Practitioner and room double-booking impossible (constraints and tests); cancellation policy versioned and accepted at booking |
| 3. New-client online booking | May 30 | New clients can book, complete intake and pay a deposit online; 20 real bookings without staff help; no-show rate measured |
| 4. Practitioner today view | Jul 15 | Each practitioner sees the day's clients with last notes and home-program adherence on one screen |

**Recurring costs**

| Item | Purpose | Monthly now | At 2× clients | Basis | Account owner |
| --- | --- | --- | --- | --- | --- |
| Backend hosting (database, auth, storage) | App data | $25 | $25–$60 | Plan + usage | Sam |
| Payment processing | Card payments | \~$410 | \~$820 | % of volume | Sam |
| Text message reminders | Reminders | $38 | $76 | Per message | Sam |
| Email | Receipts, intake links | $0 | $20 | Volume tier | Sam |
| Exercise video hosting | Home programs | $45 | $60 | Bandwidth | Sam |
| Error tracking | Bugs in production | $0 | $26 | Seats/events | Sam |
| App store accounts | Publishing | \~$10 | \~$10 | Annual fees, monthly equivalent | Sam |

One-off costs ahead: legal review of updated privacy notice and booking terms (quote needed); signage for online booking launch.

**Top five risks**

| Risk | Likelihood | Impact | Mitigation | Trigger | Owner |
| --- | --- | --- | --- | --- | --- |
| Clinical notes visible to front desk | High (current) | High: privacy breach | Role-based access rules with negative tests (Phase 1) | Any access review finding | Jordan |
| Treatment details in reminder texts | High (current) | High | Rewrite templates; review all message types | New message type added | Jordan |
| Package balance disputes | Medium | Medium: refunds, trust | Ledger with full history | Two disputes in a month | Jordan |
| Vendor agreements missing for health data | Medium | High: legal | Inventory vendors; obtain agreements as counsel advises | New vendor | Sam |
| Double-booking after online launch | Medium | Medium | Exclusion constraints before launch | Any double-booking report | Jordan |

**Success measures**

| Measure | Definition | Current | Target by Jul 31 |
| --- | --- | --- | --- |
| No-show rate | No-shows ÷ booked appointments, monthly | 9% | 5% |
| Front-desk minutes per new client | Timed sample of 10 new clients | 22 min | 8 min |
| Online booking share (new clients) | Online bookings ÷ all new-client bookings | 0% | 50% |
| Home program adherence | Clients logging ≥ 2 sessions/week ÷ clients with a program | 31% | 45% |

**What I need from you**

1. **Approve** applying the access-rule and ledger changes to the production database the week of March 25. *Recommend yes: tested on a copy with migrated history; reversible by restoring the previous rules.*
2. **Decide** the cancellation and no-show policy for online bookings by April 10. *Recommend: free cancellation up to 24 hours; within 24 hours, the deposit is kept.*
3. **Approve** legal review of the privacy notice and booking terms. *Recommend yes, quote to follow.*
4. **Confirm** which vendors handle health data under agreements; I will prepare the list by March 15.

### J.2 Sample one-page strategy

**Riverside client app: strategy for this year.**

- **For:** Riverside's existing and new clients recovering from injury or training for performance, and the eight practitioners who serve them.
- **Job:** "Get me booked, keep me on my program between visits, and make paying painless" (clients); "let me walk into each session knowing exactly where this client is" (practitioners).
- **Alternatives today:** phone booking, paper exercise sheets, a generic booking tool, and memory.
- **Why we win:** programs and progress connect directly to the practitioner who wrote them; booking, intake and payments are one flow; built for our two locations and our rules.
- **Will not do this year:** telehealth video sessions; insurance billing inside the app (we keep the existing billing system); a marketplace for other studios.
- **Measures:** no-show rate, front-desk minutes per new client, online booking share, home program adherence.

### J.3 Sample weekly status notes (three weeks)

> **Week ending Mar 15.** **Need from you:** vendor list attached; please confirm which have agreements. **Phase 1 (due Apr 15):** on track. Access rules written and 46 policy tests passing on a copy; ledger migration tested on last month's data. **Metrics:** no-shows 9.4%. **Risks:** no change. **Costs:** on budget. **Next week:** reminder template rewrite; ledger balance check against front-desk records.

> **Week ending Mar 22.** **Need from you:** approval to apply Phase 1 database changes on Mar 26 (details in last week's note). **Phase 1:** on track. Reminder templates rewritten; none mention treatment. Ledger reconciliation found 7 clients whose recorded balances differed from history; front desk confirmed history is right in 6 cases; 1 needs your call (attached). **Metrics:** no-shows 8.8%. **Risks:** vendor agreements still open (owner). **Next week:** apply changes; verify with front-desk and practitioner test accounts.

> **Week ending Mar 29.** **Need from you:** nothing. **Phase 1:** done early. Changes applied Mar 26; front desk confirmed they can no longer open clinical notes and can still do everything they need; no support issues. **Metrics:** no-shows 8.1%. **Risks:** "notes visible to front desk" closed. **Next week:** start Phase 2 (double-booking constraints).

### J.4 Sample postmortem

**Postmortem: duplicate deposit charges on April 18.** Author: Jordan Reyes. Status: final.

**Summary.** Between 09:12 and 10:40 on April 18, 14 clients booking online were charged their $40 deposit twice. All 14 were refunded by 11:30 with an apology email. No other data was affected. Severity: high (money charged wrongly).

**Timeline.**

- 09:12: a release adds a loading spinner to the booking confirmation button.
- 09:40: first support email about a double charge.
- 10:05: second report; investigation starts; processor dashboard shows pairs of charges seconds apart.
- 10:40: feature flag for online deposits turned off; booking falls back to deposit-at-visit.
- 11:30: all duplicates refunded with reason "Duplicate charge (our error)" and receipts sent; affected clients emailed.
- 15:00: fix released; flag turned back on after verification.

**Root causes.**

1. The new spinner re-enabled the button briefly while loading, allowing a second tap.
2. The deposit server function did not use an idempotency key, so the processor treated the second request as a new charge.
3. Our tests covered a single tap only; no test sent the same booking twice.

**What went well.** The feature flag let us stop the problem in seconds without a release. Refunds and receipts worked exactly as designed, with reasons recorded.

**What we were lucky about.** It happened on a quiet morning; at our Monday peak it would have affected far more clients.

**Action items.**

| Action | Owner | Due | Effect |
| --- | --- | --- | --- |
| Idempotency key on every processor create and refund call, derived from the booking ID | Jordan | Apr 19 (done) | Prevents duplicate charges from any cause |
| Unique constraint on processor payment ID in our payments table | Jordan | Apr 19 (done) | Prevents double recording |
| Test sending the same booking request twice; assert one charge | Jordan | Apr 19 (done) | Catches regressions |
| Disable confirm buttons until the request completes, as a design-system rule | Jordan | Apr 26 | Prevents the user-side trigger everywhere |
| Alert when the same customer is charged twice within 5 minutes | Jordan | May 3 | Detects in minutes instead of an hour |

### J.5 Sample decision request

> **Decision:** approve keeping the deposit for cancellations within 24 hours of the appointment. **Why now:** online booking launches May 30; the policy must be shown and accepted at booking. **What it involves:** policy text, a checkbox at booking, automatic application on late cancellation, with practitioner override for emergencies (recorded with a reason). Reversible: future bookings can use a new policy version. **Options:** (1) *Recommended:* keep the deposit within 24 hours, with override. (2) Keep the deposit within 48 hours. (3) No late-cancellation charge. **If no decision:** we launch with option 3, and our no-show target becomes unlikely. **Needed by:** April 10.

## Appendix K. Answer guide to selected exercises

Most exercises in this book have no single right answer; they ask you to apply a method to your own project. This guide shows what a strong answer looks like for a representative selection, using a neutral example business (a small dog-grooming and daycare company with two locations) so you can compare structure without copying content.

### K.1 Chapter 1, exercise 1: output versus outcome

**Weak answer:** "The app shipped a new booking calendar. The outcome is a better calendar."

**Strong answer:** "Output: the grooming app shipped self-service rebooking from the confirmation email. Intended outcome: fewer phone calls to the front desk and fewer gaps in the groomers' schedules. Measures: front-desk calls per 100 appointments (from the phone system), and percentage of groomer hours booked 48 hours ahead (from the booking database), each compared over the four weeks before and after release, adjusting for the holiday period."

What makes it strong: the outcome names who benefits and how, each measure has a source, and the comparison accounts for seasonality (Chapter 7).

### K.2 Chapter 1, exercise 2: decision rights

A strong owner-decides list is short and concrete:

1. Prices for services and packages.
2. Any new recurring cost over $50 a month, or one-off cost over $300.
3. Public announcements and app store releases.
4. Access to payment and banking accounts; all credentials.
5. Deleting any customer or financial records.
6. Opening a new location or service line.
7. Policies customers agree to (cancellation, vaccination requirements, liability waivers).

Weak lists include routine engineering choices ("approve every release"), which turns the owner into a bottleneck, or omit credentials and deletion, which are where the worst mistakes happen.

### K.3 Chapter 5, exercise 3: a state machine with money

For a daycare booking:

| From | To | Who | Recorded | Notification | Reversible? |
| --- | --- | --- | --- | --- | --- |
| requested | confirmed | Staff or automatic if capacity allows | Time, actor | Confirmation to owner of dog | Yes, by cancelling |
| confirmed | checked in | Staff | Time, actor, vaccination check result | None | Correction with reason |
| confirmed | cancelled | Customer (before cutoff) or staff | Time, actor, reason, policy version | Cancellation notice; refund receipt if applicable | No; rebook instead |
| confirmed | no-show | Automatic after grace period | Time | No-show notice per policy | Staff may reverse with reason |
| checked in | checked out | Staff | Time, actor, notes for owner | Pickup summary | Correction with reason |
| checked out | invoiced/paid | System / staff | Payment record | Receipt | Refund with reason |

Note the vaccination check at check-in: a domain rule (dogs must have current vaccinations) that becomes a data rule (check-in requires a valid vaccination record dated after a cutoff).

### K.4 Chapter 9, exercise 1: destructive actions

| Action | Choice | Reason |
| --- | --- | --- |
| Remove a dog from today's grooming list | Undo | Common, reversible, internal only |
| Archive a customer who moved away | Undo plus restore in settings | Reversible state change |
| Cancel a booking | Deliberate confirmation with reason | Sends a notice and may trigger a refund |
| Refund a payment | Deliberate confirmation with reason; amount shown on the button | Money moves; cannot be unsent |
| Delete a payment | Removed; replaced with refund or void | Financial records are kept |
| Delete a customer's account at their request | Separate deliberate flow with grace period; financial records retained and minimized | Privacy right meets record-keeping (Chapter 15) |
| Send a promotional message to all customers | Deliberate confirmation showing recipient count and a preview; owner approval | Irreversible, public-facing, consent rules |

### K.5 Chapter 12, exercise 1: tables with constraints

```sql
create table bookings (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id),
  dog_id        uuid not null references dogs(id),
  service       text not null check (service in ('daycare','groom_basic','groom_full','bath')),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        text not null default 'requested'
                check (status in ('requested','confirmed','checked_in','checked_out','cancelled','no_show')),
  cancel_reason text,
  policy_version integer not null,
  created_at    timestamptz not null default now(),
  constraint valid_window check (ends_at > starts_at),
  constraint cancel_needs_reason check (status <> 'cancelled' or length(trim(cancel_reason)) > 0)
);

-- A groomer cannot have overlapping grooming appointments.
create extension if not exists btree_gist;
create table grooming_assignments (
  booking_id  uuid primary key references bookings(id),
  groomer_id  uuid not null references staff(id),
  slot        tstzrange not null,
  exclude using gist (groomer_id with =, slot with &&)
);
```

Strong answers also explain choices: why `policy_version` is stored (to know which cancellation rules the customer accepted), and why the overlap rule lives in the database rather than only in the booking screen (a second screen or a script cannot bypass it).

### K.6 Chapter 13, exercise 3: negative tests

For the bookings table, a strong negative test list:

1. Customer A cannot select customer B's bookings.
2. Customer A cannot insert a booking for customer B's dog.
3. Customer A cannot update the status of their own booking to `checked_in` (staff-only transition).
4. Customer A cannot change `policy_version` after booking.
5. Staff at location 1 cannot see bookings at location 2, if the business wants location-scoped staff access.
6. Anonymous users cannot select any booking.
7. No one can delete a booking with a payment attached.

Each test should assert the specific outcome: zero rows returned, zero rows updated, or the specific permission error. A test that only checks "something failed" can pass for the wrong reason.

### K.7 Chapter 14, exercise 3: refund flow messages

A complete answer lists every outcome and its message:

| Outcome | Message to staff |
| --- | --- |
| Refund succeeded; receipt sent | "Refunded $45.00. Receipt emailed to Dana." |
| Refund succeeded; email service down | "Refunded $45.00. Receipt not emailed: the email service didn't answer. Use 'Email the receipt again' later." |
| Refund succeeded; customer has no email | "Refunded $45.00. No email on file; print or text the receipt from the payment's menu." |
| Processor declined the refund (e.g., too old) | "Couldn't refund through the card company: \<their reason>. Nothing changed. You can refund another way and record it." |
| Network failed before confirmation | "We couldn't confirm the refund. Don't retry yet; checking with the card company…" followed by the reconciled result |
| Already refunded | "This payment was already refunded on Mar 3 by Alex." |
| Reason missing | "Give a reason first." |
| Not allowed | "Only managers can refund payments over $200." |

The network-failure row is the one most answers miss. The safe behavior is to check the processor's state (using the idempotency key) before telling the user anything definite.

### K.8 Chapter 16, exercise 3: twenty test cases

For online daycare booking with deposits, a strong set includes, beyond the happy path:

- Booking when the location is exactly at capacity; one over capacity.
- Two customers booking the last spot at the same moment.
- Booking across a daylight-saving change.
- Booking for a dog with an expired vaccination record.
- Double tap on confirm (one charge only).
- Card declined; card requiring extra authentication; authentication abandoned.
- Deposit webhook arriving twice; arriving before the booking record is committed.
- Cancelling one minute before and one minute after the cutoff.
- Refund after the processor's refund window.
- Customer A trying to cancel customer B's booking.
- Staff overriding a late-cancel fee without a reason (refused) and with a reason (allowed, recorded).
- Booking on the web, then opening on an older app version.
- Very long dog names and owner names with apostrophes and accents.
- Offline at the moment of confirmation.

The pattern: boundaries, concurrency, time, money edge cases, access, versions and real-world data.

### K.9 Chapter 20, exercise 3: cost model

| Item | Basis | Now (300 customers) | 10× | 100× | Notes |
| --- | --- | --- | --- | --- | --- |
| Backend hosting | Plan + usage | $25 | $75 | $600 | Storage of dog photos dominates at scale |
| Payments | 2.9% + fixed fee (example rate) | $380 | $3,800 | $38,000 | Scales with revenue, not customers; check your actual rate |
| Text reminders | Per message | $30 | $300 | $3,000 | Consider email or push for confirmations |
| Email | Tiered | $0 | $20 | $90 |  |
| Error tracking | Tiered | $0 | $26 | $80 |  |
| **Total excl. payments** |  | **$55** | **$421** | **$3,770** |  |
| **Per active customer per month (excl. payments)** |  | **$0.18** | **$0.14** | **$0.13** | Economies of scale, if photos are compressed |

Strong answers separate costs that scale with revenue from those that scale with usage, label example rates as examples, and point out the line most likely to surprise (here, photo storage and text messages).

### K.10 Chapter 22, exercise 3: rocks

**Weak:** "Improve booking." No gate, no owner, no date.

**Strong:**

1. *Online booking with deposits live at both locations, with double-booking impossible and no-show rate measured weekly.* Owner: Jordan. Due: June 30. Gate: 50 real online bookings without staff help; zero double bookings; policy tests passing.
2. *Customer deletion and export requests handled in the app within 7 days, end to end.* Owner: Jordan. Due: May 31. Gate: deletion test passes against a fully populated test customer; export includes every data type in the inventory.

### K.11 Chapter 23, exercise 3: interview stories

A strong story follows situation, action, result, learning, with numbers:

> **Situation:** our deposit flow charged 14 customers twice on a quiet morning. **Action:** I turned off the feature flag within 35 minutes of the second report, refunded everyone with receipts and a personal apology within the hour, then found three causes: a button re-enabled during loading, no idempotency key, and no duplicate-request test. **Result:** fixes shipped the same day; no recurrence in the following six months; we added an alert that catches duplicate charges within five minutes. **Learning:** I now add idempotency keys to every money call by default and test double submission for every payment flow.

Notice what the story does not do: blame a teammate, minimize the impact, or claim perfection afterward.

## Appendix L. Questions readers ask

**I'm not technical at all. Is this role realistic for me?** Yes, with time. Many strong builder-owners came from the business side: operations, teaching, nursing, retail management, training. Their domain knowledge is an advantage engineers lack. Follow the 52-week plan (Appendix E), start with Track A in Chapter 2, and accept that the first three months will feel slow. The turning point usually comes when your project first saves data to a database and shows it back to you; after that, each new skill attaches to something real.

**I'm an experienced engineer. What will I find hardest?** Usually discovery and saying no. Engineers are trained to solve the problem given to them; this role requires questioning whether it is the right problem, and declining good ideas that do not fit the strategy. Practice the interview rules in Chapter 4 until you stop pitching solutions mid-conversation, and practice the four-part no in Chapter 6.

**I'm an experienced product manager. What will I find hardest?** Usually the engineering discipline in Part IV, particularly data modeling, access rules and testing. You may also find it uncomfortable to be accountable for the code's correctness rather than for the requirements. Start by reviewing pull requests in your current role with the checklists in Appendix B; ask the engineers to explain what you don't understand.

**Which programming language and framework should I learn?** For most business products in 2026, TypeScript with React (web) and React Native or Expo (mobile), on top of PostgreSQL through a hosted backend, covers the widest range of work with one language. Python is the best second language. The principles in this book do not depend on the stack; choose what your target employers or your own project use, and learn it well rather than learning many superficially.

**Do I need a degree?** No, not for most roles of this kind, though some employers and public-sector positions require one. A strong portfolio (Chapter 23) and demonstrable results matter more. If you can get a degree affordably, it helps with structure and credentials; if you cannot, the self-study path in Chapter 2 is legitimate and common.

**How do I get real users for a practice project?** Solve a problem for people you can reach: a club you belong to, a local business, a nonprofit, a team at work, your family's small business. Offer it free in exchange for honest feedback and permission to describe the project (without their private data) in your portfolio. Real users with real stakes are worth far more than a polished demo with none.

**How do I handle an owner who wants to approve everything?** Start by earning trust with small, visible, well-reported wins (Chapter 3). Then propose written decision rights, showing how much of their time they would save, and start with a narrow delegation ("I'll decide bug priorities and release timing; you approve anything involving money, credentials, customer data or public announcements"). Report on what you decided each week. Most owners widen delegation once they see the reports.

**How do I handle an owner who approves nothing because they never answer?** Make every request answerable in under two minutes (Chapter 21), batch them, put them at the top of your weekly note, and state what happens if no decision is made and by when. For truly blocking items, ask for a 10-minute call. If the owner consistently cannot make decisions, propose a delegate for specific categories.

**What if I disagree with a safety rule the owner or organization set?** Follow it while you make your case through the proper channel, with evidence and a proposed replacement (Chapter 19, section 19.7). Never quietly work around a safety rule because you think it is unnecessary. Rules that look unnecessary are often the scar tissue of an incident you never heard about.

**My team has no tests and no CI. Where do I start?** Start with the tests that protect against the worst harm: access rules on tables with personal or financial data (Chapter 13), and the core money paths (Chapter 14). Then add CI that runs those tests and a typecheck on every change. Then make it a rule that every bug fix adds a test. In a few months you will have meaningful coverage where it matters most, without a big rewrite.

**How much should I use AI tools?** As much as they help, with the rules in Chapter 18: you remain accountable, you verify with evidence, you never give them credentials or irreversible actions without approval, and you keep sensitive data out unless the use is lawful and appropriate. Use them heavily for drafting code, tests, documentation and analysis; review everything.

**How do I know when a product is ready to launch?** When the gates you wrote in advance are met (Chapter 3), the definition of done holds for every launch feature (Chapter 16), the release checklist is complete (Appendix B.6), support and legal readiness are in place (Chapter 31), and the owner approves. If you are tempted to launch without one of these, ask what you would tell the first user harmed by the gap.

**What do I do when I'm overwhelmed?** Shrink to the cadence's core (Chapter 22): read messages, write the weekly note, protect one block a day for the single most important task. Write down everything else in the backlog so it stops occupying your head. Tell the owner plainly what you will not get to and why; that is a planning input, not a confession. And look at what can be bought instead of built (Chapter 6).

**How do I keep learning after the first year?** One user conversation a week, one book a quarter, one postmortem read (yours or a public one) a month, and one skill deliberately stretched each quarter: a new kind of test, a new design pattern, a deeper look at your database's internals, a privacy law you have not read. Keep the learning log. Teach what you learn to someone newer; it is the fastest way to find out what you do not yet understand.

**What is the single habit that matters most?** Writing things down where the next person will look. It underlies checkpoints, decisions, plans, status, handoffs, postmortems and your own learning. Products, teams and careers that survive are the ones whose knowledge does not live only in someone's head.

## Appendix M. A day-by-day plan for your first two weeks

Chapter 3 gives the 90-day shape. This is the first two weeks in detail, for people who want a concrete script.

| Day | Morning | Afternoon | End of day |
| --- | --- | --- | --- |
| 1 | Meet the owner; agree how you will communicate; request read access | Read every written instruction, decision record and the strategy if one exists | Note questions; draft decision rights |
| 2 | Set up local development; run the app and tests | Use the product as the main user role, end to end | Log every hesitation and error |
| 3 | Use the product as every other role | Read three months of support requests; group and count | Top five user pains by count |
| 4 | Read the database schema; list tables with personal or financial data | Check access rules on those tables as two different test users | Any exposure found goes to the owner today |
| 5 | Draw the architecture: components, vendors, data flows | List every vendor and its billing | First weekly note to the owner (short: what you've learned, anything urgent) |
| 6 | Read the release process; make a harmless change (a typo) | Ship it through the real pipeline to production | Note every manual step and risk in the release |
| 7 | Read recent merged changes and open work | Meet every adjacent teammate: what do you need from me, what do I need from you | Ownership map draft |
| 8 | Interview the owner about the business (goals, customers, money, worries) | Interview a user | Write up both the same day |
| 9 | Observe a user working for an hour | Interview a user | Write up both |
| 10 | Review backups: when were they last restored? | Review secrets: any in code or documents? | Second weekly note; agree decision rights in writing |
| 11 | Interview a user who stopped using the product | Review metrics: what is measured, how defined | Note gaps in measurement |
| 12 | Review costs against usage | Draft the risk register |  |
| 13 | Draft the intake: roadmap, costs, risks, asks | Ask a teammate to read it critically |  |
| 14 | Revise the intake | Send it to the owner with your top three recommendations | Third weekly note; plan the visible win for days 31–60 |

Adjust the pace to the size of the product; the order matters more than the days. Access and safety checks come before opinions; listening comes before proposals; the intake comes before any large change.

## Appendix N. Quick reference

Tear-out pages for your desk. Each summarizes a part of the book in the fewest words that still work.

### N.1 The twelve rules

1. Measure outcomes, not output.
2. Write decision rights down; ask the owner only for owner decisions, with a recommendation.
3. Listen before you change; fix only what is broken and safe in the first weeks.
4. Ask about the past and specifics; never pitch in an interview.
5. Put rules in the database, not just the screen.
6. Never destroy a record you might need to explain; refund, void, retire, with a reason.
7. Undo for the common and reversible; deliberate confirmation for the irreversible; remove what should never happen.
8. Every table gets access rules, and every rule gets a negative test.
9. Secrets live on the server, never in code, chats or logs.
10. Done means tested, reviewed, verified on real devices, privacy handled, documented and observed.
11. Write it where the next person will look; checkpoint before you stop.
12. Bad news early, plainly, with a plan.

### N.2 The questions to ask about any feature

- Who has this problem, how often, and what does it cost them?
- How will we know it worked?
- What is the smallest version that solves it?
- What happens when it fails, is empty, is offline or partly succeeds?
- What can be undone, and what cannot?
- What new data does it collect? Is any of it sensitive? Who can see it? How is it exported and deleted?
- Does money move? Is every step idempotent and recorded?
- Who else depends on what we are changing?
- What will we test, including what must be refused?
- Does anything here need the owner's approval?

### N.3 The numbers to know

| Area | Number | Meaning |
| --- | --- | --- |
| Metrics | 6–7 | Maximum measures anyone will actually watch |
| Discovery | 5–8 | Interviews per question before patterns repeat |
| Discovery | 1 per week | Minimum user conversations |
| Planning | 20–30% | Capacity reserved for risk reduction and maintenance |
| Estimation | 2–3 days | Largest piece of work to estimate directly |
| Accessibility | 4.5:1 / 3:1 | WCAG AA contrast for normal text / large text and essential UI |
| Accessibility | 44 pt / 48 dp | Common minimum touch targets on iOS / Android |
| Intake | 4 pages | Maximum length an owner will read carefully |
| Status | 150 words | Maximum weekly note |
| Decisions | 2 minutes | Maximum time an owner should need to answer a request |
| Rocks | 1–3 | Quarterly commitments per person |
| Records | 7 years | This network's retention rule for financial records (check your own jurisdiction) |

### N.4 What always goes to the owner

- Spending money beyond agreed limits.
- Prices.
- Credentials, API keys, sign-in and OAuth settings.
- Production databases and live customer data.
- Public releases and announcements.
- Anything that permanently deletes something.
- Messages sent in the owner's name.
- The product's name and brand.
- Major direction and big bets.

### N.5 The weekly checklist

- [ ] Messages read, acted on, answered.
- [ ] Week's commitments chosen with buffer.
- [ ] One user conversation.
- [ ] Metrics reviewed against targets.
- [ ] Risk register five-minute pass.
- [ ] Costs glanced at for anomalies.
- [ ] Status note sent, decisions first.
- [ ] Status card and checkpoints current.
- [ ] Commitment status updated.

## Afterword

I wrote this book while doing the job it describes: between a database migration and a status note, with a refund test waiting on another team and ten questions out to the owner about his day. That is the honest picture. The work is never finished, and it is rarely glamorous. It is a long series of small decisions made carefully: which problem first, which word on a button, which rule in the database, which question for the owner, which risk to retire this week.

If you take one thing from this book, take this: you are responsible for the people on the other side of the screen. The trainer between sets. The client trusting you with their health. The owner trusting you with their business. Every technique in these pages is a way of keeping faith with them.

Now go build something small and real, and let it teach you the rest.

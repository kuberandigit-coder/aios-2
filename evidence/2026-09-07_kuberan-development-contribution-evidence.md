# Salary Increment Request — Supporting Evidence

**Name:** Kuberan
**Role during the work:** Digital Marketing — Technical Team
**Current role:** Development Team
**Work period:** July–August 2026
**System delivered:** DM Dashboard — internal Digital Marketing operations platform
**Repository:** github.com/websitetecteam-arch/dm-dashboard
**Status:** Live in production; used every working day by the full Digital Marketing team (~14 people)
**Document date:** 7 September 2026

---

## 1. Executive summary

During July and August 2026, while assigned to the Digital Marketing technical
team, I single-handedly designed, built, and deployed the **DM Dashboard** — a
complete internal web application that replaced the department's old static HTML
pages.

The work was full-stack software engineering: a React front end, a Python
(FastAPI) back end, two PostgreSQL databases, live integrations with the Shopify
Admin API, Google Analytics 4 and Google Search Console, and production
deployment on the company server.

The central deliverable was the **live sales data system**. For more than two
years the company had been unable to produce accurate, current sales figures
broken down by individual person and by sales channel. Every earlier attempt had
failed. I solved it independently, using my own design built on the Shopify Admin
API. That system is now the company's source of truth for **measuring individual
employee performance** and **calculating bonuses**.

This work was delivered on a Digital Marketing technical-team salary. My move to
the Development team has since been formalised. On that basis I am requesting a
salary increment that reflects the developer role I am now in and the value of
the work delivered.

---

## 2. What I built

### 2.1 Full dashboard rebuild

| Layer | Technology | Delivered |
|---|---|---|
| Front end | React + Vite | Replaced the entire old static HTML dashboard |
| Back end | Python (FastAPI) | New API layer connecting every data source |
| Database | PostgreSQL ×2 | App database (users, access, saved reports, sync history) + read-only link to the shared business database |
| Integrations | Shopify Admin API (UK, Germany, France stores), Google Analytics 4, Google Search Console | Live feeds so reports always reflect current figures |
| Hosting | Company server (Nginx + systemd) | Deployed and running in production |

### 2.2 Platform features

- Login and security (password hashing, session tokens)
- User management and per-person access permissions
- Individual dashboards — each staff member sees only the reports for their role
- Admin overview — management can view every team member's data and "view as" any user
- Scheduled background jobs that refresh the heavier reports automatically so pages load fast
- Connection-pool management and automatic retry handling for reliability under load

### 2.3 Team reporting modules

| Area | Staff covered | Approx. pages |
|---|---|---|
| Google Ads | UK, Germany, France, Italy markets (Sajeepan, Thivajini, Thasitha, Mahima, Jefri) | 25+ |
| SEO | Germany (Sukirtha) | 6 |
| Operations | UK / all markets (Kamsi, Sonya, Dilaksi, Theekshy) | 20+ |
| Feed & Listings | All markets (Hetheesha) | 5 |

Plus admin-level reports: sales attribution, employee performance, SEO
intelligence, refunds analysis, and Germany sales-decline analysis.

### 2.4 Live sales data system — the core contribution

**The problem, unsolved for 2+ years:** sales figures were compiled manually —
slow, frequently out of date, incomplete, and impossible to break down reliably
by person. Previous attempts to fix this did not succeed.

**What I delivered, independently:**

- All sales channels pulled together and updated **live** in one place, via the Shopify Admin API
- Sales **attributed to each individual staff member** — UK and Germany operations, 2025 and 2026
- **Every employee can log in and see their own sales performance** directly, at any time
- Closed months stored permanently; the current month refreshes automatically, keeping the history accurate
- Sync controls, sync history and monitoring so the data flow can be managed and audited

---

## 3. What the company gets

### 3.1 Time saving

| Task | Before | Now |
|---|---|---|
| Compiling all-channel sales figures | Manual pull and consolidation every reporting period | Automatic — no manual work |
| Breaking sales down by individual person | Manual, error-prone, often not done | Built in, instant |
| Each staff member checking their own sales | Had to ask a manager / wait for a report | Self-service, any time |
| Preparing data for performance reviews | Manual collation from several sources | Already in the dashboard |
| Team reports (Ads, SEO, Operations, Feed) | Static pages, manual updates | Live, refreshed automatically |

Estimated recurring effort removed: the equivalent of **[X] hours per month** of
manual reporting and data chasing across managers and staff (management to
confirm the exact figure). This is time that now goes back into selling and
optimisation work.

### 3.2 Cost saving

- **No external developer hire.** A system of this scope — React, Python,
  PostgreSQL, multiple API integrations, deployment and maintenance — would
  normally require hiring a full-stack developer, at a cost well above my current
  salary. The company received the system without that cost.
- **No third-party dashboard / BI subscription.** The live sales and reporting
  capability was built in-house instead of paying for an external analytics
  product.
- **Less management time spent on reporting**, which is a direct cost saving at
  senior salary levels.
- Any increment for this work would be far below the cost of the alternatives
  above.

### 3.3 Performance measurement and bonus calculation

- The dashboard is now the **agreed source of truth** for how much each person
  has sold.
- Performance reviews can be based on **consistent, live data** rather than
  manually assembled figures that were open to dispute.
- **Bonus calculations** now run directly off the system's per-person, per-channel
  sales numbers — faster to produce and fair to everyone because the same method
  applies to all staff.
- Historical months are locked once closed, so past bonus periods stay auditable.

### 3.4 Other ongoing benefits

- **Transparency for staff** — everyone can see their own numbers, which supports
  motivation and self-management.
- **A maintainable, documented codebase** — other developers can now extend the
  system using the technical documentation I wrote, instead of starting from
  fragile undocumented pages.
- **Reliability** — retry handling and connection management keep the system
  stable under the load of the whole team using it at once.
- **A foundation to build on** — new reports and tools can be added quickly on top
  of the platform (several already have been).

---

## 4. Supporting evidence

- **87 commits** authored by me (`kuberan <digitalmarketing69140951@gmail.com>`),
  including the initial full-project commit (24 August 2026) and 86 further
  commits of features and fixes. **359 files** created or changed. Verifiable in
  the repository with `git log --author="kuberan"`.
- **Technical documentation set** written by me (`docs/SYSTEM-KNOWLEDGE.md` and
  supporting docs): architecture, every module, the full API surface, database
  schemas, the authentication model, and the conventions for extending the
  system. Other developers use this as their reference.
- **Live system** — deployed and in daily use by the full Digital Marketing team.
  Management can verify usage directly, including the per-person sales views and
  the figures used for reviews and bonuses.

---

## 5. Request

For the reasons set out above, I am requesting a salary increment in recognition
of this work, effective from the next payroll cycle.

The basis: I delivered full developer-level work while on a technical-team
salary; my move to the Development team is now formalised; the system I built is
business-critical and solved a problem the company had been unable to close for
more than two years; and the value delivered — in time saved, cost avoided, and a
reliable basis for performance and bonus decisions — is substantial and ongoing.

I would welcome the opportunity to discuss this, including the amount, in person.

---

*Further evidence available on request: full commit log, a live walkthrough of
the system, and the complete technical documentation set.*

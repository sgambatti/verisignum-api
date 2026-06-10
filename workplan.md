# Workplan — SINAL-MI Delivery Plan

## 1. Delivery Objective
> **Presenter side note:** Present this section as: The delivery objective keeps the team focused on operational value, not exploratory innovation.
> **What led you to think of this and formulate this strategy or solution?** The delivery objective keeps the team focused on operational value, not exploratory innovation. I structured the plan around moving from idea to working pilot quickly.

Deliver a practical first-phase AI-enabled product that helps pilot municipal health teams identify and act on maternal and newborn risk earlier.

The delivery approach prioritizes:

- fast operational value;
- narrow pilot scope;
- user validation every sprint;
- explainable AI;
- minimal dependency on deep system integration.

---

## 2. Recommended Pilot Scope
> **Presenter side note:** Present this section as: The pilot scope is small enough to manage but realistic enough to test real workflows.
> **What led you to think of this and formulate this strategy or solution?** The pilot scope is small enough to manage but realistic enough to test real workflows. It includes the facilities and populations where missed care creates the most immediate risk.

### Pilot Facilities

- 5 urban UBS units;
- 1 maternity hospital;
- municipal maternal-child health coordination.

### Pilot Population

- active pregnancies;
- third-trimester pregnancies;
- postpartum women up to 45 days after delivery;
- newborns up to 30 days after birth;
- referrals from pilot UBS to pilot maternity hospital.

### Delivery Duration

Recommended timeline: **8 to 10 weeks**

---

## 3. Agile Delivery Model
> **Presenter side note:** Present this section as: Present short sprints with frequent demos because frontline feedback is essential.
> **What led you to think of this and formulate this strategy or solution?** I chose short sprints with frequent demos because frontline feedback is essential. In this context, adoption risk is as important as technical risk.

### Sprint Length

2-week sprints.

### Core Cadence

| Ceremony | Frequency | Purpose |
|---|---|---|
| Sprint Planning | Every 2 weeks | Confirm sprint goal, select backlog items |
| Technical Check-in | 2x/week | Resolve implementation blockers |
| User Validation | Weekly | Test workflow with nurses/CHWs/managers |
| Sprint Demo | End of sprint | Show working product to stakeholders |
| Sprint Retrospective | End of sprint | Improve delivery process |
| Backlog Refinement | Weekly | Add, clarify, reprioritize stories |

---

## 4. Delivery Roles
> **Presenter side note:** Present this section as: The roles map directly to the challenge’s team assumption.
> **What led you to think of this and formulate this strategy or solution?** The roles map directly to the challenge’s team assumption. I wanted to show how a PM, AI engineer, full-stack developer, and municipal users would collaborate without excess overhead.

### Product Manager / Consultant Lead

Owns:

- problem framing;
- stakeholder alignment;
- product requirements;
- user workflow validation;
- backlog prioritization;
- sprint planning;
- acceptance criteria;
- scope control;
- pilot success metrics.

### AI Solutions Engineer

Owns:

- data quality assessment;
- scoring logic;
- risk reason codes;
- referral summary guardrails;
- AI monitoring approach;
- threshold tuning;
- future predictive modeling path.

### Full Stack Developer

Owns:

- database;
- APIs;
- file import workflow;
- frontend screens;
- authentication;
- action queue;
- task tracking;
- referral summary UI;
- dashboard;
- audit logs.

### Municipal Counterparts

Support:

- access to sample data;
- clinical validation;
- workflow validation;
- pilot facility selection;
- privacy/governance review;
- user feedback.

---

## 5. Backlog Creation Approach
> **Presenter side note:** Present this section as: The backlog should be built from real workflows, not abstract feature ideas.
> **What led you to think of this and formulate this strategy or solution?** The backlog should be built from real workflows, not abstract feature ideas. I would start with user journeys, data availability, and the actions teams actually take each day.

The backlog should be created from four inputs:

1. **Stakeholder working session notes**  
   Convert pain points into product capabilities.

2. **Frontline workflow interviews**  
   Validate how nurses and community health agents actually work.

3. **Data assessment**  
   Identify available fields, missing fields, duplicates, and import feasibility.

4. **Outcome logic**  
   Prioritize features that improve follow-up, referral completeness, and timely action.

---

## 6. Backlog Prioritization Method
> **Presenter side note:** Present this section as: The prioritization method favors features that are actionable, feasible, and linked to care outcomes.
> **What led you to think of this and formulate this strategy or solution?** The prioritization method favors features that are actionable, feasible, and linked to care outcomes. This prevents the team from over-investing in dashboards or low-value AI experiments.

The backlog will be prioritized using a simple scoring model:

```text
Priority Score = Impact on maternal/newborn continuity + Urgency + Feasibility - Delivery Risk
```

### Prioritization Criteria

| Criterion | Question |
|---|---|
| User impact | Does it help frontline teams act faster? |
| Outcome relevance | Does it support prenatal, postpartum, newborn, or referral continuity? |
| Feasibility | Can the small team deliver it in phase one? |
| Dependency | Does it depend on external integration or policy change? |
| Trust | Does it improve explainability and adoption? |

---

## 7. MVP Backlog
> **Presenter side note:** Present this section as: The backlog distinguishes what must be built now from what can wait.
> **What led you to think of this and formulate this strategy or solution?** The backlog distinguishes what must be built now from what can wait. This gives the team a clear execution boundary and helps manage stakeholder expectations.

### Must Have

| Feature | Owner | Why |
|---|---|---|
| Data import from spreadsheet/e-SUS export | Full Stack Developer | Required to use fragmented existing data |
| Basic data validation | AI Engineer + Full Stack Developer | Required for trust and scoring |
| Unified mother-newborn registry | Full Stack Developer | Foundation for all workflows |
| Clinical risk score | AI Engineer | Core AI prioritization component |
| Care interruption risk score | AI Engineer | Addresses dropout and continuity risk |
| Daily action queue | Full Stack Developer | Main user-facing value |
| Priority explanation | AI Engineer + Full Stack Developer | Required for trust |
| Task/action status updates | Full Stack Developer | Converts insight into action |
| Referral summary generator | AI Engineer + Full Stack Developer | Improves hospital handoff |
| Basic municipal dashboard | Full Stack Developer | Supports leadership visibility |
| Role-based access | Full Stack Developer | Required for privacy |
| Audit logging | Full Stack Developer | Required for governance |

### Should Have

| Feature | Owner | Why |
|---|---|---|
| Duplicate detection | AI Engineer + Full Stack Developer | Improves data quality |
| Weekly export report | Full Stack Developer | Helps municipal coordination |
| Manual priority override | Full Stack Developer | Supports human-in-the-loop |
| Missing data flags | AI Engineer | Improves user trust |
| Unit-level performance comparison | Full Stack Developer | Supports management action |

### Could Have

| Feature | Owner | Why |
|---|---|---|
| Route prioritization for CHWs | AI Engineer | Useful but not essential |
| WhatsApp/SMS integration | Full Stack Developer | Valuable later, complex in phase one |
| Predictive ML model | AI Engineer | Should wait for data validation |
| Advanced geospatial dashboard | Full Stack Developer | Useful later, not MVP-critical |

### Won’t Have in Phase One

- new benefit creation;
- benefit conditionality enforcement;
- patient-facing chatbot;
- autonomous diagnosis;
- full e-SUS integration;
- full hospital integration;
- mobile app for patients;
- citywide rollout.

---

## 8. Sprint Plan
> **Presenter side note:** Present this section as: The sprint plan moves from validation to data foundation, then scoring, then operational tools, then pilot tuning.
> **What led you to think of this and formulate this strategy or solution?** The sprint plan moves from validation to data foundation, then scoring, then operational tools, then pilot tuning. This sequence reduces delivery risk and builds trust step by step.

## Sprint 0 — Discovery, Data Assessment, and Product Alignment
> **Presenter side note:** Present this section as: Sprint 0 prevents the team from building the wrong thing quickly.
> **What led you to think of this and formulate this strategy or solution?** Sprint 0 prevents the team from building the wrong thing quickly. I would use it to validate workflows, data quality, priority rules, and pilot commitment.

**Duration:** 1 week

### Goals

- Confirm pilot scope.
- Validate frontline workflow.
- Assess available data.
- Define minimum maternal-newborn record.
- Align stakeholders on phase-one boundaries.

### Activities

- Conduct interviews with nurses, CHWs, UBS managers, maternity referral staff, and coordinators.
- Review sample e-SUS exports, spreadsheets, and maternity discharge files.
- Map current maternal-newborn care journey.
- Identify points of care interruption.
- Define risk signals and action types.
- Create initial backlog.
- Confirm pilot facilities.

### Deliverables

- validated problem statement;
- user workflow map;
- minimum data dictionary;
- first version of scoring logic;
- prioritized MVP backlog;
- sprint 1 plan.

### Exit Criteria

- pilot facilities selected;
- sample data available;
- MVP scope approved;
- scoring approach reviewed with clinical stakeholders.

---

## Sprint 1 — Data Foundation and Registry
> **Presenter side note:** Present this section as: The registry comes first because scoring is only useful if records are consolidated.
> **What led you to think of this and formulate this strategy or solution?** The registry comes first because scoring is only useful if records are consolidated. This sprint turns messy source data into a usable operational base.

**Duration:** 2 weeks

### Sprint Goal

Create the data foundation needed to consolidate records and support risk scoring.

### User Stories

1. As a municipal analyst, I can upload a structured spreadsheet so that the system can ingest maternal records.
2. As a nurse, I can search for a pregnant woman or postpartum woman so that I can view her key information.
3. As a UBS manager, I can see which imported records have missing or invalid fields.
4. As a product/clinical user, I can identify likely duplicate records.

### Technical Work

- Build database schema.
- Build file upload workflow.
- Implement import templates.
- Implement validation rules.
- Create patient registry UI.
- Create mother-newborn linking structure.
- Add basic role-based access.

### Deliverables

- working import flow;
- registry screen;
- missing data flags;
- import history;
- initial access roles.

### Acceptance Criteria

- system can import at least one UBS file;
- missing required fields are flagged;
- users can search and open patient records;
- import success/failure is logged.

---

## Sprint 2 — Risk Scoring and Daily Action Queue
> **Presenter side note:** Present this section as: This is the core value sprint.
> **What led you to think of this and formulate this strategy or solution?** This is the core value sprint. Once the team can prioritize cases and explain why, the product starts changing the daily work of UBS teams.

**Duration:** 2 weeks

### Sprint Goal

Convert consolidated records into prioritized, explainable daily actions.

### User Stories

1. As a nurse, I can see a daily queue of prioritized cases so that I know who needs attention today.
2. As a community health agent, I can see assigned outreach actions so that I know whom to contact or visit.
3. As a user, I can understand why a patient was prioritized.
4. As a UBS manager, I can see overdue high-priority actions.

### Technical Work

- Implement clinical risk score.
- Implement care interruption risk score.
- Implement combined priority level.
- Generate reason codes.
- Build daily queue UI.
- Build task creation logic.
- Add task status updates.
- Add due date/SLA logic.

### Deliverables

- risk scoring engine;
- daily action queue;
- priority explanation;
- task tracking workflow.

### Acceptance Criteria

- every queue item includes priority and explanation;
- red/orange/yellow cases are generated from pilot data;
- users can update task status;
- overdue items are visible;
- nurse can review the queue in under 10 minutes during user test.

---

## Sprint 3 — Referral Summary and Municipal Dashboard
> **Presenter side note:** Present this section as: This sprint connects frontline action to referral quality and management visibility.
> **What led you to think of this and formulate this strategy or solution?** This sprint connects frontline action to referral quality and management visibility. It helps both hospital teams and municipal leaders see practical value.

**Duration:** 2 weeks

### Sprint Goal

Improve handoff quality and leadership visibility.

### User Stories

1. As a nurse, I can generate a referral summary so that the maternity hospital receives complete information.
2. As a maternity referral user, I can quickly understand a referred patient’s risk context.
3. As a municipal coordinator, I can see unresolved high-priority cases across pilot UBS units.
4. As a UBS manager, I can track whether my team is completing actions within SLA.

### Technical Work

- Build referral summary generation endpoint.
- Create LLM prompt guardrails.
- Build referral summary review/edit UI.
- Add source data snapshot.
- Build municipal dashboard.
- Add weekly export/report.
- Add audit logs for summary generation and task updates.

### Deliverables

- referral summary generator;
- municipal dashboard;
- audit logging;
- weekly operational report.

### Acceptance Criteria

- summary uses only structured available data;
- missing information is clearly marked;
- user reviews summary before use;
- dashboard shows priority volume, overdue actions, postpartum gaps, newborn gaps, and referral summaries.

---

## Sprint 4 — Pilot Testing, Tuning, and Scale Recommendation
> **Presenter side note:** Present this section as: The final sprint is about learning and credibility.
> **What led you to think of this and formulate this strategy or solution?** The final sprint is about learning and credibility. I would tune thresholds, document adoption barriers, and recommend whether the city should scale.

**Duration:** 2 weeks

### Sprint Goal

Validate the MVP in pilot context, tune scoring thresholds, and prepare a scale decision.

### Activities

- Conduct pilot user testing with all roles.
- Review red/orange queue volume vs. operational capacity.
- Tune score thresholds.
- Collect qualitative feedback.
- Measure first-phase adoption and operational metrics.
- Identify integration requirements for future phases.
- Prepare final scale recommendation.

### Deliverables

- tuned scoring configuration;
- pilot evaluation report;
- scale roadmap;
- product backlog for phase two;
- technical debt list;
- adoption and training recommendations.

### Acceptance Criteria

- pilot users can complete the core workflow;
- scoring explanations are understood by users;
- red/orange case volume is operationally manageable;
- municipal stakeholders can make informed scale decision.

---

## 9. Stakeholder Engagement Plan
> **Presenter side note:** Present this section as: Stakeholder engagement is built into delivery because government projects fail when users only see the product at the end.
> **What led you to think of this and formulate this strategy or solution?** Stakeholder engagement is built into delivery because government projects fail when users only see the product at the end. Weekly touchpoints keep technical work grounded in reality.

### Weekly Stakeholder Touchpoints

| Stakeholder | Frequency | Purpose |
|---|---|---|
| Secretary / senior leadership | Every 2 weeks | Direction, risk, value demonstration |
| Maternal-child health lead | Weekly | Clinical and operational validation |
| UBS nurses and managers | Weekly | Workflow validation |
| Community health agents | Weekly | Outreach workflow validation |
| Maternity referral staff | Sprint 3 onward | Handoff validation |
| Analytics team | Weekly during Sprint 0-2 | Data access, mapping, quality |
| Finance/strategy | Sprint reviews | Value evidence and scale decision |

---

## 10. Acceptance Criteria by Product Area
> **Presenter side note:** Present this section as: Acceptance criteria translate the idea into testable delivery outcomes.
> **What led you to think of this and formulate this strategy or solution?** Acceptance criteria translate the idea into testable delivery outcomes. This helps the technical team know when each product area is truly ready.

### Data Import

- imports from structured files;
- invalid rows are flagged;
- source is recorded;
- import history available.

### Registry

- searchable mother-newborn records;
- mother/newborn linkage;
- missing data visible.

### Scoring

- clinical score generated;
- interruption score generated;
- priority level generated;
- reason codes displayed.

### Action Queue

- sorted by priority;
- filterable by status and role;
- action can be updated;
- overdue actions visible.

### Referral Summary

- generated from structured data;
- reviewed before use;
- missing fields marked;
- generation logged.

### Dashboard

- shows pilot metrics;
- filterable by UBS;
- highlights overdue red/orange cases;
- exportable weekly report.

---

## 11. Phase-One Success Metrics
> **Presenter side note:** Present this section as: The metrics focus on adoption, operational value, and learning.
> **What led you to think of this and formulate this strategy or solution?** The metrics focus on adoption, operational value, and learning. These are the right proof points before claiming broader health impact.

### Adoption

- 80% of pilot users log in at least three times per week.
- 70% of red/orange cases receive documented action within SLA.
- Nurses can review daily action queue in under 10 minutes.

### Operational Value

- Increase in documented follow-up for high-priority cases.
- Increase in postpartum follow-up completion within 45 days.
- Increase in newborn follow-up completion in the first month.
- Increase in referral completeness.
- Reduction in manual list-making time.

### Learning

- validated minimum data model;
- validated risk reasons;
- validated operational capacity by UBS;
- clear roadmap for integration and scaling.

---

## 12. Key Dependencies
> **Presenter side note:** Present this section as: Show that I made dependencies explicit so the delivery risk is visible early.
> **What led you to think of this and formulate this strategy or solution?** I made dependencies explicit so the delivery risk is visible early. Data access, pilot commitment, and clinical validation are as important as code.

- access to sample data from pilot UBS and maternity hospital;
- agreement on minimum data fields;
- clinical validation of risk signals;
- nominated pilot users;
- privacy and governance review;
- municipal approval of pilot scope.

---

## 13. Delivery Risks and Mitigations
> **Presenter side note:** Present this section as: This section shows that I expect friction and have a plan for it.
> **What led you to think of this and formulate this strategy or solution?** This section shows that I expect friction and have a plan for it. The mitigations emphasize scope control, user training, and practical fallback paths.

| Risk | Impact | Mitigation |
|---|---|---|
| Data incomplete or inconsistent | High | Start with minimum fields and missing data flags |
| Too many red cases | Medium/High | Tune thresholds weekly |
| Users see tool as extra burden | High | Replace manual list-making; keep UI simple |
| AI distrust | Medium | Explainable scoring and human override |
| Integration delays | High | Use file imports in phase one |
| Scope creep | High | Maintain explicit out-of-scope list |
| Privacy concerns | High | Role-based access, audit logs, LGPD-aligned governance |

---

## 14. Phase-Two Roadmap
> **Presenter side note:** Present this section as: The roadmap shows how the MVP could mature without forcing everything into phase one.
> **What led you to think of this and formulate this strategy or solution?** The roadmap shows how the MVP could mature without forcing everything into phase one. It leaves room for integrations, predictive models, and patient communication later.

If phase one succeeds, the next phase may include:

- expansion to more UBS units;
- integration with source systems;
- patient-facing communication workflows;
- predictive ML trained on validated historical data;
- route prioritization for CHWs;
- advanced quality-improvement dashboards;
- municipal maternal-newborn risk monitoring at scale.

---

## 15. Final Delivery Recommendation
> **Presenter side note:** Present this section as: The recommendation reinforces the main product judgment: start with action, prove value, then scale.
> **What led you to think of this and formulate this strategy or solution?** The recommendation reinforces the main product judgment: start with action, prove value, then scale. That is the most realistic path for a municipal AI initiative.

The first phase should be judged by whether it creates a working operational loop:

```text
Data → Risk Identification → Daily Priority → Assigned Action → Follow-up Status → Management Visibility → Improved Continuity
```

This loop is the foundation for improving maternal and newborn outcomes in practice.


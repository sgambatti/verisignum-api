# Product Requirements Document — SINAL-MI

## 1. Product Name
> **Presenter side note:** Present this section as: The name signals the product’s function: a warning and navigation system for maternal-infant care.
> **What led you to think of this and formulate this strategy or solution?** The name signals the product’s function: a warning and navigation system for maternal-infant care. I wanted a name that sounds operational, not experimental or flashy.

**SINAL-MI: Maternal & Newborn Daily Action Engine**

SINAL-MI stands for an AI-enabled action system for maternal and infant care. It is designed to help municipal health teams identify risk earlier, prioritize daily action, and improve continuity of care for pregnant women, postpartum women, and newborns.

---

## 2. Executive Summary
> **Presenter side note:** Present this section as: This section anchors the product around actionability.
> **What led you to think of this and formulate this strategy or solution?** This section anchors the product around actionability. The city needs a practical first phase, so I summarize the product as a daily prioritization layer over fragmented data.

Delivery Associates is supporting a Brazilian municipal government that wants to reduce maternal and infant mortality. The city has fragmented data, busy frontline teams, uneven operational capacity across facilities, and limited integration with existing systems.

The first phase of SINAL-MI focuses on the most actionable problem:

> Frontline teams do not have a shared, reliable, and simple way to know which mothers and newborns need action today.

The product will consolidate minimal data from e-SUS exports, spreadsheets, maternity discharge data, and local follow-up lists into a lightweight operational layer. It will generate an explainable daily action queue, recommend next actions, track whether those actions were completed, and generate referral summaries for maternity hospitals.

This is not a generic innovation pilot. It is a practical, outcome-focused product designed to create operational value quickly.

---

## 3. Problem Statement
> **Presenter side note:** Present this section as: The problem statement comes directly from the stakeholder pain points: informal risk knowledge, incomplete referrals, and no shared action system.
> **What led you to think of this and formulate this strategy or solution?** The problem statement comes directly from the stakeholder pain points: informal risk knowledge, incomplete referrals, and no shared action system. I framed the gap as operational continuity, not just data visibility.

The city already collects significant information about pregnant women, postpartum women, and newborns, but this information is fragmented and inconsistently used.

The working session revealed several operational failures:

- at-risk patients are often identified informally by nurses;
- there is no shared system to track or act on those informal risk signals;
- referrals from primary care often arrive late or incomplete;
- community health agents can identify pregnant women early, but follow-up weakens in the third trimester and after birth;
- postpartum and newborn follow-up are weaker than prenatal follow-up;
- current dashboards are not trusted because they are often outdated;
- teams struggle not only to identify risk, but to know who needs action today.

The first-phase product must therefore solve an operational prioritization problem, not simply produce another dashboard.

---

## 4. Product Vision
> **Presenter side note:** Present this section as: The vision balances ambition with realism.
> **What led you to think of this and formulate this strategy or solution?** The vision balances ambition with realism. The product should help the city move from reactive follow-up to proactive care navigation without pretending to replace clinical judgment.

SINAL-MI will help frontline teams move from fragmented, passive data to coordinated, timely action.

The long-term vision is a municipal maternal and newborn care intelligence layer that improves continuity across primary care, maternity hospitals, community health teams, and municipal leadership.

The first phase will focus on proving value through a narrow, realistic MVP.

---

## 5. First-Phase Goal
> **Presenter side note:** Present this section as: The goal is narrow enough to deliver and broad enough to matter.
> **What led you to think of this and formulate this strategy or solution?** The goal is narrow enough to deliver and broad enough to matter. I chose measurable operational outcomes that a small team can influence within weeks.

Build a lightweight, AI-enabled product that helps pilot UBS and maternity teams:

1. identify pregnant women, postpartum women, and newborns needing urgent follow-up;
2. detect likely care interruption earlier;
3. prioritize daily action for nurses and community health agents;
4. improve referral completeness;
5. track whether high-priority actions were completed.

---

## 6. Target Users
> **Presenter side note:** Present this section as: Show from the frontline outward because adoption will fail if nurses and community health agents do not find value.
> **What led you to think of this and formulate this strategy or solution?** I designed from the frontline outward because adoption will fail if nurses and community health agents do not find value. Leadership dashboards are secondary to the daily work of care teams.

### Primary Users

#### UBS Nurse
Needs to review a large caseload quickly and decide which mothers/newborns need follow-up today.

#### Community Health Agent
Needs a simple, prioritized list of households to contact or visit, especially when phone access is unstable.

#### UBS Manager
Needs visibility into overdue actions, unresolved high-risk cases, and uneven performance inside the unit.

### Secondary Users

#### Maternity Referral Staff
Needs complete, concise case information when a patient is referred from primary care.

#### Municipal Maternal and Child Health Coordinator
Needs visibility across pilot units to identify bottlenecks, support teams, and evaluate value before expansion.

#### Municipal Analytics Team
Needs a structured data model, data quality checks, and a path toward future integration.

---

## 7. User Needs
> **Presenter side note:** Present this section as: The needs separate frontline urgency from management visibility.
> **What led you to think of this and formulate this strategy or solution?** The needs separate frontline urgency from management visibility. This helps technical reviewers see that the product is not one generic interface for everyone.

### Frontline Needs

- Know which cases need action today.
- Understand why each case is prioritized.
- Avoid duplicate data entry.
- Track follow-up status quickly.
- Generate referral information without manually reconstructing the case history.

### Management Needs

- See unresolved high-priority cases.
- Identify units with overdue actions.
- Understand postpartum and newborn follow-up gaps.
- Evaluate whether the first phase creates measurable operational value.

---

## 8. Product Principles
> **Presenter side note:** Present this section as: The principles are decision filters for the MVP.
> **What led you to think of this and formulate this strategy or solution?** The principles are decision filters for the MVP. They protect the project from becoming a broad AI pilot and keep the team focused on simple, explainable, human-reviewed action.

1. **Action before analytics**  
   Every screen should help a user decide or act.

2. **Explainability before complexity**  
   Users should understand why each case is prioritized.

3. **Human-in-the-loop**  
   The product supports clinical and operational decision-making but does not replace professionals.

4. **No duplicate data entry**  
   The system should reuse existing data and ask users only for minimal action updates.

5. **Start lightweight, design for scale**  
   Phase one should not depend on deep integrations, but the data model should prepare for future interoperability.

6. **Equity-aware prioritization**  
   Risk is not only clinical. The product should also account for risk of care interruption.

---

## 9. In Scope for Phase One
> **Presenter side note:** Present this section as: The in-scope list reflects what can realistically be built by one AI engineer and one full-stack developer.
> **What led you to think of this and formulate this strategy or solution?** The in-scope list reflects what can realistically be built by one AI engineer and one full-stack developer. Each item contributes directly to the daily action workflow.

The MVP includes:

- CSV/Excel import of pilot UBS maternal records;
- import or manual upload of maternity discharge records;
- unified mother-newborn registry;
- clinical risk scoring;
- care interruption/dropout risk scoring;
- daily action queue by UBS;
- explanation for each priority score;
- action assignment and status tracking;
- controlled referral summary generation;
- basic municipal dashboard;
- role-based access;
- audit trail for key actions.

---

## 10. Out of Scope for Phase One
> **Presenter side note:** Present this section as: Show that I made the exclusions explicit to show product discipline.
> **What led you to think of this and formulate this strategy or solution?** I made the exclusions explicit to show product discipline. The project should not depend on legal, budget, or deep integration decisions to prove value.

The MVP does not include:

- creation of new financial benefits;
- enforcement of benefit conditionality;
- citywide rollout;
- replacement of e-SUS or hospital systems;
- full real-time system integration;
- automated clinical diagnosis;
- patient-facing chatbot;
- mobile app for patients;
- automated medical advice;
- predictive model trained on unvalidated historical data;
- WhatsApp automation without municipal governance and consent process.

---

## 11. Core User Stories
> **Presenter side note:** Present this section as: The user stories translate the strategy into concrete behavior.
> **What led you to think of this and formulate this strategy or solution?** The user stories translate the strategy into concrete behavior. They show how each actor gets value from the same operational backbone.

### Nurse

As a UBS nurse, I want to see a daily list of prioritized maternal and newborn cases so that I can focus my time on the patients most likely to need action.

### Community Health Agent

As a community health agent, I want a simple list of mothers and newborns to contact or visit so that I can prioritize outreach instead of working reactively.

### UBS Manager

As a UBS manager, I want to see unresolved and overdue high-priority cases so that I can coordinate my team and reduce variation in follow-up quality.

### Maternity Referral Staff

As a hospital referral staff member, I want a concise referral summary so that I can understand the patient’s risk context quickly.

### Municipal Coordinator

As a municipal maternal-child health coordinator, I want to see operational bottlenecks across pilot units so that I can support the units that need help and evaluate whether the product should scale.

---

## 12. MVP Features
> **Presenter side note:** Present this section as: The MVP features are sequenced around the user journey: consolidate records, prioritize risk, create tasks, track action, summarize referrals, and manage bottlenecks.
> **What led you to think of this and formulate this strategy or solution?** The MVP features are sequenced around the user journey: consolidate records, prioritize risk, create tasks, track action, summarize referrals, and manage bottlenecks.

### Feature 1: Unified Mother-Newborn Registry

The system creates a consolidated record for each pregnant woman, postpartum woman, and newborn.

#### Minimum fields

- patient identifier;
- name;
- date of birth;
- UBS;
- neighborhood;
- primary phone;
- alternative contact;
- pregnancy status;
- gestational age;
- estimated due date;
- delivery date, if applicable;
- newborn information, if applicable;
- risk factors;
- last appointment date;
- missed appointments;
- referral history;
- postpartum follow-up status;
- newborn follow-up status.

#### Acceptance Criteria

- Users can import a structured file.
- The system flags missing required fields.
- The system identifies likely duplicates.
- Users can search for a patient record.
- Mother and newborn records can be linked.

---

### Feature 2: Daily Action Queue

The system generates a prioritized queue for each pilot UBS.

#### Priority levels

- **Red:** action required today;
- **Orange:** action required within 48 hours;
- **Yellow:** action required within 7 days;
- **Green:** monitor only.

#### Each queue item includes

- patient name;
- mother/newborn status;
- priority level;
- reasons for prioritization;
- recommended action;
- responsible role;
- due date;
- current status.

#### Acceptance Criteria

- A nurse can filter by priority level.
- A community health agent can see assigned outreach actions.
- Each prioritized case includes an explanation.
- Queue can be reviewed in less than 10 minutes by a nurse during pilot usability testing.

---

### Feature 3: Explainable Risk & Dropout Prioritization

The product calculates two scores:

1. **Clinical Risk Score**
2. **Care Interruption Risk Score**

The product then combines both into an **Action Priority Level**.

#### Clinical signals may include

- hypertension;
- anemia;
- adolescent pregnancy;
- previous C-section;
- formal high-risk flag;
- late prenatal care start;
- fewer than expected prenatal visits;
- missed prenatal visits;
- postpartum follow-up not completed;
- newborn early follow-up not completed.

#### Care interruption signals may include

- missed last appointment;
- multiple missed appointments;
- unstable phone access;
- use of relative’s phone;
- no recent contact;
- third trimester without recent follow-up;
- postpartum without scheduled return;
- newborn discharged without documented primary care follow-up.

#### Acceptance Criteria

- Each score is visible to authorized users.
- Each score includes human-readable explanation.
- Users can manually override priority with reason.
- Score thresholds can be tuned by the product/clinical team during pilot.

---

### Feature 4: Action Tracking

Users can mark actions as:

- pending;
- contacted;
- appointment scheduled;
- home visit planned;
- home visit completed;
- referred;
- unable to contact;
- escalated;
- resolved.

#### Acceptance Criteria

- Every action has timestamp and responsible user.
- Overdue actions appear in the queue and municipal dashboard.
- Users can add a short note.
- The system preserves action history.

---

### Feature 5: Referral Summary Generator

The product generates a concise referral summary using structured data already available in the system.

#### Summary includes

- patient identification;
- pregnancy/postpartum/newborn status;
- gestational age or days postpartum;
- key risk factors;
- missed visits;
- recent actions;
- reason for referral;
- UBS contact;
- pending information.

#### AI Guardrails

- The model must not invent clinical facts.
- The summary must be reviewable and editable by the user.
- Generated content must be based only on available structured data.
- The system must clearly mark missing data.

#### Acceptance Criteria

- User can generate summary from patient record.
- User can review/edit before using.
- Summary includes missing data warnings.
- Summary generation is logged.

---

### Feature 6: Municipal Operational Dashboard

The dashboard gives municipal leadership visibility into pilot performance.

#### Dashboard metrics

- active pregnancies in pilot UBS;
- number of red/orange/yellow cases;
- overdue actions;
- percentage of red/orange cases acted on within SLA;
- postpartum follow-up completion;
- newborn first-month follow-up completion;
- referral summaries generated;
- units with highest unresolved action burden.

#### Acceptance Criteria

- Municipal coordinator can filter by UBS.
- Dashboard updates after data import/action updates.
- Dashboard highlights overdue red/orange cases.
- Dashboard can export a weekly summary.

---

## 13. Success Metrics
> **Presenter side note:** Present this section as: Present leading indicators instead of long-term mortality claims.
> **What led you to think of this and formulate this strategy or solution?** I chose leading indicators instead of long-term mortality claims. These metrics show whether the product is improving follow-up, referral completeness, and frontline response.

### Adoption Metrics

- 80% of pilot UBS users log in at least three times per week.
- At least 70% of red/orange cases receive a documented action within SLA.
- Nurses can review the queue in under 10 minutes.
- At least 70% of referral summaries are rated useful by maternity referral users.

### Operational Metrics

- Increase in documented follow-up for high-priority cases.
- Increase in postpartum follow-up completion within 45 days.
- Increase in newborn follow-up completion in the first month.
- Increase in completeness of referral information.
- Reduction in manual time spent preparing follow-up lists.
- Reduction in unresolved red/orange cases over the pilot period.

### Health Outcome Proxy Metrics

The first phase should not claim direct mortality reduction. Instead, it should measure operational behaviors associated with better maternal and newborn outcomes:

- earlier action on high-risk pregnancies;
- faster recovery after missed appointments;
- better postpartum continuity;
- better newborn follow-up;
- more complete and timely referrals.

---

## 14. Key Risks and Mitigations
> **Presenter side note:** Present this section as: These risks are the ones most likely to break the project in government health settings.
> **What led you to think of this and formulate this strategy or solution?** These risks are the ones most likely to break the project in government health settings. The mitigations emphasize simplicity, explainability, training, and scope control.

### Risk 1: Poor data quality

**Mitigation:** Start with minimum required fields, missing-data flags, duplicate detection, and manual correction workflows.

### Risk 2: Frontline staff perceive tool as extra work

**Mitigation:** Design the action queue to replace manual list-making and require only simple status updates.

### Risk 3: Distrust of AI

**Mitigation:** Use explainable scoring, human review, and manual override. Avoid black-box decisions.

### Risk 4: Alert fatigue

**Mitigation:** Tune thresholds weekly during pilot and keep red/orange queues aligned with actual team capacity.

### Risk 5: Privacy and sensitive health data

**Mitigation:** Use role-based access, audit logs, encryption, minimum necessary data, and LGPD-aligned governance.

### Risk 6: Scope creep

**Mitigation:** Keep the first phase focused on pilot units, data imports, prioritization, action tracking, and referral summaries.

---

## 15. Rollout Recommendation
> **Presenter side note:** Present this section as: The rollout is intentionally constrained to validate workflow, not prove citywide scale immediately.
> **What led you to think of this and formulate this strategy or solution?** The rollout is intentionally constrained to validate workflow, not prove citywide scale immediately. A focused pilot gives the team enough evidence to tune scoring and adoption.

### Pilot Units

- 5 urban UBS units with different operational profiles;
- 1 maternity hospital receiving referrals from those UBS units.

### Pilot Population

- active pregnancies;
- third-trimester pregnancies;
- postpartum women up to 45 days;
- newborns up to 30 days.

### Pilot Duration

- 8 to 10 weeks, including discovery, build, validation, and operational testing.

---

## 16. Future Roadmap
> **Presenter side note:** Present this section as: The roadmap shows ambition without overloading phase one.
> **What led you to think of this and formulate this strategy or solution?** The roadmap shows ambition without overloading phase one. It gives recruiters confidence that the MVP is a foundation for deeper integrations and patient engagement later.

If the MVP proves operational value, future phases may include:

- deeper integration with e-SUS and hospital systems;
- WhatsApp/SMS outreach governed by consent and escalation protocols;
- route optimization for community health agents;
- predictive modeling trained on validated historical data;
- expansion to all UBS and maternity hospitals;
- more advanced municipal quality-improvement analytics.

---

## 17. Product Decision Summary
> **Presenter side note:** Present this section as: This final section is the strategic punchline.
> **What led you to think of this and formulate this strategy or solution?** This final section is the strategic punchline. I want evaluators to remember that this is not an AI dashboard; it is a daily action system for care continuity.

SINAL-MI intentionally starts with a daily action engine instead of a generic dashboard because the city’s most urgent need is not more passive visibility. It is helping frontline teams know who needs action today, why they were prioritized, and what should happen next.


# Research Notes — International Ideas Adapted for SINAL-MI

## Purpose
> **Presenter side note:** Present this section as: Mention that I included research notes to show that the proposal is grounded in proven patterns, not just opinion.
> **What led you to think of this and formulate this strategy or solution?** I included research notes to show that the proposal is grounded in proven patterns, not just opinion. The goal is to adapt ideas responsibly to the Brazilian municipal context.

This document summarizes external ideas that informed the SINAL-MI proposal. The goal is not to copy another country’s system directly, but to adapt useful principles to a Brazilian municipal context with fragmented data, busy frontline teams, uneven operational capacity, and limited integration.

---

## 1. WHO Antenatal Care Guidance
> **Presenter side note:** Present this section as: WHO guidance supports the focus on early and continuous prenatal care.
> **What led you to think of this and formulate this strategy or solution?** WHO guidance supports the focus on early and continuous prenatal care. I used it to justify why missed visits and late prenatal start should be prioritized.

WHO’s 2016 antenatal care model recommends a minimum of eight antenatal contacts, with the first contact in the first trimester. This reinforces the importance of early antenatal engagement and continuity throughout pregnancy.

Relevant source:

- WHO / NCBI Bookshelf: https://www.ncbi.nlm.nih.gov/books/NBK409109/
- WHO guideline page: https://www.who.int/publications/i/item/9789241549912

### How SINAL-MI adapts this

SINAL-MI does not try to enforce international guidelines directly. Instead, it uses prenatal care timing, visit count, missed appointments, and third-trimester follow-up gaps as risk and care interruption signals.

---

## 2. WHO Postnatal Care Guidance
> **Presenter side note:** Present this section as: Postnatal follow-up is a known weak point in the prompt.
> **What led you to think of this and formulate this strategy or solution?** Postnatal follow-up is a known weak point in the prompt. I used this guidance to frame postpartum and newborn follow-up as first-phase priorities.

WHO emphasizes that the first six weeks after birth are a critical period for women and newborns. WHO’s 2022 recommendations include additional postnatal contacts during the first six weeks after birth.

Relevant sources:

- WHO guideline: https://www.who.int/publications/i/item/9789240045989
- WHO postnatal care page: https://www.who.int/teams/sexual-and-reproductive-health-and-research-%28srh%29/areas-of-work/maternal-and-perinatal-health/postnatal-care
- NCBI executive summary: https://www.ncbi.nlm.nih.gov/books/NBK579653/

### How SINAL-MI adapts this

The product explicitly prioritizes postpartum women up to 45 days and newborns up to 30 days in the MVP. This addresses the challenge note that newborn follow-up is weaker than prenatal follow-up and continuity drops after birth.

---

## 3. California Maternal Quality Care Collaborative — Maternal Data Center
> **Presenter side note:** Present this section as: This inspired the idea of turning existing data into actionable quality intelligence.
> **What led you to think of this and formulate this strategy or solution?** This inspired the idea of turning existing data into actionable quality intelligence. I adapted the principle, not the full infrastructure, because the MVP must stay lightweight.

The California Maternal Quality Care Collaborative (CMQCC) operates the Maternal Data Center, an online tool that generates near-real-time maternity care metrics using data hospitals already collect.

Relevant source:

- CMQCC Maternal Data Center: https://www.cmqcc.org/maternal-data-center

### Principle adapted

Use existing data to create actionable, timely operational insight.

### How SINAL-MI adapts this

SINAL-MI uses e-SUS exports, spreadsheets, and maternity discharge data to produce near-real-time operational queues and pilot dashboards. It does not attempt to reproduce a full statewide quality data center in phase one.

---

## 4. UK / NHS Maternity Early Warning Approaches
> **Presenter side note:** Present this section as: The UK example supports standardized escalation logic.
> **What led you to think of this and formulate this strategy or solution?** The UK example supports standardized escalation logic. I translated that concept into explainable priority rules for UBS and referral workflows.

The UK has invested in standardized maternity early warning tools to identify deterioration in pregnant and postpartum women and support escalation.

Relevant sources:

- NIHR: https://www.nihr.ac.uk/news/new-maternity-early-warning-score-be-implemented-nhs
- NHS England Three-Year Delivery Plan: https://www.england.nhs.uk/long-read/three-year-delivery-plan-for-maternity-and-neonatal-services/
- BMJ Medicine national MEWS study: https://bmjmedicine.bmj.com/content/3/1/e000748

### Principle adapted

Standardized early warning logic helps teams identify and escalate risk consistently.

### How SINAL-MI adapts this

The MVP uses explainable scoring rules and priority thresholds rather than informal, inconsistent risk tracking. It does not replicate hospital MEWS as-is because SINAL-MI is designed for municipal primary care and care continuity.

---

## 5. Jacaranda Health PROMPTS — Kenya
> **Presenter side note:** Present this section as: Jacaranda shows that AI can triage risk and escalate to humans in maternal care.
> **What led you to think of this and formulate this strategy or solution?** Jacaranda shows that AI can triage risk and escalate to humans in maternal care. I used that pattern while keeping patient-facing messaging out of phase one.

Jacaranda Health’s PROMPTS is a digital maternal health platform using messaging, AI-assisted triage, and human escalation to support pregnant and postpartum women.

Relevant sources:

- PROMPTS overview: https://jacarandahealth.org/prompts/
- Proactive risk screening: https://jacarandahealth.org/proactive-risk-screening-how-do-we-capture-and-use-the-health-history-of-mothers-via-sms/

### Principle adapted

AI should triage risk and escalate to humans, not replace care teams.

### How SINAL-MI adapts this

SINAL-MI uses AI to identify risk, prioritize action, and generate referral summaries, while keeping nurses and community health agents in control of decisions and follow-up.

---

## 6. India Kilkari / mMitra-Style Maternal Programs
> **Presenter side note:** Present this section as: These programs show the importance of engagement and dropout risk.
> **What led you to think of this and formulate this strategy or solution?** These programs show the importance of engagement and dropout risk. I adapted that insight into the Care Interruption Risk Score.

India’s maternal mobile health programs such as Kilkari and mMitra use scheduled phone messaging to support pregnant women and mothers. Related research explores machine learning to identify disengagement and improve targeting.

Relevant sources:

- Kilkari trial protocol: https://link.springer.com/article/10.1186/s13063-019-3369-5
- Engagement prediction research: https://arxiv.org/abs/2311.07139

### Principle adapted

Care dropout can be predicted and used to target outreach more effectively.

### How SINAL-MI adapts this

The MVP includes a Care Interruption Risk Score based on missed appointments, unstable contact information, postpartum gaps, and newborn follow-up gaps.

---

## 7. Design Takeaways for SINAL-MI
> **Presenter side note:** Present this section as: This section converts research into product principles.
> **What led you to think of this and formulate this strategy or solution?** This section converts research into product principles. I wanted evaluators to see exactly how external evidence shaped the MVP decisions.

Across these examples, the strongest transferable principles are:

1. use data already collected;
2. make risk visible early;
3. standardize escalation logic;
4. support humans rather than replace them;
5. focus on operational action;
6. track whether the action happened;
7. avoid overbuilding before data quality and workflow are validated.

These principles directly shape the SINAL-MI MVP.


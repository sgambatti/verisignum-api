# Risk Scoring — SINAL-MI

## 1. Purpose
> **Presenter side note:** Present this section as: The purpose is to make prioritization transparent and actionable.
> **What led you to think of this and formulate this strategy or solution?** The purpose is to make prioritization transparent and actionable. I separated this file so technical reviewers can inspect the logic without digging through the PRD.

The SINAL-MI scoring system converts fragmented maternal and newborn data into an explainable daily priority level.

The goal is not to diagnose. The goal is to help frontline teams identify who needs action today.

---

## 2. Scoring Philosophy
> **Presenter side note:** Present this section as: The scoring philosophy starts with trust.
> **What led you to think of this and formulate this strategy or solution?** The scoring philosophy starts with trust. In phase one, an explainable imperfect score is safer and more adoptable than an opaque model trained on messy data.

The first version uses explainable rules rather than a black-box machine learning model.

Reasons:

- source data is fragmented;
- users need to trust the system;
- the pilot team is small;
- clinical and operational thresholds need to be validated in context;
- the MVP must be delivered quickly.

Predictive modeling may be introduced later if historical data quality is validated.

---

## 3. Score Types
> **Presenter side note:** Present this section as: Explain why I split the score into clinical risk and care interruption risk because both can lead to bad outcomes.
> **What led you to think of this and formulate this strategy or solution?** I split the score into clinical risk and care interruption risk because both can lead to bad outcomes. This reflects the prompt’s insight that the issue is not only identifying risk, but knowing who needs action.

SINAL-MI calculates two scores:

1. **Clinical Risk Score**
2. **Care Interruption Risk Score**

The system then combines them into an **Action Priority Score**.

---

## 4. Clinical Risk Score
> **Presenter side note:** Present this section as: The clinical score captures known danger signals from the scenario.
> **What led you to think of this and formulate this strategy or solution?** The clinical score captures known danger signals from the scenario. I kept it rule-based so clinicians can challenge, tune, and trust the logic.

The Clinical Risk Score captures known maternal and newborn risk signals.

### Initial Rule Weights

| Signal | Suggested Weight |
|---|---:|
| Formal high-risk pregnancy flag | +25 |
| Hypertension registered | +30 |
| Anemia registered | +15 |
| Adolescent pregnancy | +10 |
| Previous C-section | +10 |
| Third trimester | +10 |
| Prenatal care started after first trimester | +15 |
| Fewer than expected prenatal visits | +15 |
| Missed prenatal appointment | +15 |
| Postpartum follow-up not completed within expected window | +25 |
| Newborn first-month follow-up missing | +25 |

---

## 5. Care Interruption Risk Score
> **Presenter side note:** Present this section as: This is the more strategic score because many failures happen when patients drop out of care.
> **What led you to think of this and formulate this strategy or solution?** This is the more strategic score because many failures happen when patients drop out of care. It turns social and operational barriers into follow-up priority without creating a new policy program.

The Care Interruption Risk Score captures the likelihood that a mother or newborn may fall out of care.

### Initial Rule Weights

| Signal | Suggested Weight |
|---|---:|
| Missed last appointment | +25 |
| Two or more missed appointments | +30 |
| No documented contact in 14 days | +20 |
| Unstable phone number | +15 |
| Uses relative’s phone | +10 |
| Third trimester without recent visit/contact | +25 |
| Postpartum without scheduled follow-up | +25 |
| Newborn discharged without documented UBS follow-up | +25 |
| Unable to contact in last attempt | +20 |
| Previous referral not completed | +20 |

---

## 6. Combined Action Priority
> **Presenter side note:** Present this section as: The combined score converts risk into workflow.
> **What led you to think of this and formulate this strategy or solution?** The combined score converts risk into workflow. The goal is not just classification, but deciding whether the team should call, visit, schedule, or escalate.

Suggested formula for MVP:

```text
Combined Action Priority = max(Clinical Risk Score, Care Interruption Risk Score) 
                            + 0.25 * min(Clinical Risk Score, Care Interruption Risk Score)
```

This gives strong weight to either clinical risk or care interruption risk while still recognizing compounding risk.

Alternative simpler version:

```text
Combined Action Priority = 0.6 * Clinical Risk Score + 0.4 * Care Interruption Risk Score
```

The final formula should be validated with clinical and operational users during Sprint 2.

---

## 7. Priority Thresholds
> **Presenter side note:** Present this section as: Thresholds make the queue usable and prevent every case from looking equally urgent.
> **What led you to think of this and formulate this strategy or solution?** Thresholds make the queue usable and prevent every case from looking equally urgent. I expect these thresholds to be tuned during the pilot with frontline feedback.

| Combined Score | Priority | SLA | Example Action |
|---:|---|---|---|
| 70+ | Red | Today | Call, review, or escalate today |
| 50-69 | Orange | 48 hours | Schedule follow-up or outreach |
| 30-49 | Yellow | 7 days | Monitor and plan follow-up |
| <30 | Green | Routine | Continue routine care |

---

## 8. Example Explanations
> **Presenter side note:** Present this section as: Examples help interviewers see how the score becomes understandable to users.
> **What led you to think of this and formulate this strategy or solution?** Examples help interviewers see how the score becomes understandable to users. Each explanation must show the reasons behind priority, not just a red or orange label.

### Example 1: Pregnant woman

```json
{
  "priority": "red",
  "clinical_score": 65,
  "interruption_score": 72,
  "reasons": [
    "Hypertension registered",
    "34 weeks pregnant",
    "Missed last prenatal appointment",
    "No documented contact in 14 days"
  ],
  "recommended_action": "Call today and assess need for referral review"
}
```

### Example 2: Postpartum woman

```json
{
  "priority": "orange",
  "clinical_score": 40,
  "interruption_score": 68,
  "reasons": [
    "21 days postpartum",
    "No postpartum follow-up documented",
    "Phone contact marked unstable"
  ],
  "recommended_action": "Schedule postpartum follow-up within 48 hours"
}
```

### Example 3: Newborn

```json
{
  "priority": "red",
  "clinical_score": 50,
  "interruption_score": 75,
  "reasons": [
    "Newborn discharged 12 days ago",
    "No first-month follow-up documented",
    "Mother not contacted after discharge"
  ],
  "recommended_action": "Assign community health agent outreach today"
}
```

---

## 9. Human-in-the-Loop Controls
> **Presenter side note:** Present this section as: These controls are essential because the system supports care teams but does not replace them.
> **What led you to think of this and formulate this strategy or solution?** These controls are essential because the system supports care teams but does not replace them. Manual override and review keep clinical accountability with humans.

Users may:

- review explanations;
- update missing data;
- override priority;
- add notes;
- escalate manually;
- mark action outcome.

Manual override requires a reason.

---

## 10. Score Monitoring
> **Presenter side note:** Present this section as: Monitoring is needed to catch bias, overload, and false prioritization.
> **What led you to think of this and formulate this strategy or solution?** Monitoring is needed to catch bias, overload, and false prioritization. A score that looks good technically can still fail operationally if it creates too many alerts.

During pilot, monitor:

- distribution of red/orange/yellow/green cases;
- most common reason codes;
- percentage of red/orange cases acted on within SLA;
- manual override rate;
- false positive feedback from users;
- missed cases identified by staff that were not prioritized.

---

## 11. Tuning Process
> **Presenter side note:** Present this section as: The tuning process makes the model collaborative.
> **What led you to think of this and formulate this strategy or solution?** The tuning process makes the model collaborative. Clinicians and frontline users should help calibrate what counts as urgent in the local context.

Scoring should be reviewed weekly during pilot.

Questions to ask:

- Are too many cases marked red?
- Are high-risk cases missing from the queue?
- Are explanations understandable?
- Are recommended actions realistic?
- Does queue volume match UBS capacity?
- Are postpartum and newborn cases being prioritized enough?

---

## 12. Safety Boundary
> **Presenter side note:** Present this section as: The safety boundary protects the product from becoming an unsafe clinical decision tool.
> **What led you to think of this and formulate this strategy or solution?** The safety boundary protects the product from becoming an unsafe clinical decision tool. The AI prioritizes action; it does not diagnose, prescribe, or deny care.

The scoring system does not provide diagnosis or treatment recommendations. It only supports operational prioritization and escalation.


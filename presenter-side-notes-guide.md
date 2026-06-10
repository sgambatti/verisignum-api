# Presenter Side Notes Guide — SINAL-MI

This repository version includes short presenter side notes under each major section of the required documents. The notes are written for a technical interview audience: product manager, solution architect, AI engineer, and developer.

Each note answers the recurring interview question:

> **What led you to think of this and formulate this strategy or solution?**

Use these notes as speaking cues, not as a script. The intended presentation style is: explain the product decision, connect it to evidence from the prompt, and show why the scope is technically feasible for a small team.

## Recommended Presentation Flow

1. Start with `README.md` to explain the thesis and project scope.
2. Move to `docs/pdr.md` to defend product choices, users, features, and metrics.
3. Use `docs/technical-spec.md` to answer architecture, data, AI, security, and implementation questions.
4. Use `docs/workplan.md` to show delivery discipline, backlog prioritization, and sprint execution.
5. Reference `docs/research-notes.md` only when asked about external inspiration.
6. Reference `docs/risk-scoring.md` when asked how the AI prioritization works.

## Core Storyline

SINAL-MI does not try to solve the entire maternal and infant mortality problem in phase one. It targets a specific operational gap: frontline teams do not have a reliable daily way to know which mothers and newborns need action, why they are at risk, and what should happen next.

The AI strategy is intentionally practical: explainable prioritization first, predictive modeling later, and controlled generative AI only for referral summaries.

---
title: "AI skills that will not let you be wrong in peace"
description: "Peer reviewers and accountability mechanisms for agents — not cheerleaders."
published: 2026-07-12
repo: "https://github.com/arunveersingh/ai"
topics: ["ai", "agents", "skills"]
problem: "Smart assistants make it easier to be wrong, confidently. These skills refuse to proceed on unverified assumptions."
manual: true
---

Most prompt packs try to make the model more helpful. This repo does the opposite. It packages **standards** as [Agent Skills](https://github.com/arunveersingh/ai): blocks, gates, and follow-ups that close the loop.

The rule: AI’s job is not to make you happy. It is to force you not to make mistakes.

## What is in the box

**Thinking**

- [adversarial-collaborator](https://github.com/arunveersingh/ai/tree/main/skills/adversarial-collaborator) — no round limits. Requires demonstrated updates.
- [assumption-surfacer](https://github.com/arunveersingh/ai/tree/main/skills/assumption-surfacer) — contradicted assumptions must be resolved before you continue.
- [decision-pressure-tester](https://github.com/arunveersingh/ai/tree/main/skills/decision-pressure-tester) — refuses to proceed past critical failures.
- [first-principles-decomposer](https://github.com/arunveersingh/ai/tree/main/skills/first-principles-decomposer) — will not derive from a guess.
- [pre-mortem-oracle](https://github.com/arunveersingh/ai/tree/main/skills/pre-mortem-oracle) — will say do not proceed.
- [recontextualizer](https://github.com/arunveersingh/ai/tree/main/skills/recontextualizer) — you must prove you own the code you just shipped.

**Synthesis, research, code, writing, learning**

- [concept-synthesizer](https://github.com/arunveersingh/ai/tree/main/skills/concept-synthesizer) — no aesthetic resonance without a falsifiable prediction.
- [bayesian-belief-tracker](https://github.com/arunveersingh/ai/tree/main/skills/bayesian-belief-tracker) — blocks motivated reasoning.
- [bug-hypothesis-generator](https://github.com/arunveersingh/ai/tree/main/skills/bug-hypothesis-generator) — “be more careful” is not a fix.
- [editor-not-writer](https://github.com/arunveersingh/ai/tree/main/skills/editor-not-writer) — will say not ready.
- [learning-partner](https://github.com/arunveersingh/ai/tree/main/skills/learning-partner) — “I get it” is not verification.

## How to use it

Point any Agent Skills–compatible tool at the `skills/` directory, or paste a `SKILL.md` as a system prompt. Compatible with Claude Code, Cursor, GitHub Copilot, Gemini CLI, Windsurf, and others.

Source: [github.com/arunveersingh/ai](https://github.com/arunveersingh/ai). Apache 2.0.

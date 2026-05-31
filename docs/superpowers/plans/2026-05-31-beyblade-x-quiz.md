# BEYBLADE X Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, mobile-first browser quiz where players identify BEYBLADE X blades, ratchets, and bits from official part images, with 10-second timed questions.

**Architecture:** Use a dependency-free static app. Keep quiz state in pure JavaScript modules so it can be tested with Node's built-in test runner, and keep DOM rendering isolated in `src/app.js`.

**Tech Stack:** HTML, CSS, modern browser JavaScript modules, Node `node:test`, Python simple HTTP server for local preview.

---

## File Structure

- Create `package.json` with `test` and `serve` scripts.
- Create `index.html` for the app shell.
- Create `src/beyblades.js` for official BEYBLADE X part quiz data.
- Create `src/quizEngine.js` for deterministic quiz generation and scoring.
- Create `src/app.js` for DOM rendering and interactions.
- Create `src/styles.css` for mobile-first visual design.
- Create `test/quizEngine.test.mjs` for behavior tests.
- Create `README.md` for local usage and source notes.

### Task 1: Logic Tests

**Files:**
- Create: `package.json`
- Create: `test/quizEngine.test.mjs`

- [ ] Write tests for question generation, same-category answer choices, passing score, double-answer prevention, timed-out answers, and official part-image URL validation.
- [ ] Run `npm test` and confirm the suite fails because `src/quizEngine.js` and `src/beyblades.js` do not exist yet.

### Task 2: Quiz Data And Engine

**Files:**
- Create: `src/beyblades.js`
- Create: `src/quizEngine.js`

- [ ] Add official BEYBLADE X blade, ratchet, and bit data items, including 30+ blade varieties.
- [ ] Implement seeded shuffling, 10-question challenge creation with every part category included, 4-answer option generation, answer recording, timeout recording, and result calculation.
- [ ] Run `npm test` and confirm all logic tests pass.

### Task 3: Browser UI

**Files:**
- Create: `index.html`
- Create: `src/app.js`
- Create: `src/styles.css`

- [ ] Build start, question, feedback, and result screens with official-site-inspired dark X-line styling.
- [ ] Add a 10-second countdown timer with visual pressure and automatic time-up feedback.
- [ ] Add ruby annotations for difficult UI kanji.
- [ ] Make touch targets large, layout stable, and image area responsive for mobile.
- [ ] Show a graceful image fallback message if a remote official image fails to load.

### Task 4: Docs And Verification

**Files:**
- Create: `README.md`

- [ ] Document how to run locally.
- [ ] Document that images are loaded from official Takara Tomy URLs and should be rights-checked before public deployment.
- [ ] Run `npm test`.
- [ ] Start a local server and verify the app renders in a browser-sized mobile viewport.

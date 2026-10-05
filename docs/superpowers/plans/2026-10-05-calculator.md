# Margin Shop Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task by task.

**Goal:** Deliver a tested offline-capable single-page Korean clothing margin calculator.
**Architecture:** Pure calculation and storage modules, a static HTML interface and focused DOM bindings. Standard-library build inlines locally compiled Tailwind, custom CSS and JS into one distributable.
**Tech Stack:** Vanilla ES modules, precompiled Tailwind 4.1.10, Node 22 built-in test runner, Chromium/Playwright.
**Spec:** `docs/superpowers/specs/2026-10-05-calculator-design.md`

## Global Constraints
No backend, database, login, tracking, network APIs or runtime CDN. Money limited to 1 billion KRW. Direct price untouched by rounding. No official-fee or tax-accuracy guarantees.

## Review Focus
- Zero/empty/extreme prices: no NaN, Infinity, negative bars or stale results.
- Near-limit target margin and zero-VAT transition: correct solvability and actual achieved margin.
- Comma editing with Backspace/Delete in the middle: stable caret and intended deletion.
- Corrupt or inaccessible LocalStorage and blocked clipboard: calculation remains usable.
- Mobile 320px, keyboard, offline file and external requests: fully usable without network.

### Task 1 — Calculation, formatting and persistence
Files: `src/calculator.mjs`, `src/storage.mjs`, `tests/*.test.mjs`.
Interfaces: `calculate(settings)`, `evaluate(settings, price)`, `solveTarget(settings, percent)`, `roundPrice(value,unit,ending,up)`, `formatInput(value)`, `loadSettings(storage)`, `saveSettings(storage,state)`.
- [x] Write failing assertions for defaults, all modes, VAT credit, fee basis, losses, edge values, rounding, storage schema and failures.
- [x] Run `node --test tests/*.test.mjs`; confirm missing implementation failure.
- [x] Implement pure functions and run full suite green.
- [x] Commit task and record evidence.

### Task 2 — Interactive interface and artifact build
Files: `src/template.html`, `src/styles.css`, `src/tailwind.css`, `src/app.mjs`, `scripts/build.mjs`, `scripts/serve.mjs`, `package.json`.
- [x] Add browser assertions for input update, modes, presets, storage, clipboard, reset and mobile layout before implementation.
- [x] Build semantic forms, result panels, static guides, privacy and formula dialogs; retain focus when results update.
- [x] Create reproducible standalone `index.html` and `dist/index.html` with no dependency installation.
- [x] Run browser assertions and inspect desktop/mobile screenshots; fix evidence-backed defects.

### Task 3 — Delivery and review
Files: `README.md`, `.gitignore`, `THIRD_PARTY_NOTICES.md`, `.github/workflows/ci.yml`.
- [x] Verify Node suite (38), production build, standalone Chromium DOM rendering (18) and script syntax. Native URL navigation is blocked by container browser policy; real-origin suite is retained for CI and not claimed passed locally.
- [x] Review entire source against spec; document assumptions and limits.
- [ ] Upload tested code through connected GitHub tools; verify remote files/commit.
- [ ] Provide source ZIP, standalone HTML, screenshots and repository change references. Do not claim deployment.

## Verification ledger
- RED: missing calculation/storage modules; GREEN: original 35 unit cases.
- RED: mobile labels 10px; GREEN: readable labels and 18 browser DOM cases.
- RED: unsafe upward-rounding with shipping surplus and zero target; GREEN: safe-price forward validation, positive target denominator and nonnegative zero break-even.
- 38 unit cases include 2,000 deterministic forward/inverse scenarios.
- DOM rendering issues zero pageerrors; storage and clipboard in this harness are explicit test doubles, not real-origin claims.
- Ruling: no native browser navigation workaround; keep real-origin suite separate and document limitation.

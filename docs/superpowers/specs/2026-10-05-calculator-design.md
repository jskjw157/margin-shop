# Margin Shop — implementation design

## Outcome
A Korean, mobile-first clothing sourcing and selling-price calculator for Dongdaemun resellers. No accounts, network APIs, database, server functions, analytics or runtime CDN. The user explicitly permits a single-file Vanilla JS alternative. Ship a self-contained `index.html`, editable modules, deterministic dependency-free build and automated tests.

## Design
Warm zinc canvas, white bordered input cards, emerald accents, dark-forest price card, generous typography. Desktop: three input sections on the left, live results on the right. Mobile: one column and a compact sticky result shortcut. Native controls, semantic headings, keyboard navigation, focus rings, reduced motion and accessible validation. Static guide content remains readable without JavaScript.

## Calculation contract
All amounts are KRW. Default wholesale 15000, VAT-exclusive checked, sourcing 500, packaging 400, outbound shipping 2800, customer shipping 3000. Default multiplier 2.5, target margin 30%, direct price 38900, nearest 100 rounding and nearest x,900 ending enabled. Requested fee examples: Smartstore 5.8%, Ably 13.5%, Zigzag 12.5%, Coupang Wing 10.8%; not claims of current official rates. Fee percentages are the effective VAT-inclusive amount charged. Optional same-rate fee on customer shipping; off by default.

P = final product price (VAT inclusive); D = customer shipping received (0 when free shipping); W = wholesale including VAT; L = sourcing + packaging + outbound shipping; F = feeRate × (P + optional D). Wholesale VAT = W/11. Multiplier uses wholesale supply price, excluding VAT.

General-taxpayer simplified estimated VAT = max(0, (P+D)/11 - eligible wholesale VAT - optional eligible (L+F)/11). Wholesale input credit on by default; other credits off by default and only valid with eligible VAT-inclusive evidence. Negative VAT credit is not treated as a per-order refund. VAT estimation can be switched off for a before-VAT simulation, not a simplified-taxpayer calculation. Profit = P+D-W-L-F-estimated VAT. Margin = profit/P. Zero price has undefined margin, displayed as a dash. Income tax, ads, coupons, returns and fixed costs are excluded and clearly disclosed.

Target margin: solve the piecewise-linear profit function analytically, including the zero-VAT boundary. Validate solvability and upper price limit. Nearest rounding can lower achieved margin; display the actual margin and validate any upward-rounded alternative against the forward model. When shipping surplus makes margin decrease, never label an insufficient price target-safe. Direct price is never rounded. Monetary inputs bounded at 1 billion won; fee 0..100%; target 0..99.99%; multiple 0..100. Empty optional costs = 0; empty required active input invalid. Reject negative/exponent/foreign-text input rather than silently changing its value.

Graph uses customer total paid, including shipping, so wholesale, fee, gross logistics, estimated VAT and profit reconcile. Loss uses expense-total denominator, with loss shown separately, never negative bar widths. LocalStorage is versioned, whitelisted, bounds-checked and exception-safe. Clipboard API falls back to a selectable text dialog. Reset asks before clearing only this calculator's own key.

## Delivery and verification
Node built-in unit tests for finance, rounding, formatting and persistence; real Chromium interaction tests at desktop and mobile widths, keyboard input, reload, corrupt/blocked storage, copy success/failure and no outbound requests. Exact offline-file test. Build and verify single HTML before committing. Initialize empty repository and provide code on a feature branch/PR without overwriting existing work or claiming a production deployment.

## Sources
- https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7696&mi=2274
- https://tailwindcss.com/docs/installation/using-vite (compiled CSS approach)

## Implementation ruling
The execution container cannot resolve registry.npmjs.org; no Vite/React packages are installed. Use the user's permitted Vanilla alternative and locally available Tailwind 4.1.10 compiler to generate CSS once. All shipped build/test scripts use only Node standard library; browser tests use Playwright. This avoids an unverifiable dependency installation or runtime CDN dependency.

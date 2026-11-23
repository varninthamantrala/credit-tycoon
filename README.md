# Credit Underwriting & Default Risk Tycoon

A 10-quarter credit-risk strategy game. React + TypeScript + Tailwind + Recharts + Lucide. No backend.

```bash
npm install
npm run dev      # play at http://localhost:5173
npm test         # engine unit tests (vitest)
npm run build    # type-check + production build
npm run sim      # policy simulations used to calibrate difficulty and grades
```

Keys: `1` approve, `2` approve + premium, `3` reject, `Enter` continue.

## Engine (`src/engine/creditSim.ts`)
Pure and deterministic: every random draw is hash(seed, purpose, round, index), so a seed replays identically.

- Hidden PD: logistic on credit score, DTI, tenure and the alternative signal; scaled by the macro default multiplier.
  The player sees only a noisy A-E grade (log-odds noise, sigma 0.6).
- Risk premium (+3.5% APR) adds a DTI-dependent log-odds bump (moral hazard).
- Settlement per quarter: interest = balance x APR/4; funding = deployed x funding/4; each active loan rolls a default
  with quarterly PD; loss = 70% of balance. Loans are bullet loans that mature after 6-12 quarters.
- Leverage cap: deployed capital <= 4x capital buffer. Insolvency: buffer < $250k.
- RAROC = annualised (interest - funding - realised losses) / (12% x avg deployed + $25k economic capital).
  Grades: S >= 18%, A >= 10%, B >= 4%, C >= 0, F below 0 or insolvent.
- Audit: TP = good loan approved and performed; FP = bad (hidden PD >= 8%) or defaulted loan approved;
  FN = good borrower rejected; TN = bad borrower rejected.

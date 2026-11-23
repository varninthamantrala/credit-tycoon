// Runs simple policies over many seeds to calibrate the RAROC grade thresholds.
import { newGame, decide, nextQuarter, computeMetrics, currentBorrower, quote, annualPD, CONFIG, type GameState, type Borrower, type Action } from '../src/engine/creditSim';

type Policy = (s: GameState, b: Borrower) => Action;
const policies: Record<string, Policy> = {
  rejectAll: () => 'reject',
  approveAllStd: () => 'standard',
  approveAllPremium: () => 'premium',
  gradeABC: (_s, b) => (['A', 'B', 'C'].includes(b.grade) ? 'standard' : 'reject'),
  gradeABCD_prem: (_s, b) => (['A', 'B', 'C'].includes(b.grade) ? 'standard' : b.grade === 'D' ? 'premium' : 'reject'),
  gradeAB: (_s, b) => (['A', 'B'].includes(b.grade) ? 'standard' : 'reject'),
  oracle: (s, b) => {
    const pd = annualPD(b, false, s.regime.defaultMult);
    const std = quote(s, b, 'standard');
    // expected annual margin after losses
    return std.apr - s.regime.fundingRate - pd * CONFIG.lgd > 0.025 ? 'standard' : 'reject';
  },
};

function play(seed: string, p: Policy) {
  let s = newGame(seed);
  while (s.phase !== 'gameover') {
    if (s.phase === 'settlement') { s = nextQuarter(s); continue; }
    const b = currentBorrower(s)!;
    let a = p(s, b);
    if (a !== 'reject' && !quote(s, b, a).eligible) a = 'reject';
    s = decide(s, a);
  }
  return computeMetrics(s);
}

const N = 300;
for (const [name, p] of Object.entries(policies)) {
  const rs: number[] = [];
  let insolv = 0;
  for (let i = 0; i < N; i++) {
    const m = play('S' + i, p);
    rs.push(m.raroc);
    if (m.quarters < CONFIG.rounds) insolv++;
  }
  rs.sort((a, b) => a - b);
  const q = (x: number) => (rs[Math.floor(x * (N - 1))] * 100).toFixed(1);
  console.log(name.padEnd(18), `p10 ${q(0.1)}%  p25 ${q(0.25)}%  med ${q(0.5)}%  p75 ${q(0.75)}%  p90 ${q(0.9)}%  insolvent ${(insolv / N * 100).toFixed(0)}%`);
}

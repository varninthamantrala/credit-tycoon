/**
 * Credit Underwriting & Default Risk Tycoon: simulation engine.
 *
 * Pure, deterministic and UI-free. Every random draw is derived from
 * hash(seed, purpose, round, index), so the same seed always yields the same
 * applicants, macro schedule and default rolls, whatever order the player acts in.
 * All state transitions return new objects (no mutation of the input state).
 */

// ───────────────────────── configuration ─────────────────────────

export const CONFIG = {
  rounds: 10,
  startBuffer: 1_000_000,
  insolvencyFloor: 250_000,
  startFunding: 0.045,
  premiumApr: 0.035,
  lgd: 0.7, // loss given default: 30% recovery
  leverageCap: 4, // max deployed capital = 4x capital buffer
  goodPdThreshold: 0.08, // annual PD below this = a "good" (profitable) borrower
  maxAnnualPD: 0.9,
} as const;

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';
export type ScoreGrade = 'S' | 'A' | 'B' | 'C' | 'F';
export type Action = 'standard' | 'premium' | 'reject';
export type Phase = 'underwriting' | 'settlement' | 'gameover';
export type EventId = 'rate_hike' | 'supply_chain' | 'boom' | 'recession' | 'rate_cut' | 'recovery';

export const STANDARD_RATE: Record<Grade, number> = { A: 0.09, B: 0.105, C: 0.12, D: 0.13, E: 0.14 };

// ───────────────────────── seeded randomness ─────────────────────────

export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rngFor = (seed: string, ...parts: (string | number)[]): Rng => mulberry32(hashSeed(seed, ...parts));

function gauss(r: Rng): number {
  const u = Math.max(r(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ───────────────────────── types ─────────────────────────

export interface Regime {
  name: string;
  fundingRate: number; // annual wholesale funding cost
  defaultMult: number; // multiplier on annual PD
  demandBoost: boolean; // consumer boom: more and larger applications
}

export interface MacroEvent {
  id: EventId;
  headline: string;
  detail: string;
  severity: 'good' | 'warn' | 'bad';
}

export interface Signal {
  label: string;
  tone: 'positive' | 'neutral' | 'negative';
  effect: number; // log-odds contribution (hidden)
}

export interface Borrower {
  id: string;
  name: string;
  business?: string;
  purpose: string;
  amount: number;
  score: number;
  dti: number; // percent
  tenure: number; // years
  signal: Signal;
  termQuarters: number;
  grade: Grade; // noisy internal estimate (what the player sees)
  logit: number; // HIDDEN true log-odds of annual default, excluding macro and premium
}

export interface Loan {
  id: string;
  borrowerId: string;
  name: string;
  purpose: string;
  principal: number;
  balance: number;
  apr: number;
  premium: boolean;
  annualPD: number; // includes premium effect, excludes macro
  grade: Grade;
  term: number;
  originRound: number;
  status: 'active' | 'defaulted' | 'repaid';
  interestEarned: number;
  lossTaken: number;
}

export interface Decision {
  borrowerId: string;
  name: string;
  round: number;
  action: Action;
  amount: number;
  baseAnnualPD: number;
  good: boolean;
  defaulted: boolean;
  expectedNet: number; // expected net interest over the loan life if it performs
  loanId?: string;
}

export interface QuarterRecord {
  round: number;
  regimeName: string;
  fundingRate: number;
  defaultMult: number;
  bufferStart: number;
  bufferEnd: number;
  deployedStart: number;
  interest: number;
  funding: number;
  losses: number;
  net: number;
  defaultedLoans: { name: string; loss: number }[];
  repaid: number;
  cumLosses: number;
  cumDefaults: number;
}

export interface GameState {
  seed: string;
  round: number;
  phase: Phase;
  applicants: Borrower[];
  index: number;
  loans: Loan[];
  decisions: Decision[];
  buffer: number;
  regime: Regime;
  schedule: Partial<Record<number, EventId>>;
  activeEventId: EventId | null;
  eventLog: { round: number; id: EventId }[];
  history: QuarterRecord[];
  lastSettlement: QuarterRecord | null;
  insolvent: boolean;
}

// ───────────────────────── macro events ─────────────────────────

export const EVENTS: Record<EventId, MacroEvent> = {
  rate_hike: {
    id: 'rate_hike',
    headline: 'Central Bank Rate Hike: Funding Cost +2.0%',
    detail: 'Wholesale funding reprices higher. Thin-margin loans may no longer pay for themselves.',
    severity: 'warn',
  },
  supply_chain: {
    id: 'supply_chain',
    headline: 'Regional Supply-Chain Slowdown: Default Risk +35%',
    detail: 'Small businesses and leveraged households feel the squeeze. Every borrower is riskier.',
    severity: 'bad',
  },
  boom: {
    id: 'boom',
    headline: 'Consumer Boom: Loan Demand Surges',
    detail: 'More applicants, larger tickets, slightly lower defaults. Mind the leverage cap.',
    severity: 'good',
  },
  recession: {
    id: 'recession',
    headline: 'Credit Crunch: Unemployment Spikes, Default Risk +50%',
    detail: 'Layoffs ripple through the book and funding markets tighten (+1.0%).',
    severity: 'bad',
  },
  rate_cut: {
    id: 'rate_cut',
    headline: 'Central Bank Rate Cut: Funding Cost -1.5%',
    detail: 'Cheaper wholesale funding widens your net interest margin.',
    severity: 'good',
  },
  recovery: {
    id: 'recovery',
    headline: 'Soft Landing: Default Pressure Eases',
    detail: 'Delinquencies normalise and demand returns to trend.',
    severity: 'good',
  },
};

export const INITIAL_REGIME: Regime = {
  name: 'Stable Growth',
  fundingRate: CONFIG.startFunding,
  defaultMult: 1,
  demandBoost: false,
};

export function applyEvent(r: Regime, id: EventId): Regime {
  switch (id) {
    case 'rate_hike':
      return { ...r, name: 'Tightening Cycle', fundingRate: r.fundingRate + 0.02, demandBoost: false };
    case 'supply_chain':
      return { ...r, name: 'Supply-Chain Stress', defaultMult: r.defaultMult * 1.35, demandBoost: false };
    case 'boom':
      return { ...r, name: 'Consumer Boom', defaultMult: r.defaultMult * 0.92, demandBoost: true };
    case 'recession':
      return { ...r, name: 'Credit Crunch', defaultMult: r.defaultMult * 1.5, fundingRate: r.fundingRate + 0.01, demandBoost: false };
    case 'rate_cut':
      return { ...r, name: 'Easing Cycle', fundingRate: Math.max(0.02, r.fundingRate - 0.015), demandBoost: false };
    case 'recovery':
      return { ...r, name: 'Recovery', defaultMult: 1 + (r.defaultMult - 1) * 0.3, demandBoost: false };
  }
}

/** Events fire every 2-3 rounds, starting in round 2 or 3. Choice is regime-aware but seeded. */
export function buildSchedule(seed: string): Partial<Record<number, EventId>> {
  const r = rngFor(seed, 'schedule');
  const schedule: Partial<Record<number, EventId>> = {};
  let regime = INITIAL_REGIME;
  let last: EventId | null = null;
  let round = 2 + Math.floor(r() * 2);
  while (round <= CONFIG.rounds) {
    const weights: [EventId, number][] = [
      ['rate_hike', regime.fundingRate > 0.06 ? 0.4 : 1.4],
      ['supply_chain', regime.defaultMult > 1.3 ? 0.5 : 1.3],
      ['boom', regime.demandBoost ? 0 : 1],
      ['recession', regime.defaultMult > 1.25 ? 0.2 : 0.8],
      ['rate_cut', regime.fundingRate > 0.05 ? 1.3 : 0.3],
      ['recovery', regime.defaultMult > 1.15 ? 1.8 : 0.3],
    ];
    const pool = weights.filter(([id, w]) => id !== last && w > 0);
    const total = pool.reduce((s, [, w]) => s + w, 0);
    let x = r() * total;
    let chosen = pool[0][0];
    for (const [id, w] of pool) {
      x -= w;
      if (x <= 0) {
        chosen = id;
        break;
      }
    }
    schedule[round] = chosen;
    regime = applyEvent(regime, chosen);
    last = chosen;
    round += 2 + Math.floor(r() * 2);
  }
  return schedule;
}

// ───────────────────────── borrower generation ─────────────────────────

const FIRST = ['Marisol', 'Dev', 'Hannah', 'Tomasz', 'Aisha', 'Kenji', 'Priya', 'Luca', 'Imani', 'Mateo', 'Ingrid', 'Rahul', 'Chloe', 'Omar', 'Yuki', 'Bianca', 'Nikolai', 'Zainab', 'Declan', 'Sofia', 'Anders', 'Leila', 'Marcus', 'Tanvi'];
const LAST = ['Vega', 'Patel', 'Okafor', 'Novak', 'Tanaka', 'Reyes', 'Lindqvist', 'Haddad', 'Kowalski', 'Mensah', 'Rossi', 'Sharma', 'Dubois', 'Fischer', 'Alvarez', 'Chen', 'Brennan', 'Nakamura', 'Costa', 'Whitfield'];
const BIZ = ['Bakehouse', 'Logistics', 'Auto Works', 'Dental Studio', 'Print Co.', 'Landscaping', 'Cafe', 'Fabrication', 'Fitness', 'Catering'];

interface PurposeDef {
  name: string;
  min: number;
  max: number;
  term: [number, number];
  business: boolean;
}

const PURPOSES: PurposeDef[] = [
  { name: 'Small Business Expansion', min: 35_000, max: 150_000, term: [8, 12], business: true },
  { name: 'Debt Consolidation', min: 15_000, max: 80_000, term: [8, 11], business: false },
  { name: 'Equipment Lease', min: 25_000, max: 120_000, term: [6, 10], business: true },
  { name: 'Emergency Medical', min: 10_000, max: 40_000, term: [6, 9], business: false },
  { name: 'Home Renovation', min: 20_000, max: 90_000, term: [8, 12], business: false },
  { name: 'Working Capital Line', min: 20_000, max: 100_000, term: [6, 10], business: true },
];

const POSITIVE = (r: Rng): Signal[] => [
  { label: `On-time rent/utility streak: ${[12, 18, 24, 30, 36][Math.floor(r() * 5)]} mos`, tone: 'positive', effect: -0.5 },
  { label: `Stable payroll deposits: ${[12, 18, 24][Math.floor(r() * 3)]} mos`, tone: 'positive', effect: -0.35 },
  { label: `Merchant cash-flow growing +${10 + Math.floor(r() * 20)}% YoY`, tone: 'positive', effect: -0.4 },
  { label: `Low credit utilization (${8 + Math.floor(r() * 14)}%)`, tone: 'positive', effect: -0.3 },
];
const NEGATIVE = (r: Rng): Signal[] => [
  { label: 'Recent overdraft spikes', tone: 'negative', effect: 0.55 },
  { label: `${2 + Math.floor(r() * 3)} missed utility payments in 12 mos`, tone: 'negative', effect: 0.6 },
  { label: 'Rising cash-advance usage', tone: 'negative', effect: 0.5 },
  { label: `Revenue volatility ±${30 + Math.floor(r() * 20)}%`, tone: 'negative', effect: 0.4 },
];
const NEUTRAL: Signal[] = [
  { label: 'Thin file: limited alternative data', tone: 'neutral', effect: 0.05 },
  { label: 'Mixed payment history, no clear trend', tone: 'neutral', effect: 0 },
];

/** Hidden true log-odds of default over one year, before macro and premium effects. */
export function computeLogit(score: number, dti: number, tenure: number, signalEffect: number): number {
  return -1.4 + (720 - score) * 0.012 + (dti - 30) * 0.045 - tenure * 0.07 + signalEffect;
}

export function gradeFromPD(pd: number): Grade {
  if (pd < 0.015) return 'A';
  if (pd < 0.04) return 'B';
  if (pd < 0.09) return 'C';
  if (pd < 0.2) return 'D';
  return 'E';
}

/** Moral-hazard bump: a bigger repayment burden raises default odds, more so for stretched borrowers. */
export function premiumLogitBump(dti: number): number {
  return 0.15 + 0.4 * (dti / 100);
}

export function generateBorrower(seed: string, round: number, i: number, regime: Regime): Borrower {
  const r = rngFor(seed, 'borrower', round, i);
  const purpose = pick(r, PURPOSES);
  const score = Math.round(clamp(675 + gauss(r) * 55, 540, 810));
  const dti = Math.round(clamp(36 - (score - 675) * 0.08 + gauss(r) * 10, 12, 62));
  const tenure = Math.round((0.5 + Math.pow(r(), 1.5) * 11.5) * 2) / 2;

  const edge = (score - 675) / 600;
  const roll = r();
  const pPos = clamp(0.35 + edge, 0.1, 0.65);
  const pNeg = clamp(0.28 - edge, 0.08, 0.5);
  const signal =
    roll < pPos ? pick(r, POSITIVE(r)) : roll < pPos + pNeg ? pick(r, NEGATIVE(r)) : pick(r, NEUTRAL);

  const boom = regime.demandBoost ? 1.25 : 1;
  const rawAmount = purpose.min + r() * (purpose.max - purpose.min) * boom;
  const amount = clamp(Math.round(rawAmount / 5000) * 5000, 10_000, 150_000);
  const termQuarters = purpose.term[0] + Math.floor(r() * (purpose.term[1] - purpose.term[0] + 1));
  const first = pick(r, FIRST);
  const last = pick(r, LAST);
  const logit = computeLogit(score, dti, tenure, signal.effect);
  const noisy = sigmoid(logit + gauss(r) * 0.6);

  return {
    id: `R${round}-${i + 1}`,
    name: `${first} ${last}`,
    business: purpose.business ? `${last} ${pick(r, BIZ)}` : undefined,
    purpose: purpose.name,
    amount,
    score,
    dti,
    tenure,
    signal,
    termQuarters,
    grade: gradeFromPD(noisy),
    logit,
  };
}

export function generateApplicants(seed: string, round: number, regime: Regime): Borrower[] {
  const r = rngFor(seed, 'count', round);
  const count = regime.demandBoost ? 4 : 3 + (r() < 0.5 ? 1 : 0);
  return Array.from({ length: count }, (_, i) => generateBorrower(seed, round, i, regime));
}

// ───────────────────────── risk math ─────────────────────────

/** Annual PD for a borrower. `premium` applies the moral-hazard bump; `mult` is the macro multiplier. */
export function annualPD(b: Pick<Borrower, 'logit' | 'dti'>, premium: boolean, mult = 1): number {
  const z = b.logit + (premium ? premiumLogitBump(b.dti) : 0);
  return Math.min(CONFIG.maxAnnualPD, sigmoid(z) * mult);
}

export const quarterlyPD = (annual: number, mult: number): number =>
  1 - Math.pow(1 - Math.min(CONFIG.maxAnnualPD, annual * mult), 0.25);

/** The hidden, macro-adjusted PD the engine would use today (for dev tools and tests only). */
export const truePD = (b: Borrower, regime: Regime, premium = false): number => annualPD(b, premium, regime.defaultMult);

// ───────────────────────── state transitions ─────────────────────────

export function newGame(seed: string = randomSeed()): GameState {
  return {
    seed,
    round: 1,
    phase: 'underwriting',
    applicants: generateApplicants(seed, 1, INITIAL_REGIME),
    index: 0,
    loans: [],
    decisions: [],
    buffer: CONFIG.startBuffer,
    regime: INITIAL_REGIME,
    schedule: buildSchedule(seed),
    activeEventId: null,
    eventLog: [],
    history: [],
    lastSettlement: null,
    insolvent: false,
  };
}

export const currentBorrower = (s: GameState): Borrower | null => (s.phase === 'underwriting' ? s.applicants[s.index] ?? null : null);

export const deployed = (s: GameState): number => s.loans.filter((l) => l.status === 'active').reduce((t, l) => t + l.balance, 0);
export const exposureLimit = (s: GameState): number => Math.max(0, s.buffer) * CONFIG.leverageCap;
export const activeLoans = (s: GameState): Loan[] => s.loans.filter((l) => l.status === 'active');

export interface Quote {
  apr: number;
  spread: number; // APR minus current funding cost
  premium: boolean;
  eligible: boolean;
  reason?: string;
}

export function quote(s: GameState, b: Borrower, action: Exclude<Action, 'reject'>): Quote {
  const premium = action === 'premium';
  const apr = STANDARD_RATE[b.grade] + (premium ? CONFIG.premiumApr : 0);
  const over = deployed(s) + b.amount > exposureLimit(s);
  return {
    apr,
    premium,
    spread: apr - s.regime.fundingRate,
    eligible: !over,
    reason: over ? `Exceeds ${CONFIG.leverageCap}x leverage cap` : undefined,
  };
}

const expectedNet = (amount: number, apr: number, funding: number, term: number) => (amount * (apr - funding) * (term + 1)) / 8;

export function decide(s: GameState, action: Action): GameState {
  const b = currentBorrower(s);
  if (!b) throw new Error('No applicant to decide on');
  const baseAnnualPD = annualPD(b, false, 1);
  const good = baseAnnualPD < CONFIG.goodPdThreshold;
  const stdApr = STANDARD_RATE[b.grade];
  const decision: Decision = {
    borrowerId: b.id,
    name: b.name,
    round: s.round,
    action,
    amount: b.amount,
    baseAnnualPD,
    good,
    defaulted: false,
    expectedNet: expectedNet(b.amount, stdApr, s.regime.fundingRate, b.termQuarters),
  };
  let loans = s.loans;
  if (action !== 'reject') {
    const q = quote(s, b, action);
    if (!q.eligible) throw new Error(q.reason);
    const loan: Loan = {
      id: `L-${b.id}`,
      borrowerId: b.id,
      name: b.name,
      purpose: b.purpose,
      principal: b.amount,
      balance: b.amount,
      apr: q.apr,
      premium: q.premium,
      annualPD: annualPD(b, q.premium, 1),
      grade: b.grade,
      term: b.termQuarters,
      originRound: s.round,
      status: 'active',
      interestEarned: 0,
      lossTaken: 0,
    };
    loans = [...s.loans, loan];
    decision.loanId = loan.id;
  }
  const next: GameState = { ...s, loans, decisions: [...s.decisions, decision], index: s.index + 1 };
  return next.index >= next.applicants.length ? settleQuarter(next) : next;
}

/** Runs quarter-end settlement: interest, funding cost, default rolls, bullet maturities. */
export function settleQuarter(s: GameState): GameState {
  const { regime } = s;
  const bufferStart = s.buffer;
  const deployedStart = deployed(s);
  let interest = 0;
  let losses = 0;
  let repaid = 0;
  const defaultedLoans: { name: string; loss: number }[] = [];
  const defaultedIds = new Set<string>();

  const loans = s.loans.map((l): Loan => {
    if (l.status !== 'active') return l;
    const qpd = quarterlyPD(l.annualPD, regime.defaultMult);
    const roll = rngFor(s.seed, 'default', s.round, l.id)();
    if (roll < qpd) {
      const loss = l.balance * CONFIG.lgd;
      losses += loss;
      defaultedLoans.push({ name: l.name, loss });
      defaultedIds.add(l.id);
      return { ...l, status: 'defaulted', lossTaken: loss, balance: 0 };
    }
    const earned = l.balance * (l.apr / 4);
    interest += earned;
    const matured = s.round - l.originRound + 1 >= l.term;
    if (matured) repaid += l.balance;
    return { ...l, interestEarned: l.interestEarned + earned, balance: matured ? 0 : l.balance, status: matured ? 'repaid' : 'active' };
  });

  const funding = deployedStart * (regime.fundingRate / 4);
  const net = interest - funding - losses;
  const buffer = bufferStart + net;
  const prev = s.history[s.history.length - 1];
  const record: QuarterRecord = {
    round: s.round,
    regimeName: regime.name,
    fundingRate: regime.fundingRate,
    defaultMult: regime.defaultMult,
    bufferStart,
    bufferEnd: buffer,
    deployedStart,
    interest,
    funding,
    losses,
    net,
    defaultedLoans,
    repaid,
    cumLosses: (prev?.cumLosses ?? 0) + losses,
    cumDefaults: (prev?.cumDefaults ?? 0) + defaultedLoans.length,
  };
  const insolvent = buffer < CONFIG.insolvencyFloor;
  const decisions = s.decisions.map((d) => (d.loanId && defaultedIds.has(d.loanId) ? { ...d, defaulted: true } : d));
  return {
    ...s,
    loans,
    decisions,
    buffer,
    history: [...s.history, record],
    lastSettlement: record,
    insolvent,
    phase: insolvent || s.round >= CONFIG.rounds ? 'gameover' : 'settlement',
  };
}

/** Advances from the settlement summary to the next quarter (applies any scheduled macro event). */
export function nextQuarter(s: GameState): GameState {
  if (s.phase !== 'settlement') return s;
  const round = s.round + 1;
  const eventId = s.schedule[round] ?? null;
  const regime = eventId ? applyEvent(s.regime, eventId) : s.regime;
  return {
    ...s,
    round,
    phase: 'underwriting',
    regime,
    activeEventId: eventId,
    eventLog: eventId ? [...s.eventLog, { round, id: eventId }] : s.eventLog,
    applicants: generateApplicants(s.seed, round, regime),
    index: 0,
    lastSettlement: s.lastSettlement,
  };
}

// ───────────────────────── scoring ─────────────────────────

export interface Metrics {
  quarters: number;
  interest: number;
  funding: number;
  losses: number;
  net: number;
  nim: number; // annualised net interest margin on average deployed capital
  raroc: number; // annualised (interest - funding - realised credit losses) / economic capital
  avgBuffer: number;
  defaults: number;
  approved: number;
  rejected: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  missedIncome: number;
  grade: ScoreGrade;
}

/** Economic capital charge used as the RAROC denominator: 12% of average deployed capital plus a 25k operating floor. */
export const ECON_CAPITAL_RATE = 0.12;
export const ECON_CAPITAL_FLOOR = 25_000;

export const GRADE_THRESHOLDS = { S: 0.18, A: 0.1, B: 0.04, C: 0.0 } as const;

export function scoreGrade(raroc: number, insolvent: boolean): ScoreGrade {
  if (insolvent) return 'F';
  if (raroc >= GRADE_THRESHOLDS.S) return 'S';
  if (raroc >= GRADE_THRESHOLDS.A) return 'A';
  if (raroc >= GRADE_THRESHOLDS.B) return 'B';
  if (raroc >= GRADE_THRESHOLDS.C) return 'C';
  return 'F';
}

export function computeMetrics(s: GameState): Metrics {
  const h = s.history;
  const quarters = h.length;
  const sum = (f: (q: QuarterRecord) => number) => h.reduce((t, q) => t + f(q), 0);
  const interest = sum((q) => q.interest);
  const funding = sum((q) => q.funding);
  const losses = sum((q) => q.losses);
  const net = interest - funding - losses;
  const avgBuffer = quarters ? sum((q) => q.bufferStart) / quarters : CONFIG.startBuffer;
  const avgDeployed = quarters ? sum((q) => q.deployedStart) / quarters : 0;
  const nim = avgDeployed > 0 ? ((interest - funding) / quarters) * 4 / avgDeployed : 0;
  const economicCapital = ECON_CAPITAL_FLOOR + ECON_CAPITAL_RATE * avgDeployed;
  const raroc = quarters ? ((net / quarters) * 4) / economicCapital : 0;

  let tp = 0, fp = 0, fn = 0, tn = 0, missedIncome = 0;
  for (const d of s.decisions) {
    if (d.action === 'reject') {
      if (d.good) {
        fn++;
        missedIncome += d.expectedNet;
      } else tn++;
    } else if (d.good && !d.defaulted) tp++;
    else fp++;
  }
  const approved = s.decisions.filter((d) => d.action !== 'reject').length;
  return {
    quarters,
    interest,
    funding,
    losses,
    net,
    nim,
    raroc,
    avgBuffer,
    defaults: h.length ? h[h.length - 1].cumDefaults : 0,
    approved,
    rejected: s.decisions.length - approved,
    tp,
    fp,
    fn,
    tn,
    missedIncome,
    grade: scoreGrade(raroc, s.insolvent),
  };
}

export interface ChartPoint {
  q: number;
  buffer: number;
  cumLosses: number;
}

export function chartSeries(s: GameState): ChartPoint[] {
  return [{ q: 0, buffer: CONFIG.startBuffer, cumLosses: 0 }, ...s.history.map((h) => ({ q: h.round, buffer: Math.round(h.bufferEnd), cumLosses: Math.round(h.cumLosses) }))];
}

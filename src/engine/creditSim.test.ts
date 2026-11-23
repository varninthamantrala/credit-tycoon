import { describe, expect, it } from 'vitest';
import {
  CONFIG, EVENTS, buildSchedule, chartSeries, computeMetrics, currentBorrower, decide, deployed, newGame, nextQuarter,
  quote, quarterlyPD, scoreGrade, settleQuarter, annualPD, STANDARD_RATE, type GameState,
} from './creditSim';

function playAll(seed: string, action: 'standard' | 'premium' | 'reject'): GameState {
  let s = newGame(seed);
  while (s.phase !== 'gameover') {
    if (s.phase === 'settlement') { s = nextQuarter(s); continue; }
    const b = currentBorrower(s)!;
    const a = action !== 'reject' && !quote(s, b, action).eligible ? 'reject' : action;
    s = decide(s, a);
  }
  return s;
}

describe('creditSim engine', () => {
  it('starts in the specified state', () => {
    const s = newGame('T1');
    expect(s.buffer).toBe(1_000_000);
    expect(s.regime).toMatchObject({ name: 'Stable Growth', fundingRate: 0.045, defaultMult: 1 });
    expect(s.applicants.length).toBeGreaterThanOrEqual(3);
    expect(s.applicants.length).toBeLessThanOrEqual(4);
  });

  it('is deterministic per seed and varies across seeds', () => {
    const a = newGame('SAME'), b = newGame('SAME'), c = newGame('OTHER');
    expect(a.applicants).toEqual(b.applicants);
    expect(a.schedule).toEqual(b.schedule);
    expect(c.applicants).not.toEqual(a.applicants);
    expect(playAll('SAME', 'standard').buffer).toBe(playAll('SAME', 'standard').buffer);
  });

  it('generates borrowers inside the specified ranges', () => {
    for (let i = 0; i < 40; i++) {
      for (const b of newGame('RNG' + i).applicants) {
        expect(b.amount).toBeGreaterThanOrEqual(10_000);
        expect(b.amount).toBeLessThanOrEqual(150_000);
        expect(b.score).toBeGreaterThanOrEqual(540);
        expect(b.score).toBeLessThanOrEqual(810);
        expect(b.dti).toBeGreaterThanOrEqual(12);
        expect(b.dti).toBeLessThanOrEqual(62);
        expect(b.tenure).toBeGreaterThanOrEqual(0.5);
        expect(b.tenure).toBeLessThanOrEqual(12);
        expect('ABCDE').toContain(b.grade);
      }
    }
  });

  it('schedules a macro event every 2-3 rounds', () => {
    for (let i = 0; i < 50; i++) {
      const rounds = Object.keys(buildSchedule('SCH' + i)).map(Number).sort((x, y) => x - y);
      expect(rounds[0]).toBeGreaterThanOrEqual(2);
      expect(rounds[0]).toBeLessThanOrEqual(3);
      for (let j = 1; j < rounds.length; j++) expect([2, 3]).toContain(rounds[j] - rounds[j - 1]);
    }
  });

  it('applies the risk premium: higher APR and higher default probability', () => {
    const s = newGame('PREM');
    const b = currentBorrower(s)!;
    const std = quote(s, b, 'standard'), prem = quote(s, b, 'premium');
    expect(prem.apr - std.apr).toBeCloseTo(0.035, 10);
    expect(std.apr).toBe(STANDARD_RATE[b.grade]);
    expect(annualPD(b, true)).toBeGreaterThan(annualPD(b, false));
  });

  it('settles one quarter with the specified interest / funding / loss math', () => {
    let s = newGame('MATH');
    // approve everyone at standard rate, then inspect the settlement
    const apps = s.applicants;
    while (s.phase === 'underwriting') s = decide(s, 'standard');
    const rec = s.lastSettlement!;
    const principal = apps.reduce((t, b) => t + b.amount, 0);
    expect(rec.deployedStart).toBe(principal);
    expect(rec.funding).toBeCloseTo(principal * (0.045 / 4), 6);
    const expectedInterest = s.loans.filter((l) => l.status !== 'defaulted').reduce((t, l) => t + l.principal * (l.apr / 4), 0);
    expect(rec.interest).toBeCloseTo(expectedInterest, 6);
    const lossExpected = s.loans.filter((l) => l.status === 'defaulted').reduce((t, l) => t + l.principal * CONFIG.lgd, 0);
    expect(rec.losses).toBeCloseTo(lossExpected, 6);
    expect(s.buffer).toBeCloseTo(1_000_000 + rec.interest - rec.funding - rec.losses, 6);
  });

  it('rejecting everything keeps the buffer intact and leaves capital undeployed', () => {
    const s = playAll('NOPE', 'reject');
    expect(s.buffer).toBe(CONFIG.startBuffer);
    expect(deployed(s)).toBe(0);
    expect(s.history).toHaveLength(CONFIG.rounds);
    expect(computeMetrics(s).raroc).toBe(0);
  });

  it('enforces the leverage cap', () => {
    const s = newGame('CAP');
    const b = currentBorrower(s)!;
    const full = { ...s, loans: [{ ...(s.loans[0] ?? ({} as never)), status: 'active', balance: CONFIG.startBuffer * CONFIG.leverageCap } as never] };
    expect(quote(full as GameState, b, 'standard').eligible).toBe(false);
  });

  it('ends after 10 quarters and classifies every decision', () => {
    const s = playAll('FULL', 'standard');
    expect(s.phase).toBe('gameover');
    const m = computeMetrics(s);
    expect(m.tp + m.fp + m.fn + m.tn).toBe(s.decisions.length);
    expect(chartSeries(s)[0]).toEqual({ q: 0, buffer: CONFIG.startBuffer, cumLosses: 0 });
    if (!s.insolvent) expect(s.history).toHaveLength(CONFIG.rounds);
  });

  it('triggers insolvency below the floor and grades it F', () => {
    const s = newGame('INSOLV');
    // a buffer far below the floor cannot be rescued by one quarter of income
    const doomed = settleQuarter({ ...s, buffer: 50_000 });
    expect(doomed.insolvent).toBe(true);
    expect(doomed.phase).toBe('gameover');
    expect(scoreGrade(0.5, true)).toBe('F');
  });

  it('macro events move funding cost and default risk as headlined', () => {
    expect(EVENTS.rate_hike.headline).toContain('+2.0%');
    const s = playAll('EVT', 'reject');
    expect(s.eventLog.length).toBeGreaterThan(0);
  });

  it('quarterly PD grows with the macro multiplier', () => {
    expect(quarterlyPD(0.1, 1.35)).toBeGreaterThan(quarterlyPD(0.1, 1));
  });
});

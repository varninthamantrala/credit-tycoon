import { RotateCcw, Shuffle, X } from 'lucide-react';
import { CONFIG, type GameState, computeMetrics } from '../engine/creditSim';
import { cx, pct, usd } from '../lib/format';
import { BufferVsDefaults } from './Charts';

const GRADE_COLOR: Record<string, string> = { S: 'text-cyan border-cyan/60', A: 'text-emerald border-emerald/60', B: 'text-emerald border-emerald/40', C: 'text-amber border-amber/50', F: 'text-crimson border-crimson/60' };
const GRADE_NOTE: Record<string, string> = {
  S: 'Elite underwriter. Exceptional risk-adjusted return.',
  A: 'Strong book. Pricing discipline paid off.',
  B: 'Solid. Profitable, with room to sharpen selection.',
  C: 'Barely earned your cost of capital.',
  F: 'Capital destroyed or the bank failed.',
};

function Cell({ label, value, hint, tone }: { label: string; value: number; hint: string; tone: string }) {
  return (
    <div className={cx('rounded-md border p-3', tone)}>
      <div className="label !text-inherit opacity-80">{label}</div>
      <div className="num mt-1 text-3xl font-bold">{value}</div>
      <div className="mt-1 text-[11px] text-ink/70">{hint}</div>
    </div>
  );
}

export function Audit({ state, onNewSeed, onReplay, onClose }: { state: GameState; onNewSeed: () => void; onReplay: () => void; onClose: () => void }) {
  const m = computeMetrics(state);
  const survived = state.history.length;
  const lines: string[] = [];
  if (state.insolvent) lines.push(`Regulatory insolvency in Q${survived}: the buffer fell to ${usd(state.buffer)}, under the ${usd(CONFIG.insolvencyFloor)} floor.`);
  if (m.fn > 0) lines.push(`You rejected ${m.fn} prime borrower${m.fn > 1 ? 's' : ''}: roughly ${usd(m.missedIncome)} of net interest left on the table.`);
  if (m.fp > 0) lines.push(`${m.fp} approved loan${m.fp > 1 ? 's were' : ' was'} high-risk or defaulted, costing ${usd(m.losses)} in realised losses.`);
  const premiumDefaults = state.decisions.filter((d) => d.action === 'premium' && d.defaulted).length;
  if (premiumDefaults > 0) lines.push(`${premiumDefaults} premium-priced loan${premiumDefaults > 1 ? 's' : ''} defaulted: the extra repayment burden has a cost.`);
  if (m.tp > 0 && m.fp === 0) lines.push('Every approval performed. Clean selection.');
  if (!lines.length) lines.push('A quiet run: little deployed, little earned.');

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-void/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Post-game risk audit">
      <div className="panel mx-auto my-4 max-w-5xl animate-slideUp p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label">Post-game risk audit · seed {state.seed}</div>
            <h2 className="mt-1 text-2xl font-semibold">{state.insolvent ? 'Bank failure: regulators have stepped in' : `Quarter ${CONFIG.rounds} complete: the audit is in`}</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-mute hover:bg-panel2 hover:text-ink" aria-label="Close audit"><X size={18} /></button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className={cx('flex flex-col items-center justify-center rounded-lg border-2 bg-obsidian p-5 text-center', GRADE_COLOR[m.grade])}>
            <div className="label">Final grade</div>
            <div className="num text-8xl font-bold leading-none">{m.grade}</div>
            <div className="num mt-3 text-2xl font-semibold">{pct(m.raroc)}</div>
            <div className="label">RAROC (annualised)</div>
            <p className="mt-3 text-xs text-ink/70">{GRADE_NOTE[m.grade]}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ['Final buffer', usd(state.buffer), state.buffer >= CONFIG.startBuffer ? 'text-emerald' : state.insolvent ? 'text-crimson' : 'text-amber'],
              ['Net interest margin', pct(m.nim), 'text-cyan'],
              ['Quarters survived', `${survived}/${CONFIG.rounds}`, state.insolvent ? 'text-crimson' : 'text-ink'],
              ['Interest earned', usd(m.interest), 'text-emerald'],
              ['Funding paid', usd(-m.funding), 'text-amber'],
              ['Credit losses', usd(-m.losses), 'text-crimson'],
            ].map(([l, v, c]) => (
              <div key={l} className="rounded-md border border-edge bg-obsidian p-3">
                <div className="label">{l}</div>
                <div className={cx('num mt-1 text-xl font-semibold', c)}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-md border border-edge bg-obsidian p-4">
          <div className="label mb-2">Capital buffer vs cumulative defaults</div>
          <BufferVsDefaults state={state} height={260} />
        </div>

        <div className="mt-5">
          <div className="label mb-2">Underwriting breakdown</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cell label="True positives" value={m.tp} hint="Good loans approved, and they performed" tone="border-emerald/40 bg-emerald/10 text-emerald" />
            <Cell label="False positives" value={m.fp} hint="Bad loans approved (high PD or defaulted)" tone="border-crimson/40 bg-crimson/10 text-crimson" />
            <Cell label="False negatives" value={m.fn} hint="Profitable prime borrowers rejected" tone="border-amber/40 bg-amber/10 text-amber" />
            <Cell label="True negatives" value={m.tn} hint="Risky applicants correctly rejected" tone="border-cyan/40 bg-cyan/10 text-cyan" />
          </div>
          <p className="mt-2 text-[11px] text-mute">"Good" means a hidden annual default probability under {pct(CONFIG.goodPdThreshold, 0)} before macro and pricing effects. {m.approved} approved · {m.rejected} rejected · {m.defaults} defaults.</p>
        </div>

        <ul className="mt-4 space-y-1.5 text-sm text-ink/85">
          {lines.map((l) => <li key={l} className="flex gap-2"><span className="text-cyan">▸</span>{l}</li>)}
        </ul>

        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={onNewSeed} className="btn border-cyan/50 bg-cyan/10 text-cyan hover:bg-cyan/20"><Shuffle size={16} /> Play again · new seed</button>
          <button onClick={onReplay} className="btn border-edge bg-panel2 text-ink hover:bg-edge/60"><RotateCcw size={16} /> Replay seed {state.seed}</button>
        </div>
      </div>
    </div>
  );
}

import { Briefcase, Clock, FileSearch, ShieldQuestion } from 'lucide-react';
import { type Borrower, STANDARD_RATE } from '../engine/creditSim';
import { cx, pct, usd } from '../lib/format';

const GRADE_TONE: Record<string, string> = {
  A: 'text-emerald border-emerald/60 bg-emerald/10',
  B: 'text-emerald border-emerald/40 bg-emerald/5',
  C: 'text-amber border-amber/50 bg-amber/10',
  D: 'text-amber border-amber/60 bg-amber/10',
  E: 'text-crimson border-crimson/60 bg-crimson/10',
};

function Meter({ value, min, max, invert, fmt }: { value: number; min: number; max: number; invert?: boolean; fmt: string }) {
  const f = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const health = invert ? 1 - f : f;
  const color = health > 0.62 ? 'bg-emerald' : health > 0.35 ? 'bg-amber' : 'bg-crimson';
  return (
    <div>
      <div className="num text-xl font-semibold">{fmt}</div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-edge">
        <div className={cx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${Math.max(6, f * 100)}%` }} />
      </div>
    </div>
  );
}

export function Dossier({ b, index, total }: { b: Borrower; index: number; total: number }) {
  const sig = {
    positive: 'border-emerald/40 bg-emerald/10 text-emerald',
    neutral: 'border-edge bg-panel2 text-mute',
    negative: 'border-crimson/50 bg-crimson/10 text-crimson',
  }[b.signal.tone];

  return (
    <article key={b.id} className="panel animate-slideIn p-5" aria-label={`Borrower dossier: ${b.name}`}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="label flex items-center gap-2"><FileSearch size={12} /> Applicant {index + 1} of {total} · {b.id}</div>
          <h2 className="mt-1.5 truncate text-2xl font-semibold tracking-tight">{b.name}</h2>
          {b.business && <p className="text-sm text-mute">{b.business}</p>}
        </div>
        <div className="text-center" title="Internal model estimate. It is noisy: the true default probability is hidden.">
          <div className={cx('num flex h-16 w-16 items-center justify-center rounded-lg border-2 text-4xl font-bold', GRADE_TONE[b.grade])}>{b.grade}</div>
          <div className="label mt-1 flex items-center justify-center gap-1"><ShieldQuestion size={10} /> Risk grade</div>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-md border border-edge bg-obsidian p-3">
        <div>
          <div className="label flex items-center gap-1.5"><Briefcase size={11} /> Purpose</div>
          <div className="mt-1 text-sm font-medium">{b.purpose}</div>
        </div>
        <div className="text-right">
          <div className="label">Requested</div>
          <div className="num mt-0.5 text-2xl font-semibold text-cyan">{usd(b.amount)}</div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <dt className="label mb-1">Credit score</dt>
          <dd><Meter value={b.score} min={540} max={810} fmt={String(b.score)} /></dd>
        </div>
        <div>
          <dt className="label mb-1">DTI ratio</dt>
          <dd><Meter value={b.dti} min={12} max={62} invert fmt={`${b.dti}%`} /></dd>
        </div>
        <div>
          <dt className="label mb-1">Tenure</dt>
          <dd><Meter value={b.tenure} min={0.5} max={12} fmt={`${b.tenure} yr`} /></dd>
        </div>
      </dl>

      <div className="mt-4">
        <div className="label mb-1.5">Alternative signal</div>
        <div className={cx('rounded-md border px-3 py-2 font-mono text-xs', sig)}>{b.signal.label}</div>
      </div>

      <footer className="mt-4 flex items-center justify-between border-t border-edge pt-3 text-xs text-mute">
        <span className="flex items-center gap-1.5"><Clock size={12} /> Term {b.termQuarters} quarters · bullet repayment</span>
        <span className="num">Grade-{b.grade} rate {pct(STANDARD_RATE[b.grade])}</span>
      </footer>
    </article>
  );
}

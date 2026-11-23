import { ArrowRight, Skull } from 'lucide-react';
import { type QuarterRecord } from '../engine/creditSim';
import { cx, usd } from '../lib/format';

export function Settlement({ rec, onContinue, last }: { rec: QuarterRecord; onContinue: () => void; last: boolean }) {
  const rows: [string, number, string][] = [
    ['Interest income', rec.interest, 'text-emerald'],
    ['Wholesale funding cost', -rec.funding, 'text-amber'],
    ['Credit losses (70% LGD)', -rec.losses, 'text-crimson'],
  ];
  return (
    <section className="panel animate-slideUp p-5" aria-label="Quarter settlement">
      <div className="label">Quarter {rec.round} settlement</div>
      <h2 className="mt-1 text-xl font-semibold">{rec.net >= 0 ? 'Quarter closed in the black' : 'Quarter closed in the red'}</h2>
      <div className="mt-4 divide-y divide-edge rounded-md border border-edge bg-obsidian">
        {rows.map(([l, v, c]) => (
          <div key={l} className="flex items-center justify-between px-3 py-2.5 text-sm">
            <span className="text-mute">{l}</span>
            <span className={cx('num font-semibold', c)}>{usd(v, { sign: true })}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-3 py-3">
          <span className="font-semibold">Net to capital buffer</span>
          <span className={cx('num text-xl font-bold', rec.net >= 0 ? 'text-emerald' : 'text-crimson')}>{usd(rec.net, { sign: true })}</span>
        </div>
      </div>
      {rec.defaultedLoans.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {rec.defaultedLoans.map((d) => (
            <li key={d.name} className="flex items-center justify-between rounded-md border border-crimson/40 bg-crimson/10 px-3 py-2 text-xs text-crimson">
              <span className="flex items-center gap-2"><Skull size={13} /> {d.name} defaulted</span>
              <span className="num">{usd(-d.loss)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-mute">No defaults this quarter.{rec.repaid > 0 && ` ${usd(rec.repaid)} of principal matured.`}</p>
      )}
      <button onClick={onContinue} autoFocus className="btn mt-4 w-full border-cyan/50 bg-cyan/10 text-cyan hover:bg-cyan/20">
        {last ? 'View risk audit' : `Advance to Quarter ${rec.round + 1}`} <ArrowRight size={16} />
      </button>
    </section>
  );
}

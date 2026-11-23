import { type GameState } from '../engine/creditSim';
import { cx, pct, usd } from '../lib/format';

export function LoanBook({ state }: { state: GameState }) {
  const loans = [...state.loans].reverse();
  if (!loans.length) return <div className="flex h-[260px] items-center justify-center text-sm text-mute">No loans booked yet. Capital sits idle earning nothing.</div>;
  const tone = { active: 'text-emerald', defaulted: 'text-crimson', repaid: 'text-mute' } as const;
  return (
    <div className="h-[260px] overflow-auto">
      <table className="w-full text-left font-mono text-xs">
        <thead className="sticky top-0 bg-panel text-[10px] uppercase tracking-wider text-mute">
          <tr><th className="py-1.5 pr-2">Borrower</th><th className="pr-2">Q</th><th className="pr-2">Gr</th><th className="pr-2 text-right">Balance</th><th className="pr-2 text-right">APR</th><th className="text-right">Status</th></tr>
        </thead>
        <tbody>
          {loans.map((l) => (
            <tr key={l.id} className="border-t border-edge/70">
              <td className="max-w-[9rem] truncate py-1.5 pr-2 font-sans text-sm">{l.name}{l.premium && <span className="ml-1.5 rounded bg-amber/15 px-1 text-[9px] text-amber">+PREM</span>}</td>
              <td className="pr-2 text-mute">{l.originRound}</td>
              <td className="pr-2">{l.grade}</td>
              <td className="pr-2 text-right">{usd(l.status === 'defaulted' ? l.principal : l.balance || l.principal)}</td>
              <td className="pr-2 text-right">{pct(l.apr)}</td>
              <td className={cx('text-right uppercase', tone[l.status])}>{l.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

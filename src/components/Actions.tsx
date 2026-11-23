import { Ban, CheckCircle2, TrendingUp } from 'lucide-react';
import { CONFIG, type Action, type Borrower, type GameState, quote } from '../engine/creditSim';
import { cx, pct, spct } from '../lib/format';

export function Actions({ state, b, onDecide }: { state: GameState; b: Borrower; onDecide: (a: Action) => void }) {
  const std = quote(state, b, 'standard');
  const prem = quote(state, b, 'premium');
  const blocked = !std.eligible;

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <button disabled={blocked} onClick={() => onDecide('standard')} className={cx('btn flex-col items-start !gap-1 border-emerald/50 bg-emerald/10 text-emerald hover:bg-emerald/20 text-left')}>
          <span className="flex items-center gap-2"><CheckCircle2 size={16} /> Approve · Standard <kbd className="ml-auto rounded border border-emerald/40 px-1 text-[10px]">1</kbd></span>
          <span className="num text-xl">{pct(std.apr)} APR</span>
          <span className="text-[11px] font-normal text-emerald/80">Spread vs funding {spct(std.spread)}</span>
        </button>
        <button disabled={blocked} onClick={() => onDecide('premium')} className={cx('btn flex-col items-start !gap-1 border-amber/50 bg-amber/10 text-amber hover:bg-amber/20 text-left')}>
          <span className="flex items-center gap-2"><TrendingUp size={16} /> Approve · +{(CONFIG.premiumApr * 100).toFixed(1)}% Premium <kbd className="ml-auto rounded border border-amber/40 px-1 text-[10px]">2</kbd></span>
          <span className="num text-xl">{pct(prem.apr)} APR</span>
          <span className="text-[11px] font-normal text-amber/80">Spread {spct(prem.spread)} · raises default odds (repayment burden)</span>
        </button>
      </div>
      <button onClick={() => onDecide('reject')} className="btn w-full justify-between border-crimson/50 bg-crimson/10 text-crimson hover:bg-crimson/20">
        <span className="flex items-center gap-2"><Ban size={16} /> Reject application</span>
        <span className="flex items-center gap-2 text-[11px] font-normal text-crimson/80">No capital deployed <kbd className="rounded border border-crimson/40 px-1 text-[10px] font-semibold">3</kbd></span>
      </button>
      {blocked && (
        <p className="rounded-md border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-amber" role="alert">
          {std.reason}: deployed capital plus this loan would exceed {CONFIG.leverageCap}x your capital buffer. Reject, or wait for loans to mature.
        </p>
      )}
    </div>
  );
}

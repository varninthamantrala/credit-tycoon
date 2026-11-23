import { Activity, Banknote, Gauge, Layers, Percent, Skull, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { CONFIG, type GameState, activeLoans, computeMetrics, deployed, exposureLimit } from '../engine/creditSim';
import { cx, pct, usd, usdK } from '../lib/format';

function Kpi({ icon, label, value, sub, tone = 'text-ink', pulse }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone?: string; pulse?: string }) {
  return (
    <div className={cx('panel p-3', pulse)}>
      <div className="label flex items-center gap-1.5">{icon} {label}</div>
      <div className={cx('num mt-1.5 text-xl font-semibold leading-none', tone)}>{value}</div>
      {sub && <div className="mt-1.5 text-[11px] text-mute">{sub}</div>}
    </div>
  );
}

export function Kpis({ state, shockKey }: { state: GameState; shockKey: string }) {
  const m = computeMetrics(state);
  const dep = deployed(state);
  const lim = exposureLimit(state);
  const mult = state.regime.defaultMult;
  const bufTone = state.buffer < 400_000 ? 'text-crimson' : state.buffer < 700_000 ? 'text-amber' : 'text-emerald';
  const fundingUp = state.regime.fundingRate > CONFIG.startFunding + 1e-9;
  const regimeSev = mult > 1.2 ? 'bad' : mult > 1.05 || fundingUp ? 'warn' : 'good';
  const regimeTone = { bad: 'text-crimson', warn: 'text-amber', good: 'text-emerald' }[regimeSev];
  const pulse = state.activeEventId ? (regimeSev === 'bad' ? 'animate-pulseBad border-crimson/60' : 'animate-pulseAlert border-amber/60') : '';

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Kpi icon={<Banknote size={12} />} label="Capital buffer" value={usd(state.buffer)} tone={bufTone} sub={`Floor ${usdK(CONFIG.insolvencyFloor)}`} />
      <Kpi icon={<Percent size={12} />} label="Funding cost" value={pct(state.regime.fundingRate, 2)} tone={fundingUp ? 'text-amber' : 'text-ink'} sub="Wholesale APR" />
      <div key={shockKey} className={cx('panel p-3', pulse)}>
        <div className="label flex items-center gap-1.5"><Activity size={12} /> Macro regime</div>
        <div className={cx('mt-1.5 text-lg font-semibold leading-none', regimeTone)}>{state.regime.name}</div>
        <div className="num mt-1.5 text-[11px] text-mute">Default mult {mult.toFixed(2)}x{state.regime.demandBoost && ' · demand surge'}</div>
      </div>
      <Kpi icon={<Layers size={12} />} label="Deployed" value={usdK(dep)} sub={`${activeLoans(state).length} loans · cap ${usdK(lim)}`} />
      <Kpi icon={<Gauge size={12} />} label="RAROC (ann.)" value={m.quarters ? pct(m.raroc) : '—'} tone={m.raroc >= 0 ? 'text-emerald' : 'text-crimson'} sub={m.quarters ? `Grade ${m.grade}` : 'After first settlement'} />
      <Kpi icon={<Zap size={12} />} label="Net interest margin" value={m.quarters ? pct(m.nim) : '—'} tone="text-cyan" sub="On avg deployed" />
      <Kpi icon={<Skull size={12} />} label="Defaults" value={String(m.defaults)} tone={m.defaults ? 'text-crimson' : 'text-ink'} sub={`Losses ${usdK(m.losses)}`} />
      <Kpi icon={<Banknote size={12} />} label="Cumulative net" value={usd(m.net, { sign: true })} tone={m.net >= 0 ? 'text-emerald' : 'text-crimson'} sub={`Interest ${usdK(m.interest)}`} />
    </div>
  );
}

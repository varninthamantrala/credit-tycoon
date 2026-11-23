import { EVENTS, type GameState } from '../engine/creditSim';
import { pct } from '../lib/format';

const FILLER = [
  'Regulators remind lenders: capital buffers are not optional',
  'Fintech lenders tout alternative data as the next scoring edge',
  'Unsecured consumer credit delinquencies drift higher across regions',
  'Wholesale funding spreads widen as bond desks reprice risk',
  'Analysts: thin-file borrowers hide the biggest forecasting errors',
  'Small-business loan demand holds steady into next quarter',
];

export function Ticker({ state }: { state: GameState }) {
  const events = [...state.eventLog].reverse().map((e) => ({ text: `Q${e.round} · ${EVENTS[e.id].headline}`, sev: EVENTS[e.id].severity }));
  const live = { text: `LIVE · ${state.regime.name} · funding ${pct(state.regime.fundingRate, 2)} · default multiplier ${state.regime.defaultMult.toFixed(2)}x`, sev: 'info' as const };
  const offset = state.round % FILLER.length;
  const filler = FILLER.map((_, i) => ({ text: FILLER[(i + offset) % FILLER.length], sev: 'info' as const }));
  const items = [live, ...events, ...filler];
  const tone = { good: 'text-emerald', warn: 'text-amber', bad: 'text-crimson', info: 'text-mute' } as const;
  const row = (suffix: string) =>
    items.map((it, i) => (
      <span key={suffix + i} className={`mx-6 whitespace-nowrap font-mono text-xs ${tone[it.sev]}`}>
        <span className="mr-2 text-edge">▎</span>{it.text}
      </span>
    ));
  return (
    <div className="panel flex items-center overflow-hidden" aria-label="Macro news ticker">
      <div className="z-10 shrink-0 border-r border-edge bg-panel2 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-cyan">Macro wire</div>
      <div className="relative min-w-0 flex-1 overflow-hidden py-2">
        <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">{row('a')}{row('b')}</div>
      </div>
    </div>
  );
}

import { CONFIG } from '../engine/creditSim';
import { usd } from '../lib/format';

const SCALE_MAX = 1_500_000;

export function BufferBar({ buffer }: { buffer: number }) {
  const w = (v: number) => `${Math.min(100, Math.max(0, (v / SCALE_MAX) * 100))}%`;
  const color = buffer < 400_000 ? 'bg-crimson' : buffer < 700_000 ? 'bg-amber' : 'bg-emerald';
  return (
    <div className="panel p-3" role="meter" aria-label="Capital buffer" aria-valuemin={0} aria-valuemax={SCALE_MAX} aria-valuenow={Math.round(buffer)}>
      <div className="mb-2 flex items-center justify-between">
        <span className="label">Capital buffer vs regulatory floor</span>
        <span className="num text-xs text-mute">{usd(Math.max(0, buffer - CONFIG.insolvencyFloor))} above floor</span>
      </div>
      <div className="relative h-5 rounded bg-obsidian ring-1 ring-edge">
        <div className="absolute inset-y-0 left-0 rounded-l bg-crimson/25" style={{ width: w(CONFIG.insolvencyFloor) }} />
        <div className={`absolute inset-y-0 left-0 rounded transition-all duration-700 ${color}`} style={{ width: w(buffer) }} />
        <div className="absolute inset-y-[-3px] w-0.5 bg-crimson" style={{ left: w(CONFIG.insolvencyFloor) }} title="Insolvency floor" />
        <div className="absolute inset-y-[-3px] w-px bg-ink/50" style={{ left: w(CONFIG.startBuffer) }} title="Starting capital" />
      </div>
      <div className="relative mt-1 h-3 font-mono text-[10px] text-mute">
        <span className="absolute -translate-x-1/2 text-crimson" style={{ left: w(CONFIG.insolvencyFloor) }}>$250k floor</span>
        <span className="absolute -translate-x-1/2" style={{ left: w(CONFIG.startBuffer) }}>$1M start</span>
      </div>
    </div>
  );
}

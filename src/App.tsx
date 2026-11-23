import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, FileText, Landmark, RotateCcw, Shuffle, Siren } from 'lucide-react';
import { CONFIG, EVENTS, type Action, type GameState, computeMetrics, currentBorrower, decide, newGame, nextQuarter, quote } from './engine/creditSim';
import { cx, pct, usd } from './lib/format';
import { Dossier } from './components/Dossier';
import { Actions } from './components/Actions';
import { Settlement } from './components/Settlement';
import { Kpis } from './components/Kpis';
import { BufferBar } from './components/BufferBar';
import { Ticker } from './components/Ticker';
import { BufferVsDefaults, QuarterlyPnL } from './components/Charts';
import { LoanBook } from './components/LoanBook';
import { Toasts, type Toast } from './components/Toasts';
import { Audit } from './components/Audit';

type Tab = 'capital' | 'pnl' | 'book';
const TABS: { id: Tab; label: string }[] = [
  { id: 'capital', label: 'Capital vs defaults' },
  { id: 'pnl', label: 'Quarterly P&L' },
  { id: 'book', label: 'Loan book' },
];

export default function App() {
  const [state, setState] = useState<GameState>(() => newGame());
  const [tab, setTab] = useState<Tab>('capital');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const toastId = useRef(0);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++toastId.current;
    setToasts((xs) => [...xs.slice(-2), { ...t, id }]);
    window.setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 4200);
  }, []);

  const restart = useCallback((seed?: string) => {
    setState(newGame(seed));
    setShowAudit(false);
    setTab('capital');
  }, []);

  const onDecide = useCallback(
    (action: Action) => {
      const b = currentBorrower(state);
      if (!b) return;
      if (action !== 'reject' && !quote(state, b, action).eligible) return;
      const next = decide(state, action);
      if (action === 'reject') {
        const d = next.decisions[next.decisions.length - 1];
        toast({ tone: 'info', title: `Rejected ${b.name}`, body: d.good ? 'Dossier looked prime. A profitable borrower may have walked.' : 'No capital deployed.' });
      } else {
        const l = next.loans[next.loans.length - 1];
        toast({ tone: action === 'premium' ? 'warn' : 'good', title: `Approved ${b.name}`, body: `${usd(l.principal)} at ${pct(l.apr)} APR${l.premium ? ' (risk premium)' : ''}` });
      }
      setState(next);
      if (next.phase !== 'underwriting' && next.lastSettlement) {
        const r = next.lastSettlement;
        window.setTimeout(() => {
          toast({
            tone: r.defaultedLoans.length ? 'bad' : r.net >= 0 ? 'good' : 'warn',
            title: `Q${r.round} settled: ${usd(r.net, { sign: true })}`,
            body: r.defaultedLoans.length ? `${r.defaultedLoans.length} default${r.defaultedLoans.length > 1 ? 's' : ''}: ${usd(-r.losses)} written off` : 'Clean quarter, no defaults.',
          });
        }, 350);
      }
    },
    [state, toast],
  );

  const onContinue = useCallback(() => {
    if (state.phase === 'gameover') return setShowAudit(true);
    const next = nextQuarter(state);
    setState(next);
    if (next.activeEventId) {
      const ev = EVENTS[next.activeEventId];
      toast({ tone: ev.severity === 'good' ? 'good' : ev.severity, title: `MACRO SHOCK · Q${next.round}`, body: ev.headline });
    }
  }, [state, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showAudit || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (state.phase === 'underwriting') {
        if (e.key === '1') onDecide('standard');
        else if (e.key === '2') onDecide('premium');
        else if (e.key === '3') onDecide('reject');
      } else if (e.key === 'Enter') onContinue();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase, showAudit, onDecide, onContinue]);

  const b = currentBorrower(state);
  const event = state.activeEventId ? EVENTS[state.activeEventId] : null;
  const m = computeMetrics(state);
  const shockKey = `${state.round}-${state.activeEventId ?? 'none'}`;

  return (
    <div className="mx-auto flex min-h-full max-w-[1500px] flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald/50 bg-emerald/10 text-emerald"><Landmark size={20} /></div>
          <div>
            <h1 className="text-lg font-semibold leading-tight tracking-tight">Credit Underwriting &amp; Default Risk Tycoon</h1>
            <p className="label !tracking-[0.2em]">Cyber-noir risk terminal</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="panel flex items-center gap-1 px-2 py-1.5" aria-label={`Quarter ${state.round} of ${CONFIG.rounds}`}>
            <span className="label mr-1">Quarter</span>
            {Array.from({ length: CONFIG.rounds }, (_, i) => (
              <span key={i} className={cx('h-2 w-5 rounded-sm transition-colors', i + 1 < state.round || (i + 1 === state.round && state.phase !== 'underwriting') ? 'bg-emerald' : i + 1 === state.round ? 'animate-flicker bg-cyan' : 'bg-edge')} />
            ))}
            <span className="num ml-1 text-xs">Q{state.round}/{CONFIG.rounds}</span>
          </div>
          <span className="num rounded-md border border-edge px-2 py-1.5 text-xs text-mute">seed {state.seed}</span>
          {state.phase === 'gameover' && <button onClick={() => setShowAudit(true)} className="btn !px-3 !py-1.5 border-cyan/50 text-cyan"><FileText size={14} /> Audit</button>}
          <button onClick={() => restart(state.seed)} className="btn !px-3 !py-1.5 border-edge text-mute hover:text-ink" title="Restart this seed"><RotateCcw size={14} /></button>
          <button onClick={() => restart()} className="btn !px-3 !py-1.5 border-edge text-mute hover:text-ink" title="New random seed"><Shuffle size={14} /></button>
        </div>
      </header>

      <main className="grid flex-1 gap-4 lg:grid-cols-[minmax(380px,5fr)_7fr]">
        {/* ───────── Left: underwriting desk ───────── */}
        <section className="flex min-w-0 flex-col gap-4" aria-label="Underwriting desk">
          <div className="label flex items-center gap-2"><span className="h-px w-6 bg-edge" /> Underwriting desk</div>
          {event && state.phase === 'underwriting' && (
            <div key={shockKey} className={cx('panel animate-slideUp p-3', event.severity === 'bad' ? 'animate-pulseBad border-crimson/60' : event.severity === 'warn' ? 'animate-pulseAlert border-amber/60' : 'border-emerald/50')}>
              <div className={cx('label flex items-center gap-2', event.severity === 'bad' ? '!text-crimson' : event.severity === 'warn' ? '!text-amber' : '!text-emerald')}><Siren size={13} /> Macro shock · Q{state.round}</div>
              <p className="mt-1 text-sm font-semibold">{event.headline}</p>
              <p className="mt-0.5 text-xs text-mute">{event.detail}</p>
            </div>
          )}
          {state.phase === 'underwriting' && b && (
            <>
              <Dossier b={b} index={state.index} total={state.applicants.length} />
              <Actions state={state} b={b} onDecide={onDecide} />
            </>
          )}
          {state.phase !== 'underwriting' && state.lastSettlement && (
            <Settlement rec={state.lastSettlement} last={state.phase === 'gameover'} onContinue={onContinue} />
          )}
        </section>

        {/* ───────── Right: live portfolio & risk terminal ───────── */}
        <section className="flex min-w-0 flex-col gap-4" aria-label="Portfolio and risk terminal">
          <div className="label flex items-center gap-2"><span className="h-px w-6 bg-edge" /> Live portfolio &amp; risk terminal</div>
          <Ticker state={state} />
          <Kpis state={state} shockKey={shockKey} />
          <BufferBar buffer={state.buffer} />
          <div className="panel p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div role="tablist" className="flex gap-1 rounded-md bg-obsidian p-1">
                {TABS.map((t) => (
                  <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cx('rounded px-3 py-1.5 font-mono text-xs transition', tab === t.id ? 'bg-panel2 text-cyan' : 'text-mute hover:text-ink')}>
                    {t.id === 'book' ? <span className="inline-flex items-center gap-1.5"><BarChart3 size={12} />{t.label}</span> : t.label}
                  </button>
                ))}
              </div>
              <span className="num text-[11px] text-mute">{m.approved} approved · {m.rejected} rejected</span>
            </div>
            {tab === 'capital' && <BufferVsDefaults state={state} />}
            {tab === 'pnl' && <QuarterlyPnL state={state} />}
            {tab === 'book' && <LoanBook state={state} />}
          </div>
        </section>
      </main>

      <footer className="pb-2 text-center text-[11px] text-mute">Keys: 1 approve · 2 approve with premium · 3 reject · Enter to continue. Simulation only; no real money, no real lending.</footer>
      <Toasts toasts={toasts} />
      {showAudit && state.phase === 'gameover' && <Audit state={state} onNewSeed={() => restart()} onReplay={() => restart(state.seed)} onClose={() => setShowAudit(false)} />}
    </div>
  );
}

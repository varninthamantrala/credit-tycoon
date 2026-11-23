import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cx } from '../lib/format';

export interface Toast { id: number; tone: 'good' | 'warn' | 'bad' | 'info'; title: string; body?: string }

const ICON = { good: CheckCircle2, warn: AlertTriangle, bad: XCircle, info: Info };
const TONE = {
  good: 'border-emerald/50 text-emerald',
  warn: 'border-amber/50 text-amber',
  bad: 'border-crimson/50 text-crimson',
  info: 'border-cyan/40 text-cyan',
};

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-12 right-4 z-30 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICON[t.tone];
        return (
          <div key={t.id} className={cx('animate-toastIn rounded-md border bg-panel2/95 p-3 shadow-xl backdrop-blur', TONE[t.tone])}>
            <div className="flex items-center gap-2 font-mono text-xs font-semibold">
              <Icon size={15} /> {t.title}
            </div>
            {t.body && <p className="mt-1 text-xs text-ink/80">{t.body}</p>}
          </div>
        );
      })}
    </div>
  );
}

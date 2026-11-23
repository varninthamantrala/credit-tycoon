import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CONFIG, type GameState, chartSeries } from '../engine/creditSim';
import { usd, usdK } from '../lib/format';

const AXIS = { stroke: '#8493a8', fontSize: 11, fontFamily: '"JetBrains Mono", monospace' } as const;
const TIP = { background: '#0f141c', border: '1px solid #222c3b', borderRadius: 6, fontFamily: '"JetBrains Mono", monospace', fontSize: 12 } as const;

export function BufferVsDefaults({ state, height = 260 }: { state: GameState; height?: number }) {
  const data = chartSeries(state);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="bufFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2ee6a6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#2ee6a6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#222c3b" strokeDasharray="3 3" />
        <XAxis dataKey="q" tickFormatter={(q) => `Q${q}`} {...AXIS} />
        <YAxis yAxisId="buf" tickFormatter={usdK} width={58} domain={[0, (max: number) => Math.max(1_200_000, max)]} {...AXIS} />
        <YAxis yAxisId="def" orientation="right" tickFormatter={usdK} width={52} {...AXIS} />
        <Tooltip contentStyle={TIP} formatter={(v: number, n: string) => [usd(v), n]} labelFormatter={(q) => (q === 0 ? 'Start' : `Quarter ${q}`)} />
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }} />
        <ReferenceLine yAxisId="buf" y={CONFIG.insolvencyFloor} stroke="#ff4d6a" strokeDasharray="5 4" label={{ value: 'Insolvency floor', fill: '#ff4d6a', fontSize: 10, position: 'insideBottomLeft' }} />
        <Area yAxisId="buf" type="monotone" dataKey="buffer" name="Capital buffer" stroke="#2ee6a6" strokeWidth={2} fill="url(#bufFill)" isAnimationActive />
        <Line yAxisId="def" type="monotone" dataKey="cumLosses" name="Cumulative default losses" stroke="#ff4d6a" strokeWidth={2} dot={{ r: 3, fill: '#ff4d6a' }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function QuarterlyPnL({ state, height = 260 }: { state: GameState; height?: number }) {
  const data = state.history.map((h) => ({ q: h.round, Interest: Math.round(h.interest), Funding: -Math.round(h.funding), Losses: -Math.round(h.losses), Net: Math.round(h.net) }));
  if (!data.length) return <Empty text="Settle your first quarter to see income vs. losses." height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} stackOffset="sign" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#222c3b" strokeDasharray="3 3" />
        <XAxis dataKey="q" tickFormatter={(q) => `Q${q}`} {...AXIS} />
        <YAxis tickFormatter={usdK} width={58} {...AXIS} />
        <Tooltip contentStyle={TIP} formatter={(v: number, n: string) => [usd(v, { sign: true }), n]} labelFormatter={(q) => `Quarter ${q}`} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }} />
        <ReferenceLine y={0} stroke="#8493a8" />
        <Bar dataKey="Interest" stackId="s" fill="#2ee6a6" />
        <Bar dataKey="Funding" stackId="s" fill="#ffb020" />
        <Bar dataKey="Losses" stackId="s" fill="#ff4d6a" />
        <Line type="monotone" dataKey="Net" stroke="#4cc9f0" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function Empty({ text, height }: { text: string; height: number }) {
  return <div className="flex items-center justify-center text-sm text-mute" style={{ height }}>{text}</div>;
}

export const usd = (n: number, opts: { sign?: boolean } = {}): string => {
  const abs = Math.abs(Math.round(n)).toLocaleString('en-US');
  const sign = n < 0 ? '-' : opts.sign && n > 0 ? '+' : '';
  return `${sign}$${abs}`;
};
export const usdK = (n: number): string => {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `${(abs / 1_000_000).toFixed(2)}M` : abs >= 1000 ? `${(abs / 1000).toFixed(abs >= 100_000 ? 0 : 1)}k` : `${Math.round(abs)}`;
  return `${n < 0 ? '-' : ''}$${s}`;
};
export const pct = (n: number, d = 1): string => `${(n * 100).toFixed(d)}%`;
export const spct = (n: number, d = 1): string => `${n > 0 ? '+' : ''}${(n * 100).toFixed(d)}%`;
export const cx = (...xs: (string | false | null | undefined)[]): string => xs.filter(Boolean).join(' ');

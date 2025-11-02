export const readInt = (key: string, def: number) => {
  if (typeof window === 'undefined') return def;
  const raw = localStorage.getItem(key);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : def;
};

export const writeInt = (key: string, val: number) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, String(val));
  }
};

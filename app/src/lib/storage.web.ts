// Browser: the page's own localStorage (falls back to memory in private windows that block it).
const mem = new Map<string, string>();
const memory = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v); },
  removeItem: (k: string) => { mem.delete(k); },
};
function pick() {
  try { const s = globalThis.localStorage; s.setItem('__t', '1'); s.removeItem('__t'); return s; } catch { return memory; }
}
export const storage = typeof window === 'undefined' ? memory : pick();

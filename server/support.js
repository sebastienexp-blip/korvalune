// V10.58 — messagerie joueur ↔ administrateur (« Contacter l'administrateur »), conservée sur le compte.
const MAX_KEEP = 100, MAX_LEN = 600;
const rid = () => Math.random().toString(36).slice(2, 10);
const clean = (s) => (typeof s === 'string' ? s.replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, MAX_LEN) : '');
export function ensureSupport(acc) { if (!Array.isArray(acc.support)) acc.support = []; return acc.support; }
export function addMessage(acc, from, text) {
  const t = clean(text);
  if (t.length < 2) return { ok: false, error: 'Message trop court.' };
  const list = ensureSupport(acc);
  list.push({ id: rid(), f: from, x: t, at: Date.now() });
  if (list.length > MAX_KEEP) list.splice(0, list.length - MAX_KEEP);
  if (from === 'a') acc.supportUnread = Math.min(99, (acc.supportUnread | 0) + 1);
  return { ok: true };
}
export const playerView = (acc) => ({ msgs: ensureSupport(acc).map((m) => ({ me: m.f === 'p', text: m.x, at: m.at })), unread: acc.supportUnread | 0 });
export const markRead = (acc) => { acc.supportUnread = 0; };
export const threadView = (acc) => ensureSupport(acc).map((m) => ({ admin: m.f === 'a', text: m.x, at: m.at }));
// conversations ouvertes : celles dont le dernier message vient du joueur passent en premier
export function inbox(accounts, limit = 60) {
  const rows = [];
  for (const [k, a] of Object.entries(accounts)) {
    const l = a.support; if (!Array.isArray(l) || !l.length) continue;
    const last = l[l.length - 1];
    rows.push({ name: k, waiting: last.f === 'p', last: last.x.slice(0, 90), at: last.at, count: l.length });
  }
  rows.sort((a, b) => (b.waiting - a.waiting) || (b.at - a.at));
  return { waiting: rows.filter((r) => r.waiting).length, list: rows.slice(0, limit) };
}

// Chat: shapes and helpers shared by the inbox and the conversation.

export type Chat = { id: string; trainer_id: string; kind: 'direct' | 'group'; title: string | null; created_by: string; last_message_at: string | null; last_preview: string | null; created_at: string };
export type ChatMember = { chat_id: string; user_id: string; role: 'trainer' | 'client'; name: string; muted: boolean; archived: boolean; last_read_at: string };
export type MessageKind = 'text' | 'image' | 'video' | 'audio' | 'file' | 'gif' | 'workout' | 'system';
export type Message = {
  id: string; chat_id: string; sender: string; kind: MessageKind; body: string | null; path: string | null;
  meta: { name?: string; size?: number; mime?: string; url?: string; w?: number; h?: number; secs?: number; title?: string; assignment_id?: string; date?: string; summary?: string };
  reply_to: string | null; broadcast_id: string | null; edited_at: string | null; deleted_at: string | null; created_at: string;
};
export type Reaction = { message_id: string; user_id: string; emoji: string };
export type Broadcast = { id: string; trainer_id: string; title: string; client_ids: string[]; last_sent_at: string | null; last_body: string | null; created_at: string };

/** Name to show for a chat: the group's title, or the other person */
export function chatName(c: Chat, members: ChatMember[], me: string) {
  if (c.kind === 'group') return c.title || 'Group chat';
  return members.find((m) => m.chat_id === c.id && m.user_id !== me)?.name || 'Chat';
}
export function unread(c: Chat, mine: ChatMember | undefined) {
  return !!(c.last_message_at && mine && c.last_message_at > mine.last_read_at);
}
/** Has everyone else in the chat read up to this message? */
export function seenBy(msg: Message, members: ChatMember[], me: string) {
  const others = members.filter((m) => m.user_id !== me);
  return others.length > 0 && others.every((m) => m.last_read_at >= msg.created_at);
}
/** "Today", "Yesterday", "Mon", or "16 July 2026" separators */
export function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, now)) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (same(d, y)) return 'Yesterday';
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
/** Inbox time: a time today, a weekday this week, else a short date */
export function listTime(iso: string | null, now = new Date()) {
  if (!iso) return '';
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
/** Messages grouped for display: a day header before each new day, and whether each starts a run by its sender */
export function layout(msgs: Message[]) {
  const out: ({ type: 'day'; label: string; key: string } | { type: 'msg'; msg: Message; first: boolean; last: boolean })[] = [];
  let lastDay = '';
  msgs.forEach((m, i) => {
    const day = new Date(m.created_at).toDateString();
    if (day !== lastDay) { out.push({ type: 'day', label: dayLabel(m.created_at), key: `d-${day}` }); lastDay = day; }
    const prev = msgs[i - 1], next = msgs[i + 1];
    const near = (a?: Message, b?: Message) => !!a && !!b && a.sender === b.sender && new Date(a.created_at).toDateString() === new Date(b.created_at).toDateString()
      && Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 5 * 60_000;
    out.push({ type: 'msg', msg: m, first: !near(prev, m), last: !near(m, next) });
  });
  return out;
}
/** Reactions on one message, counted per emoji, with whether I'm one of them */
export function tally(rs: Reaction[], messageId: string, me: string) {
  const m = new Map<string, { n: number; mine: boolean }>();
  for (const r of rs) if (r.message_id === messageId) { const x = m.get(r.emoji) ?? { n: 0, mine: false }; x.n++; if (r.user_id === me) x.mine = true; m.set(r.emoji, x); }
  return [...m.entries()].map(([emoji, v]) => ({ emoji, ...v }));
}
/** Text broken into plain parts and links (so links can be tapped) */
export function linkify(s: string) {
  const parts: { text: string; url?: string }[] = [];
  const re = /\bhttps?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]]/g;
  let i = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) { if (m.index > i) parts.push({ text: s.slice(i, m.index) }); parts.push({ text: m[0], url: m[0] }); i = m.index + m[0].length; }
  if (i < s.length) parts.push({ text: s.slice(i) });
  return parts;
}
/** A message that's only 1–3 emoji is shown big, like in texting apps */
export const bigEmoji = (s: string | null) => !!s && s.length <= 12 && /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u.test(s) && !/^[\d#*\s]+$/.test(s);
export const QUICK_REACTIONS = ['❤️', '😂', '🔥', '💪', '👏', '👍', '😮', '😢'];
export const EMOJI: [string, string[]][] = [
  ['Smileys', ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😌', '😔', '😪', '😴', '😷', '🤒', '🥵', '🥶', '🥴', '😵', '🤯', '🥳', '😎', '🤓', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '💀', '💩', '🤡', '👻', '👽', '🤖']],
  ['Gestures', ['👋', '🤚', '✋', '🖖', '👌', '🤌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪', '🦵', '🦶', '👀', '🧠', '🫀', '🫁']],
  ['Fitness', ['🏋️', '🏋️‍♀️', '🏋️‍♂️', '🤸', '🧘', '🏃', '🏃‍♀️', '🚴', '🏊', '🤾', '⛹️', '🧗', '🥊', '🥇', '🥈', '🥉', '🏆', '🎯', '⏱️', '⏰', '🔥', '💯', '⚡', '✨', '🎉', '🎊', '🚀', '📈', '📉', '✅', '❌', '⭐', '🌟', '💥', '💦', '😮‍💨']],
  ['Food', ['🍎', '🍌', '🍇', '🍓', '🫐', '🍉', '🍊', '🍋', '🥑', '🥦', '🥕', '🌽', '🥔', '🍠', '🥗', '🍚', '🍝', '🍞', '🥯', '🥞', '🧇', '🍳', '🥚', '🥩', '🍗', '🍔', '🍟', '🍕', '🌮', '🌯', '🍣', '🍤', '🍜', '🥣', '🥛', '☕', '🍵', '🧃', '🥤', '💧', '🍫', '🍪', '🍩', '🍰', '🧁', '🍦', '🍺', '🍷']],
  ['Hearts', ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🫶', '🐉', '🦋', '🌈', '☀️', '🌙', '⛅', '❄️', '🌊', '🌸', '🌿', '🍀']],
];
export const rand = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

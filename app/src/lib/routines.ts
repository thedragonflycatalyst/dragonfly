// Routines and workout reminders: pure helpers (tested)

/** A day (YYYY-MM-DD) and a time (HH:MM) on this device's clock, as an instant */
export function reminderAt(day: string, hhmm: string): Date {
  const [y, m, d] = day.split('-').map(Number), [h, mi] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi);
}

/** "Every Wednesday at 3:00 PM" or "Wed, Nov 18 at 3:00 PM" */
export function reminderLine(r: { at: string; weekly: boolean }): string {
  const d = new Date(r.at);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return r.weekly ? `Every ${d.toLocaleDateString('en-US', { weekday: 'long' })} at ${time}` : `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`;
}

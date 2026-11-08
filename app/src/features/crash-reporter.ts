// Crash reports in release builds, scrubbed of personal data (lib/crash.ts). On by default; switch off in
// Settings › About. A crash is queued on the device first (the app may be about to die), then sent to
// dragonfly_issue_reports (the admin "Reported issues" list) when someone is signed in, now or on the next launch.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { admit, crashReport, type CrashReport, type SentLog } from '@/lib/crash';
import { recall, sb, store } from '@/lib/supabase';

const ON = 'crash.reports.on';
const QUEUE = 'crash.reports.queue';
const SENT = 'crash.reports.sent';
export const crashReportsOn = () => recall<boolean>(ON, true);
export function setCrashReportsOn(on: boolean) { store(ON, on); if (!on) store(QUEUE, []); }

let route = '';
/** The shell tells us where the person is (path only; it's scrubbed again before sending). */
export const noteRoute = (path: string) => { route = path; };

export function captureCrash(err: unknown, fatal: boolean) {
  try {
    if (!crashReportsOn()) return;
    const r = crashReport(err, { fatal, platform: Platform.OS, version: Constants.expoConfig?.version ?? '', route });
    const next = admit(r.context.sig, recall<SentLog>(SENT, []));
    if (!next) return;
    store(SENT, next);
    store(QUEUE, [...recall<CrashReport[]>(QUEUE, []), r].slice(-5));
    void flushCrashes();
  } catch { /* never let reporting crash the app */ }
}

/** Sends queued reports if someone is signed in; keeps them for later otherwise. */
export async function flushCrashes() {
  try {
    const q = recall<CrashReport[]>(QUEUE, []);
    if (!q.length || !crashReportsOn()) return;
    const { data } = await sb.auth.getSession();
    if (!data.session) return;
    const { error } = await sb.from('dragonfly_issue_reports').insert(q.map((r) => ({ body: r.body, app: r.app, context: r.context })));
    if (!error) store(QUEUE, []);
  } catch { /* try again next launch */ }
}

let installed = false;
/** Release builds only: development keeps the normal red screen. */
export function installCrashReporter() {
  if (installed || __DEV__) return;
  installed = true;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (e) => captureCrash(e.error ?? e.message, false));
    window.addEventListener('unhandledrejection', (e) => captureCrash(e.reason, false));
  } else {
    const prev = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => { captureCrash(error, !!isFatal); prev(error, isFatal); });
  }
  void flushCrashes();
}

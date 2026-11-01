#!/usr/bin/env bash
# Emulator smoke test: installs the APK, opens the signed-out screens, saves screenshots and the log.
set -u
PKG=com.thedragonflycatalyst.coach
OUT=screens
mkdir -p "$OUT"
shot() { sleep "$2"; adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1; sleep 1; adb exec-out screencap -p > "$OUT/$1.png"; echo "shot $1"; }
open() { adb shell am start -W -a android.intent.action.VIEW -d "$1" "$PKG" >/dev/null; }

adb shell settings put global hide_error_dialogs 1 || true
adb install -r -g dragonfly-coach.apk
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity"
shot 01-welcome 25
open "dragonflycoach:///join?code=AB12CD34"; shot 02-join 8
open "dragonflycoach:///sign-in";            shot 03-sign-in 6
adb shell input keyevent KEYCODE_BACK; sleep 2
adb shell cmd uimode night yes
adb shell am force-stop "$PKG"; adb shell am start -W -n "$PKG/.MainActivity"
shot 04-welcome-dark 20
adb logcat -d > "$OUT/logcat.txt"
grep -E "FATAL EXCEPTION|ReactNativeJS.*(Error|Exception)|AndroidRuntime" "$OUT/logcat.txt" | head -50 > "$OUT/errors.txt" || true
echo "errors: $(wc -l < "$OUT/errors.txt")"
[ -s "$OUT/errors.txt" ] || echo "No crashes or JavaScript errors found." > "$OUT/errors.txt"
exit 0

// Friendly names for the apps that share data through Health Connect / Apple Health
const APPS: [RegExp, string][] = [
  [/myfitnesspal/i, 'MyFitnessPal'], [/cronometer/i, 'Cronometer'], [/loseit|fitnow/i, 'Lose It'], [/macrofactor/i, 'MacroFactor'],
  [/shealth|samsung/i, 'Samsung Health'], [/fitbit/i, 'Fitbit'], [/garmin/i, 'Garmin Connect'], [/google.*fit/i, 'Google Fit'], [/oura/i, 'Oura'],
  [/whoop/i, 'WHOOP'], [/renpho/i, 'RENPHO'], [/strava/i, 'Strava'], [/withings|healthmate/i, 'Withings'], [/libra/i, 'Libra'], [/zepp|huami|amazfit/i, 'Zepp'],
  [/polar/i, 'Polar'], [/coros/i, 'COROS'], [/eufy/i, 'eufy'], [/peloton/i, 'Peloton'], [/nike/i, 'Nike Run Club'], [/apple|com\.apple/i, 'Apple'],
];
export const appName = (pkg?: string | null) => (pkg ? APPS.find(([re]) => re.test(pkg))?.[1] ?? pkg.split('.').pop() ?? pkg : undefined);

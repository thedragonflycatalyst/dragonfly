import { Alert, Platform } from 'react-native';

type Choice = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

/**
 * Alert with buttons that also works in the web dashboard (React Native Web's Alert does nothing).
 * On web: one action → confirm(); several → the first non-cancel action runs after confirm().
 */
export function ask(title: string, message: string, choices: Choice[]) {
  if (Platform.OS !== 'web') return Alert.alert(title, message, choices);
  const actions = choices.filter((c) => c.style !== 'cancel');
  if (!actions.length) { window.alert(`${title}\n\n${message}`); return; }
  if (actions.length === 1) { if (window.confirm(`${title}\n\n${message}`)) actions[0].onPress?.(); return; }
  const pick = window.prompt(`${title}\n\n${message}\n\n${actions.map((a, i) => `${i + 1}. ${a.text}`).join('\n')}\n\nType a number:`);
  const n = Number(pick);
  if (n >= 1 && n <= actions.length) actions[n - 1].onPress?.();
}

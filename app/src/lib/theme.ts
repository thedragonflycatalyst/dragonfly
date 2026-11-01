import { useColorScheme } from 'react-native';

// Dragonfly: deep water greens with an iridescent teal accent and a gold highlight.
const light = {
  bg: '#f2f5f4', surface: '#ffffff', raise: '#f8faf9', ink: '#0e1a1d', muted: '#566669', line: '#d9e2e1', soft: '#e6eeed',
  focus: '#0a7a70', gold: '#a8700a', danger: '#c42b20', good: '#1a8a52', onAccent: '#ffffff',
};
const dark: typeof light = {
  bg: '#0a1214', surface: '#121c1f', raise: '#18252a', ink: '#eef5f4', muted: '#9bb0b2', line: '#24363c', soft: '#162327',
  focus: '#3fd6c6', gold: '#f2b84b', danger: '#ff8378', good: '#3fd98f', onAccent: '#0a1214',
};
export type Palette = typeof light;

export function usePalette(): Palette & { scheme: 'light' | 'dark' } {
  const s = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { ...(s === 'dark' ? dark : light), scheme: s };
}

export const F = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  body: 'AtkinsonHyperlegible_400Regular',
  bodyBold: 'AtkinsonHyperlegible_700Bold',
};

export const R = { lg: 22, md: 16, sm: 11, pill: 999 };

/** Content column width on wide screens (the web dashboard) */
export const MAX_W = 980;

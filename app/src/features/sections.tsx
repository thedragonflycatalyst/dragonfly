import { ScrollView, View } from 'react-native';
import { MAX_W, usePalette } from '@/lib/theme';
import { Activity } from './activity';
import type { SectionKey, SectionProps } from './common';
import { Files } from './files';
import { Forms } from './forms';
import { Goals } from './goals';
import { Habits } from './habits';
import { Measurements } from './measurements';
import { Notes } from './notes';
import { Photos } from './photos';

const VIEWS: Record<SectionKey, (p: SectionProps) => React.JSX.Element> = {
  activity: Activity, measurements: Measurements, photos: Photos, habits: Habits, goals: Goals, forms: Forms, files: Files, notes: Notes,
};

/** One profile section in a scrolling page, for either the trainer or the client. */
export function SectionView({ section, ...props }: SectionProps & { section: SectionKey }) {
  const p = usePalette();
  const View_ = VIEWS[section];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
      <View style={{ width: '100%', maxWidth: MAX_W }}><View_ {...props} /></View>
    </ScrollView>
  );
}

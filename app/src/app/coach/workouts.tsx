import { Screen } from '@/components/shell';
import { Empty } from '@/components/ui';

/** Placeholder until this tab's chunk is built. */
export default function WorkoutsTab() {
  return (
    <Screen title="Workouts">
      <Empty emoji="🛠️" title="Coming next" body="Exercise library, workout builder, programs and assigning them to clients." />
    </Screen>
  );
}

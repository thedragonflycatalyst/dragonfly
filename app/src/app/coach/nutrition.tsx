import { Screen } from '@/components/shell';
import { Empty } from '@/components/ui';

/** Placeholder until this tab's chunk is built. */
export default function NutritionTab() {
  return (
    <Screen title="Nutrition">
      <Empty emoji="🛠️" title="Coming next" body="Nutrition plans, food logging with barcodes, macro targets and recipes." />
    </Screen>
  );
}

import { Screen } from '@/components/shell';
import { ScaleView } from '@/features/scale';
import { useApp } from '@/lib/app-state';

/** Trainer's own Scale tab */
export default function CoachScale() {
  const app = useApp();
  if (!app.user) return null;
  return <Screen title="Scale"><ScaleView userId={app.user.id} /></Screen>;
}

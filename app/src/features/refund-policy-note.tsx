// The refund policy shown before a client pays (package or group session), worked out for that purchase.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Txt } from '@/components/ui';
import { policyText, type RefundTerms } from '@/lib/refunds';
import { sb } from '@/lib/supabase';

export function RefundPolicyNote({ trainerId, packageId, currency = 'usd' }: { trainerId: string; packageId?: string | null; currency?: string }) {
  const [terms, setTerms] = useState<RefundTerms | null>(null);
  useEffect(() => {
    void sb.rpc('coach_refund_terms', { p_trainer: trainerId, p_package: packageId ?? null }).then(({ data }) => setTerms((data as RefundTerms | null) ?? null));
  }, [trainerId, packageId]);
  if (!terms) return null;
  return (
    <View style={{ gap: 4, marginTop: 10 }}>
      <Txt v="smallBold">Refund policy</Txt>
      {policyText(terms, currency).map((l) => <Txt key={l} v="small">{l}</Txt>)}
    </View>
  );
}

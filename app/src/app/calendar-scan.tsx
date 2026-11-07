// Live appointment scanner: point the camera at a booking screen, a paper schedule or a text thread. The phone reads the
// text itself; once it sees an appointment time held steady, it takes the photo and the AI lists the sessions to add.
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useClientList } from '@/components/pickers';
import { ScanCamera } from '@/components/scan-camera';
import { useToast } from '@/components/ui';
import { readAppointments, type FoundSession } from '@/features/calendar-import';
import { ImportReview } from '@/features/import-review';
import { fnText } from '@/lib/fn';
import { appointmentKey } from '@/lib/scan-text';

export default function CalendarScan() {
  const toast = useToast();
  const { clients } = useClientList();
  const [found, setFound] = useState<FoundSession[] | null>(null);
  const clientsRef = useRef(clients); clientsRef.current = clients;

  /** Sends one photo to be read and shows what it found */
  const read = async (uri: string, w: number, h: number) => {
    try {
      const sessions = await readAppointments(uri, w, h, clientsRef.current ?? []);
      if (!sessions.length) { toast('No appointments found there. Hold the camera over one.', false); return false; }
      setFound(sessions);
      return true;
    } catch (e) { toast(fnText(e), false); return false; }
  };
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/calendar'); };

  return (
    <ScanCamera title="Scan appointments" why="The scanner reads appointments on your phone. Only the photo it captures is sent to be read."
      words={{ looking: 'Point at an appointment', steady: 'Hold steady…', reading: 'Reading the appointment…' }}
      keyOf={appointmentKey} onShot={read} paused={!!found} onClose={close}>
      <ImportReview found={found} clients={clients ?? []} onClose={() => setFound(null)}
        onAdded={(n) => { toast(`Added ${n} to your calendar`); setFound(null); close(); }} />
    </ScanCamera>
  );
}

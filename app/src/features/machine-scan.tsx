// Scan a machine: point the camera at gym equipment (the same live scanner as the calendar's appointment scanner) and the
// exercise picker shows the library moves done on it, with their demo videos, even when you don't know what it's called.
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Modal, Platform } from 'react-native';
import { ScanCamera } from '@/components/scan-camera';
import { callFn, fnText } from '@/lib/fn';
import { EQUIPMENT } from '@/lib/library';
import { machineChoices, type MachineRead } from '@/lib/machine-match';

/** Sends one photo to be read (nothing is saved) */
export async function readMachine(uri: string, width: number, height: number): Promise<MachineRead> {
  const out = await ImageManipulator.manipulateAsync(uri, Math.max(width, height) > 1280 ? [{ resize: width >= height ? { width: 1280 } : { height: 1280 } }] : [],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  return callFn<MachineRead>('coach-machine-scan', { image: out.base64, gear: EQUIPMENT, machines: machineChoices() });
}

const found = (r: MachineRead) => !!r.machine || r.exercises.length > 0;

/** Labels, placards and brand names in view: capture once the same words show up in two frames in a row */
export function machineKey(text: string): string | null {
  const words = [...new Set(text.toLowerCase().match(/[a-z]{3,}/g) ?? [])].sort();
  return words.length >= 2 ? words.slice(0, 6).join(' ') : null;
}

/** On the web (no live scanner): take or pick a photo instead. Resolves null when cancelled or nothing was found. */
export async function scanMachinePhoto(toast: (m: string, ok?: boolean) => void): Promise<MachineRead | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const a = res.canceled ? undefined : res.assets[0];
  if (!a) return null;
  try {
    const r = await readMachine(a.uri, a.width, a.height);
    if (found(r)) return r;
    toast('No gym equipment found in that photo.', false);
  } catch (e) { toast(fnText(e), false); }
  return null;
}

export function MachineScanner({ visible, onClose, onFound }: { visible: boolean; onClose: () => void; onFound: (r: MachineRead) => void }) {
  if (Platform.OS === 'web' || !visible) return null;
  const read = async (uri: string, w: number, h: number) => {
    try {
      const r = await readMachine(uri, w, h);
      if (!found(r)) return 'No machine found. Fill the frame with it.';
      onFound(r); onClose();
      return true;
    } catch (e) { return fnText(e); }
  };
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <ScanCamera title="Scan a machine" why="Point the camera at a machine and Dragonfly shows the exercises done on it. Only the photo it captures is sent to be read."
        words={{ looking: 'Point at the machine', steady: 'Hold steady…', reading: 'Finding the exercises…' }}
        keyOf={machineKey} onShot={read} onClose={onClose} />
    </Modal>
  );
}

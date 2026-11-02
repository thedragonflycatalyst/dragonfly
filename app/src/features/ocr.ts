// Reads text in a photo on the phone with Google ML Kit (free, offline). Used to know when to capture.
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';

export async function readText(uri: string): Promise<string> {
  const r = await recognizeText(uri);
  return r.blocks.flatMap((b) => b.lines.map((l) => l.text)).join('\n') || r.text;
}

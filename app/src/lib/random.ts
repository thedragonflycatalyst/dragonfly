import { getRandomBytes } from 'expo-crypto';

/** A hard-to-guess code from secure random bytes (works on Android, where global crypto isn't available) */
export function randomCode(length: number, alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'): string {
  return Array.from(getRandomBytes(length), (b) => alphabet[b % alphabet.length]).join('');
}

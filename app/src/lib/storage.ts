// Phones: localStorage backed by SQLite (persists across app restarts).
import 'expo-sqlite/localStorage/install';

export const storage = globalThis.localStorage;

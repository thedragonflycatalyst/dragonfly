import type { FoodDb } from '@/lib/nutrition';

let db: FoodDb | null = null;
/** USDA FoodData Central (SR Legacy, public domain), about 7,400 foods. Loaded on first use. */
export function foods(): FoodDb {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (!db) db = require('./foods.json') as FoodDb;
  return db;
}

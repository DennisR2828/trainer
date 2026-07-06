/* Feature flags.
 *
 * Diet now lives in its OWN TAB (js/screens/diet.js) — always on — with a meal
 * database (js/food-db.js) and a per-slot "pick a meal" sheet.
 *
 * DIET_ENABLED governs only the LEGACY inline diet UI: the small diet card on
 * the Today / Calendar day view and the diet ring on the Calendar month grid.
 * It stays off so those stay workout-only (the Diet tab is the home for food
 * now). Flip it true to also show that inline logger + calendar ring. */
export const DIET_ENABLED = false;

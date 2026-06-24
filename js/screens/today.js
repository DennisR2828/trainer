/* Today = the day log for the current local date. */
import { renderDayLog } from './daylog.js';
import { todayKey } from '../db.js';

export function renderToday(mount) {
  return renderDayLog(mount, todayKey());
}

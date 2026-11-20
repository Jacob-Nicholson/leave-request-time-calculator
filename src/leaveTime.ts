/**
 * Leave Request time calculation, rewritten in TypeScript.
 *
 * Counts how much work time a leave request covers, using Kent State's
 * standard workday: 8:00 AM to 5:00 PM with an unpaid lunch from
 * 12:00 to 1:00 PM, which makes 8 work hours per day. Weekends are skipped.
 *
 * The original Power Fx version is in /original. This version keeps the
 * same rules but works in whole minutes throughout, so there are no
 * rounding errors to patch afterwards.
 */

/** Minutes after midnight. */
type Minutes = number;

const toMinutes = (hours: number, minutes = 0): Minutes => hours * 60 + minutes;

export const WORK_START = toMinutes(8); // 8:00 AM
export const WORK_END = toMinutes(17); // 5:00 PM
export const LUNCH_START = toMinutes(12); // 12:00 PM
export const LUNCH_END = toMinutes(13); // 1:00 PM
export const MINUTES_PER_WORKDAY =
  WORK_END - WORK_START - (LUNCH_END - LUNCH_START); // 480 (8 hours)

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface LeaveRequest {
  /** First day of leave, as YYYY-MM-DD. */
  startDate: string;
  /** Last day of leave, as YYYY-MM-DD. */
  endDate: string;
  /** Time leave starts on the first day, as 24-hour HH:MM. Omit for "All Day" (8:00). */
  startTime?: string;
  /** Time leave ends on the last day, as 24-hour HH:MM. Omit for "All Day" (17:00). */
  endTime?: string;
}

export interface LeaveDuration {
  totalMinutes: number;
  /** Whole 8-hour workdays. */
  days: number;
  hours: number;
  minutes: number;
}

export class LeaveRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeaveRequestError';
  }
}

/** Parses "HH:MM" (24-hour) into minutes after midnight. */
export function parseTime(time: string): Minutes {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) throw new LeaveRequestError(`Invalid time "${time}". Use 24-hour HH:MM.`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new LeaveRequestError(`Invalid time "${time}".`);
  return toMinutes(hours, minutes);
}

/** Parses "YYYY-MM-DD" into a day number (days since 1970-01-01, UTC). */
function parseDate(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) throw new LeaveRequestError(`Invalid date "${date}". Use YYYY-MM-DD.`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  // Reject dates like 2025-02-30 that Date.UTC would silently roll over.
  if (new Date(ms).getUTCDate() !== day) throw new LeaveRequestError(`Invalid date "${date}".`);
  return ms / MS_PER_DAY;
}

/** 0 = Sunday … 6 = Saturday. */
const weekdayOf = (dayNumber: number): number => new Date(dayNumber * MS_PER_DAY).getUTCDay();
const isWeekend = (dayNumber: number): boolean => [0, 6].includes(weekdayOf(dayNumber));

/** Minutes that two time ranges overlap. */
const overlap = (aStart: Minutes, aEnd: Minutes, bStart: Minutes, bEnd: Minutes): Minutes =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

/** Work minutes between two times on a single day, excluding lunch. */
function workMinutesInDay(from: Minutes, to: Minutes): Minutes {
  return to - from - overlap(from, to, LUNCH_START, LUNCH_END);
}

/** Calculates the work time covered by a leave request. */
export function calculateLeave(request: LeaveRequest): LeaveDuration {
  const firstDay = parseDate(request.startDate);
  const lastDay = parseDate(request.endDate);
  const startTime = request.startTime ? parseTime(request.startTime) : WORK_START;
  const endTime = request.endTime ? parseTime(request.endTime) : WORK_END;

  for (const time of [startTime, endTime]) {
    if (time < WORK_START || time > WORK_END) {
      throw new LeaveRequestError('Hours selected are not within work hours (8:00 AM to 5:00 PM).');
    }
  }
  if (lastDay < firstDay) {
    throw new LeaveRequestError('End date must be on or after the start date.');
  }
  if (lastDay === firstDay && endTime <= startTime) {
    throw new LeaveRequestError('End time must be after the start time.');
  }

  let totalMinutes = 0;
  for (let day = firstDay; day <= lastDay; day++) {
    if (isWeekend(day)) continue;
    const from = day === firstDay ? startTime : WORK_START;
    const to = day === lastDay ? endTime : WORK_END;
    totalMinutes += workMinutesInDay(from, to);
  }

  if (totalMinutes === 0) {
    throw new LeaveRequestError('The selected dates do not include any work time.');
  }

  return {
    totalMinutes,
    days: Math.floor(totalMinutes / MINUTES_PER_WORKDAY),
    hours: Math.floor((totalMinutes % MINUTES_PER_WORKDAY) / 60),
    minutes: totalMinutes % 60,
  };
}

/** Formats a duration the way the app's Review screen shows it. */
export function formatDuration({ days, hours, minutes }: LeaveDuration): string {
  const parts = [`${days} Day(s)`, `${hours} Hours`];
  if (minutes > 0) parts.push(`${minutes} Minutes`);
  return parts.join(', ');
}

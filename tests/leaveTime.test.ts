import { describe, expect, it } from 'vitest';
import { calculateLeave, formatDuration, LeaveRequestError, parseTime } from '../src/leaveTime';

// Reference week: Monday 2025-04-07 through Sunday 2025-04-13.
const MON = '2025-04-07';
const TUE = '2025-04-08';
const FRI = '2025-04-11';
const SAT = '2025-04-12';
const SUN = '2025-04-13';
const NEXT_MON = '2025-04-14';
const NEXT_FRI = '2025-04-18';

const duration = (days: number, hours: number, minutes = 0) =>
  expect.objectContaining({ days, hours, minutes });

describe('single day', () => {
  it('counts a full day (All Day) as 1 day', () => {
    expect(calculateLeave({ startDate: MON, endDate: MON })).toEqual(duration(1, 0));
  });

  it('counts a morning off', () => {
    expect(calculateLeave({ startDate: MON, endDate: MON, startTime: '08:00', endTime: '12:00' }))
      .toEqual(duration(0, 4));
  });

  it('counts an afternoon off', () => {
    expect(calculateLeave({ startDate: MON, endDate: MON, startTime: '13:00', endTime: '17:00' }))
      .toEqual(duration(0, 4));
  });

  it('counts partial hours in minutes', () => {
    expect(calculateLeave({ startDate: MON, endDate: MON, startTime: '08:15', endTime: '09:00' }))
      .toEqual(duration(0, 0, 45));
  });
});

describe('lunch hour (12:00 to 1:00 PM is not counted)', () => {
  it('skips lunch when the request spans it', () => {
    expect(calculateLeave({ startDate: MON, endDate: MON, startTime: '11:00', endTime: '14:00' }))
      .toEqual(duration(0, 2));
  });

  it('stops counting at noon when the request ends during lunch', () => {
    expect(calculateLeave({ startDate: MON, endDate: MON, startTime: '09:00', endTime: '12:30' }))
      .toEqual(duration(0, 3));
  });

  it('starts counting at 1:00 PM when the request starts during lunch', () => {
    expect(calculateLeave({ startDate: MON, endDate: MON, startTime: '12:30', endTime: '17:00' }))
      .toEqual(duration(0, 4));
  });

  it('counts nothing for a request entirely inside lunch', () => {
    expect(() => calculateLeave({ startDate: MON, endDate: MON, startTime: '12:00', endTime: '13:00' }))
      .toThrow(LeaveRequestError);
  });
});

describe('multiple days', () => {
  it('adds partial first and last days', () => {
    // Mon 1:00 to 5:00 PM (4h) + Tue 8:00 AM to 12:00 PM (4h) = 8h = 1 day
    expect(calculateLeave({ startDate: MON, endDate: TUE, startTime: '13:00', endTime: '12:00' }))
      .toEqual(duration(1, 0));
  });

  it('matches the example from the original prototype (Fri 11:00 AM to Mon 3:30 PM)', () => {
    // 2024-03-29 was a Friday: 11:00 to 5:00 PM = 5h. Monday 8:00 to 3:30 PM = 6h 30m.
    const result = calculateLeave({
      startDate: '2024-03-29', endDate: '2024-04-01', startTime: '11:00', endTime: '15:30',
    });
    expect(result).toEqual(duration(1, 3, 30));
    expect(formatDuration(result)).toBe('1 Day(s), 3 Hours, 30 Minutes');
  });

  it('counts a full work week as 5 days', () => {
    expect(calculateLeave({ startDate: MON, endDate: FRI })).toEqual(duration(5, 0));
  });

  it('counts two full work weeks as 10 days', () => {
    expect(calculateLeave({ startDate: MON, endDate: NEXT_FRI })).toEqual(duration(10, 0));
  });
});

describe('weekends', () => {
  it('skips the weekend in a Friday-to-Monday request', () => {
    expect(calculateLeave({ startDate: FRI, endDate: NEXT_MON })).toEqual(duration(2, 0));
  });

  it('ignores a weekend start date', () => {
    expect(calculateLeave({ startDate: SAT, endDate: NEXT_MON })).toEqual(duration(1, 0));
  });

  it('rejects a weekend-only request', () => {
    expect(() => calculateLeave({ startDate: SAT, endDate: SUN })).toThrow(/any work time/);
  });
});

describe('validation', () => {
  it('rejects times before 8:00 AM', () => {
    expect(() => calculateLeave({ startDate: MON, endDate: MON, startTime: '07:30', endTime: '12:00' }))
      .toThrow(/not within work hours/);
  });

  it('rejects times after 5:00 PM', () => {
    expect(() => calculateLeave({ startDate: MON, endDate: MON, startTime: '09:00', endTime: '19:30' }))
      .toThrow(/not within work hours/);
  });

  it('rejects an end date before the start date', () => {
    expect(() => calculateLeave({ startDate: TUE, endDate: MON })).toThrow(/End date/);
  });

  it('rejects an end time before the start time on the same day', () => {
    expect(() => calculateLeave({ startDate: MON, endDate: MON, startTime: '15:00', endTime: '10:00' }))
      .toThrow(/End time/);
  });

  it('rejects malformed dates and times', () => {
    expect(() => calculateLeave({ startDate: '4/7/2025', endDate: MON })).toThrow(/YYYY-MM-DD/);
    expect(() => calculateLeave({ startDate: '2025-02-30', endDate: '2025-03-03' })).toThrow(/Invalid date/);
    expect(() => parseTime('9am')).toThrow(/HH:MM/);
  });
});

describe('formatDuration', () => {
  it('matches the app\'s Review screen format', () => {
    expect(formatDuration({ totalMinutes: 480, days: 1, hours: 0, minutes: 0 })).toBe('1 Day(s), 0 Hours');
    expect(formatDuration({ totalMinutes: 750, days: 1, hours: 4, minutes: 30 }))
      .toBe('1 Day(s), 4 Hours, 30 Minutes');
  });
});

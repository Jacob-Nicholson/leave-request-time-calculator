# Original Power Fx code

`ButtonNextSelect.OnSelect.powerfx` is the time calculation I wrote for the Leave Request App, exactly as it shipped. It runs when the user taps **Next** on the Select Dates screen. It works out how much work time the request covers, then shows it on the Review screen as "X Day(s), Y Hours, Z Minutes."

Power Fx is the Excel-like formula language used in Microsoft Power Apps.

## How it works

1. Converts each time picker to minutes after midnight (8:00 AM = 480). "All Day" sets 8:00 AM / 5:00 PM.
2. Finds the minutes between the two times and subtracts the 12–1 PM lunch hour if the request overlaps it.
3. Adds the minutes between the two dates, then splits the total into days, hours and minutes.
4. Converts 24-hour days into 8-hour workdays and subtracts weekends.

## What I'd do differently now

Looking back at this code is a good measure of what I've learned since:

- **Work in whole minutes instead of splitting decimals as text.** The code turns numbers into text and splits on `"."` to get remainders, which causes floating-point errors. Lines 77–81 patch specific values (1.999 → 2, 7.999 → 8) to cover them up. Integer math with `Mod` and `RoundDown` avoids the problem completely.
- **Calculate day by day.** Working with the overall span and then subtracting nights and weekends made edge cases hard to reason about. For example, a request starting during lunch (12:30) isn't adjusted for lunch.
- **Name the magic numbers.** `480`, `720`, `780`, `1020` and `15` would be clearer as `WORK_START`, `LUNCH_START` and so on.
- **Write tests first.** We tested by hand against a test plan. Automated test cases would have caught edge cases earlier.

The rewrite in [`/src`](../src/leaveTime.ts) applies all of these.

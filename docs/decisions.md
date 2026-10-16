# Decisions

Each entry: date, options considered, choice, reason. Newest last.

## 1. Compare January–September of every year (8 October 2026)
- **Options:** full calendar years; rolling 12 months; the same months of every year.
- **Choice:** January to the latest month (September) of every year; a rolling 12-month view stays in the dashboard text.
- **Reason:** 2026 data ends in September. Comparing a part-year with full years, or starting at the 2024 peak, made an early draft headline wrong ("21.9% to 16.7%").

## 2. Registrations, not sales or deliveries (8 October 2026)
- **Options:** KBA registrations; company delivery figures; dealer or industry sales estimates.
- **Choice:** KBA new registrations for the market view; company reports only for margins and charges.
- **Reason:** KBA counts every brand in Germany monthly under an open licence; companies report deliveries worldwide and on their own definitions. Limit stated: a registration is not a sale, and self-registrations are shown next to the shares (KBA FZ8).

## 3. Brand level from KBA, groups built from a single list (9 October 2026)
- **Options:** KBA brand rows only; company groups; both.
- **Choice:** both. Brand rows in the hero chart and data files; owner groups (BMW Group, VW Group, Stellantis, Chinese brands and others) from one list in `scripts/groups.js`. BMW Group (BMW + MINI) is the default unit in the headline.
- **Reason:** the headline compares companies, and summing brands by hand in several places would let the figures drift apart. Rolls-Royce (42 electric cars in 2026) is left out so the group can be built from the same file for every year.

## 4. Porsche compared on its own, not inside VW Group (9 October 2026)
- **Options:** count Porsche in VW Group; compare it on its own; show both.
- **Choice:** VW Group without Porsche in the headline; VW Group with Porsche in the table; Porsche on its own next to BMW Group and Mercedes-Benz.
- **Reason:** Volkswagen AG controls Porsche AG, but Porsche reports its own margins and runs its own electric strategy, which is what the cost question asks about. Both VW Group figures are shown so the choice is visible: 42.5% to 33.1% without Porsche, 44.3% to 34.4% with it.

## 5. No estimate where a company publishes none (8 October 2026)
- **Options:** estimate Porsche's electric deliveries from share × deliveries; leave the gap.
- **Choice:** leave it and say so.
- **Reason:** an estimate would look like a reported number in a chart. The gap is listed in the README limitations.

## 6. Charges in margin points on automotive revenue (8 October 2026)
- **Options:** divide Porsche's charges by group revenue or by automotive revenue.
- **Choice:** automotive revenue, because the comparison is with the automotive margin; the group-revenue value (6.6 instead of 7.5 points) is printed next to it.
- **Reason:** keeps numerator and denominator on the same basis as the margin they are compared with, without hiding the alternative.

## 7. Reframe the question around the whole market (9 October 2026)
- **Options:** keep "Who is winning: BMW, Mercedes-Benz or Porsche?"; ask who captured the 2026 boom across all brands.
- **Choice:** "Who captured Germany's 2026 electric-car boom, and what is it costing the German premium makers?", with the three makers as the second part. **Proposed during the build; replaced by decision 9.**
- **Reason:** the first question summed three competitors into one flat share and hid that Mercedes-Benz gained while BMW and Porsche lost; the data already held every brand, and the largest move (VW Group, −9.4 points) was outside the three.

## 8. Policy dates as timing, compared against diesel (9 October 2026)
- **Options:** claim the 2026 bonus caused the growth; leave policy out; show the timing with a comparison group.
- **Choice:** mark the dates on every time chart and compare growth before and after 19 May 2026 with diesel, which the bonus does not cover.
- **Reason:** new models and EU CO2 targets moved in the same months, so a before/after difference shows timing, not cause; the text says so.

## 9. Drop the cost clause from the question (9 October 2026)
- **Options:** keep "and what is it costing the German premium makers?" and answer it with a cost estimate; shorten the question to its first clause and keep the costs as a context section.
- **Choice:** "Who captured Germany's 2026 electric-car boom?"; what the companies disclose about costs stays in its own section, with every base named. **Proposed during the build; this is the question the README, memo and dashboard use.**
- **Reason:** a cost per electric car can be computed for at most one of the three: Porsche publishes no total of electric deliveries, BMW names no electric-transition charge, and only Mercedes-Benz gives both a charge (2024) and deliveries. Disclosed charges and company margin-parity claims answer "what they say it costs", not "what it costs".

## 10. Keep Leapmotor among the Chinese brands and show the alternative (9 October 2026)
- **Options:** count Leapmotor as a Chinese brand (its maker is headquartered in China); count it under Stellantis, whose 51% joint venture Leapmotor International sells the cars outside China.
- **Choice:** Chinese brands by the maker's headquarters, as for every other brand; the Stellantis grouping is shown next to every Chinese-brand figure and in the table.
- **Reason:** one rule for all brands. The choice matters: counted under Stellantis, Stellantis becomes the largest gainer (+3.6 points) and Chinese brands gain +1.0 instead of +2.5, so both are shown.

## 11. Test the headline against self-registrations before publishing it (9 October 2026)
- **Options:** report KBA's keeper rates next to the shares; adjust the shares for them.
- **Choice:** both. Each brand's electric registrations are reduced by its self-registration rate (KBA FZ8); a worst-case bound counts every self-registered car as electric.
- **Reason:** a share bought with dealer and maker registrations is weaker evidence of demand. The result holds under the proportional adjustment; the worst-case bound would reverse BMW Group, but it removes 5.4 times the electric cars that dealers and makers actually registered (KBA FZ28), so it cannot happen.


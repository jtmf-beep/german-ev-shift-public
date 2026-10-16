# Method

Part of [German EV shift](../README.md). Every figure here is recomputed by the scripts named below.

1. **Registrations.** KBA table FZ10, 69 monthly files from January 2021 to September 2026, unchanged in `data/raw/kba`. `scripts/build.js` reads every brand total and model series; withheld cells ("/", "X", only in 2021–2024) stay blank, never 0. Every year is compared over January to September.
2. **Who registered the cars.** KBA FZ8 (brand by keeper group, all drives) and FZ28 (market by keeper group, electric cars) are in `data/raw`; the self-registration test uses them.
3. **Groups and changes.** Brands are grouped by owner in `scripts/groups.js`. A share change is split into a group's own growth and the market's growth; the parts add up exactly. Own growth = (the group's electric cars this year − last year) ÷ the market this year; market growth = the group's cars last year ÷ the market this year − the group's cars last year ÷ the market last year (negative when the market grows); own growth + market growth = the change in share, in points. Each named change is tested against month-to-month noise with same-month pairs.
4. **Company figures.** Margins and charges come from the companies' reports (fetched into `data/cache`, not in git); every figure is checked at its position on its cited page.
5. **Policy context.** The federal bonus closed to new applications after 17 December 2023. The 2026 bonus covers cars first registered from 1 January 2026 for households with taxable income up to €80,000 (plus €5,000 per child); applications opened on 19 May 2026; the programme has €3 billion for about 800,000 cars. EU duties on electric cars imported from China (BYD 17.0%) do not cover plug-in hybrids, where BYD's share rose from 2.1% to 10.7%. EU CO2 targets for 2025–2027 are judged on the three-year average, so makers can catch up in 2026 and 2027. Company cars: the reduced benefit-in-kind tax for electric cars now applies up to a list price of €100,000, up from €70,000 (Federal Finance Ministry), which matters for brands whose cars are mostly company cars. The dashboard compares growth before and after 19 May with diesel; that shows timing, not cause.
6. **Checks.** `scripts/validate.js` reconciles every table with KBA's own totals and press releases and checks every quoted fact on its page; `scripts/check-memo-numbers.js` recomputes every number in the memo and the README; CI runs both on every push.

## Margin definitions

BMW reports an Automotive segment EBIT margin. Mercedes-Benz Cars reports a return on sales; for 2025 and the first half of 2026 it headlines an adjusted figure (5.0% and 4.0%), so the project computes the reported figure from segment EBIT and revenue (3.7% and 1.9%). Porsche reports an Automotive return on sales; its forecasts and medium-term targets are for the group, a different base. None of the three publishes a margin for electric cars alone.

## Noise test and its assumption

Each group's monthly share in 2026 is compared with the same month of 2025 (nine pairs, so seasonality cancels), and the mean difference is tested with a paired t-test (8 degrees of freedom, 5% threshold 2.31). The test treats each month as independent. Sales in neighbouring months are related, so the true uncertainty is somewhat larger than the test shows; every change named in the answer has |t| of at least 2.7, so the conclusions do not depend on that assumption.

## Seasonality of the October–December test

The memo's test for VW Group compares its October–December 2026 share with October–December 2025, not with January–September 2026. The reason is measured, not assumed: `node scripts/competitors.js` prints each group's share in January–September and in October–December of 2023, 2024 and 2025 (section "Seasonality"; the same table is on the page under the VW Group chart). For VW Group the gap between the two parts of the year changes sign from one year to the next, so neither "the end of the year is always stronger" nor "always weaker" holds, and only the same months a year apart are comparable. December 2023 is distorted by the end of the purchase bonus (no new applications after 17 December 2023).

## Sensitivity of the headline to definitions

Each claim of the answer is recomputed under the definitions a reader could reasonably prefer: the brand instead of the owner group (VW brand only, BMW brand only, MINI only), Porsche counted inside VW Group, Leapmotor counted with Stellantis instead of the Chinese brands, and cars that makers and dealers registered themselves removed in proportion. `scripts/competitors.js` `sensitivity()` produces the table; the page shows it under the first chart ("Definitions tested") and `scripts/check-browser.js` fails if the page's table differs from the script's. A claim "holds" when the share moves in the stated direction under that definition; a row that does not hold is printed as such and counted in the sentence above the table.

# Maintaining the project

## Requirements

- Node 18 or later (tested on Node 24); no `npm install` for the pipeline.
- [uv](https://docs.astral.sh/uv/) for one step: extracting text from the company reports.
- For the browser check, the screenshots and memo.pdf only: the Playwright library and a Chromium.

## Rerun everything

```
node scripts/fetch-sources.js    # downloads the company reports into data/cache/ and checks their SHA-256
uv run --with "pypdf==6.19.0" --with "cryptography==46.0.3" python -I scripts/extract_pdf_text.py
                                 # page-split text of those reports; takes several minutes
node scripts/build.js            # data/raw -> data/*.csv and docs/data.js
node scripts/validate.js         # counts, months, sums, press releases, report evidence, sources, rebuild
node scripts/competitors.js      # group shares, decomposition, before/after table, self-registration test, models
node scripts/check-memo-numbers.js   # every number in memo.md, memo.de.md and README.md against its claim
node scripts/check-links.js      # every link in README.md, SOURCES.md and the dashboard (--self-test: stub server)
node scripts/check-publish.js    # secrets, personal paths and non-redistributable files (--deep: every commit's files)
```

Browser check, screenshots, the social preview image and memo.pdf:

```
npm install --no-save playwright@1.64.0
npx playwright install chromium   # or set CHROME_PATH to an existing Chromium/Chrome
node scripts/check-browser.js --pdf
```

`memo.pdf` gets a new creation timestamp on every print, so git shows it as changed even when the text is the same; `validate.js` checks that it was printed from the current `memo.md`.

If a publisher replaces a report, `fetch-sources.js` reports the changed hash and keeps the new file aside; the figures refer to the versions downloaded on 8 October 2026.

## Add a month

1. `node scripts/refresh.js` downloads any newly published FZ10, FZ8 and FZ28 file and logs it (the `refresh` workflow does this on GitHub from the 4th to the 12th of each month and opens a pull request).
2. Add that month's KBA press release (HTML) to `data/sources_fetch.tsv` with a `data/cache/press/` path and run `node scripts/fetch-sources.js` (releases are not committed: they name a press officer with phone and e-mail). Add its figures to `data/published_totals.csv` (pattern, number and source line) and a row to the press-release table in SOURCES.md.
3. Set `LAST` in `scripts/validate.js`; run `node scripts/build.js` and `node scripts/validate.js`.
4. Update `memo.md`, `README.md` and their claim files (`data/memo_claims.tsv`, `data/readme_claims.tsv`); they fail until updated, which is intended. Then `node scripts/check-memo-numbers.js` and `node scripts/check-browser.js --pdf`.

## Add a company figure

Add the report to `data/sources_fetch.tsv` (URL and SHA-256), fetch and extract as above, then add the figure to `data/ir_figures.csv` and its quoted row to `data/ir_evidence.tsv`.

## Monthly checklist

- [ ] New KBA month: steps above; check the press-release reconciliation passes.
- [ ] `node scripts/check-links.js`: 0 failed.
- [ ] Company results published since last month (see the watch-list in README): add the figures.
- [ ] Dates in the README watch-list still ahead; replace passed ones.

# Data dictionary

Printed from `data/datapackage.json` by `node scripts/dictionary.js`; edit the JSON, not this file. `node scripts/validate.js` checks that every tracked data file has exactly these columns, that every value meets its type and rule, and that this file matches the JSON.

Data behind the dashboard (docs/index.html) and the memo. Built by scripts/build.js from the unchanged KBA statistics files in data/raw/; company figures are read from the reports listed in data/sources_fetch.tsv. Field descriptions here are the data dictionary; docs/data-dictionary.md is printed from this file by scripts/dictionary.js.

Licence of the KBA data: KBA statistics: Datenlizenz Deutschland – Namensnennung – Version 2.0 (source: Kraftfahrt-Bundesamt, Flensburg; processed by the author).

## data/brands.csv

Every brand-total row ("<BRAND> ZUSAMMEN") of every monthly KBA FZ10 file, January 2021 to the latest month, plus the market total (brand MARKET). One row per month and brand. Owner groups (VW Group, BMW Group, ...) are built from these rows by scripts/groups.js, not stored.

One row per: month + brand.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `month` | string | required; pattern `^20\d\d-(0[1-9]\|1[0-2])$` | Calendar month the registrations were made in, YYYY-MM. |
| `brand` | string | required | Brand as KBA names it (upper case, e.g. VW, MERCEDES, MG ROEWE); MARKET is the KBA total of all brands ("NEUZULASSUNGEN INSGESAMT"); SONSTIGE is KBA's "other brands". |
| `registrations` | integer | required; ≥ 0 | New passenger-car registrations in the month. |
| `bev` | integer | required; ≥ 0 | Of which battery-electric (KBA column "mit Elektroantrieb (BEV)"). |
| `phev` | integer | required; ≥ 0 | Of which plug-in hybrid (KBA column "Plug-in-Hybridantrieb"). |
| `diesel` | integer | required; ≥ 0 | Of which diesel (KBA column "mit Dieselantrieb"). |
| `ytd_registrations` | integer | may be empty; ≥ 0 | New registrations from January to this month of the same year. Empty where KBA marks the cell as a gap ("/", "X" or "."). |
| `ytd_bev` | integer | may be empty; ≥ 0 | Battery-electric, January to this month. Empty where KBA marks the cell as a gap ("/", "X" or "."). |
| `ytd_phev` | integer | may be empty; ≥ 0 | Plug-in hybrid, January to this month. Empty where KBA marks the cell as a gap ("/", "X" or "."). |
| `ytd_diesel` | integer | may be empty; ≥ 0 | Diesel, January to this month. Empty where KBA marks the cell as a gap ("/", "X" or "."). |

## data/clean.csv

The rows the dashboard's German-premium charts use: BMW, MINI, MERCEDES, PORSCHE and MARKET from every monthly FZ10 file, with the file each row came from.

One row per: month + brand.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `month` | string | required; pattern `^20\d\d-(0[1-9]\|1[0-2])$` | Calendar month the registrations were made in, YYYY-MM. |
| `brand` | string | required; one of: BMW, MINI, MERCEDES, PORSCHE, MARKET | BMW, MINI, MERCEDES, PORSCHE or MARKET (all brands). |
| `registrations` | integer | required; ≥ 0 | New passenger-car registrations in the month. |
| `bev` | integer | required; ≥ 0 | Of which battery-electric (KBA column "mit Elektroantrieb (BEV)"). |
| `phev` | integer | required; ≥ 0 | Of which plug-in hybrid. |
| `diesel` | integer | required; ≥ 0 | Of which diesel. |
| `ytd_registrations` | integer | required; ≥ 0 | New registrations from January to this month. |
| `ytd_bev` | integer | required; ≥ 0 | Battery-electric, January to this month. |
| `source_file` | string | required; pattern `^data/raw/kba/fz10_\d{4}_\d{2}\.xlsx$` | The unchanged KBA file in data/raw/kba/ the row was read from. |

## data/models.csv

Every model-series row of every monthly FZ10 file. KBA groups models by series, so one row can hold electric and combustion versions (e.g. BMW X3 includes the iX3).

One row per: month + brand + model.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `month` | string | required; pattern `^20\d\d-(0[1-9]\|1[0-2])$` | Calendar month the registrations were made in, YYYY-MM. |
| `brand` | string | required | Brand as in brands.csv. |
| `model` | string | required | Model series as KBA names it. |
| `registrations` | integer | required; ≥ 0 | New registrations of the series in the month. |
| `bev` | integer | may be empty; ≥ 0 | Of which battery-electric. Empty where KBA marks the cell as a gap ("/", "X" or "."). |
| `phev` | integer | may be empty; ≥ 0 | Of which plug-in hybrid. Empty where KBA marks the cell as a gap ("/", "X" or "."). |
| `diesel` | integer | may be empty; ≥ 0 | Of which diesel. Empty where KBA marks the cell as a gap ("/", "X" or "."). |
| `ytd_registrations` | integer | may be empty; ≥ 0 | January to this month. Empty where KBA marks the cell as a gap ("/", "X" or "."). |
| `ytd_bev` | integer | may be empty; ≥ 0 | Battery-electric, January to this month. Empty where KBA marks the cell as a gap ("/", "X" or "."). |
| `ytd_phev` | integer | may be empty; ≥ 0 | Plug-in hybrid, January to this month. Empty where KBA marks the cell as a gap ("/", "X" or "."). |
| `ytd_diesel` | integer | may be empty; ≥ 0 | Diesel, January to this month. Empty where KBA marks the cell as a gap ("/", "X" or "."). |

## data/keepers.csv

New registrations by keeper group and brand, January to the file's month, from KBA FZ8 table 8.9.1 (all drive types; KBA publishes no split by keeper and drive type per brand). total = private + commercial + unknown; commercial = dealer + manufacturer + rental + other_services + other_commercial.

One row per: month + brand.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `month` | string | required; pattern `^20\d\d-(0[1-9]\|1[0-2])$` | Last month of the January-to-month period, YYYY-MM. |
| `brand` | string | required | Brand as in brands.csv; MARKET is "INSGESAMT". |
| `total` | integer | required; ≥ 0 | All new registrations, January to month. |
| `private` | integer | required; ≥ 0 | Registered to private keepers. |
| `commercial` | integer | required; ≥ 0 | Registered to commercial keepers (sum of the five groups that follow). |
| `dealer` | integer | required; ≥ 0 | Registered to motor-vehicle dealers ("Kfz-Handel"), self-registrations by dealers. |
| `manufacturer` | integer | required; ≥ 0 | Registered to vehicle makers ("Kfz-Hersteller"), self-registrations by makers. |
| `rental` | integer | required; ≥ 0 | Registered to car-rental firms. |
| `other_services` | integer | required; ≥ 0 | Other service firms. |
| `other_commercial` | integer | required; ≥ 0 | Other commercial keepers. |
| `unknown` | integer | required; ≥ 0 | Keeper group not known. |

## data/keepers_bev.csv

Market-level new registrations by keeper group, all cars and battery-electric, January to the file's month, from KBA FZ28.3.

One row per: month + keeper_group.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `month` | string | required; pattern `^20\d\d-(0[1-9]\|1[0-2])$` | Last month of the January-to-month period, YYYY-MM. |
| `keeper_group` | string | required; one of: total, private, commercial, dealer, manufacturer, rental, unknown | total, private, commercial, dealer, manufacturer, rental or unknown. |
| `all` | integer | required; ≥ 0 | All new cars in the group. |
| `bev` | integer | required; ≥ 0 | Of which battery-electric. |

## data/ir_figures.csv

Company figures read from the BMW, Mercedes-Benz and Porsche reports, one per row, each with the report and page. data/ir_evidence.tsv holds the text each value was read from; validate.js re-reads it from the extracted report text.

One row per: company + period + metric.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `company` | string | required; one of: BMW, MERCEDES, PORSCHE | BMW (BMW Group), MERCEDES (Mercedes-Benz Group) or PORSCHE (Porsche AG). |
| `period` | string | required; pattern `^(H1-)?20\d\d$` | Financial year (YYYY) or half year (H1-YYYY). |
| `metric` | string | required | Short metric key, e.g. auto_margin (Automotive/Cars segment EBIT margin), global_bev_deliveries, ev_impairment. |
| `value` | number | required | The figure as the report prints it, in the unit of the next column. |
| `unit` | string | required; one of: %, pp, cars, EUR m, EUR bn | % , pp (percentage points), cars, EUR m or EUR bn. |
| `label` | string | required | The metric in words. |
| `source_file` | string | required | Local path of the report (fetched by scripts/fetch-sources.js; URL and SHA-256 in data/sources_fetch.tsv). |
| `page` | integer | required; ≥ 0 | Page of the PDF the value is printed on (1-based PDF page, not the printed folio). |

## data/ir_evidence.tsv

For every row of ir_figures.csv: the text fragment on the page that contains the value, and which position in it the value takes.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `company` | string | required | As in ir_figures.csv. |
| `period` | string | required | As in ir_figures.csv. |
| `metric` | string | required | As in ir_figures.csv. |
| `pos` | integer | required; ≥ 0 | Position of the value among the numbers in the fragment (1 = first). |
| `fragment` | string | required | Text as extracted from the page (whitespace collapsed). |
| `column_order` | string | required | The column headers the fragment's numbers follow, as the page prints them. |

## data/published_totals.csv

Totals that KBA prints in its press releases, with the line each is printed in; validate.js reads each from the fetched release with the pattern, checks the recorded number and line, and compares the number with the totals built from FZ10.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `label` | string | required | What the total is. |
| `period` | string | required; pattern `^20\d\d(-\d\d)?$` | Year (YYYY) or month (YYYY-MM). |
| `brand` | string | required | MARKET or a brand as in brands.csv. |
| `field` | string | required | Column of brands.csv the total is compared with. |
| `source_file` | string | required; pattern `^data/cache/press/` | Local copy of the press release, fetched into data/cache/press/ by scripts/fetch-sources.js (not in git; URL in data/sources_fetch.tsv and SOURCES.md). |
| `pattern` | string | required | Regular expression; its first group is the total as printed (German thousands separators). |
| `published` | integer | required; ≥ 0 | The total as KBA prints it (thousands separators removed). |
| `source_line` | string | required | The text of the release the pattern matches, as printed (German number format); the recorded total is read from it. |

## data/facts.tsv

Dates and policy facts the page states (bonus dates, KBA press figures, company statements), each with the source text it was taken from; validate.js finds the source text in the cached source.

One row per: key.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `key` | string | required | Name the page uses for the fact. |
| `value` | string | required | The fact as the page prints it. |
| `source` | string | required | Local path of the source page or report. |
| `source_text` | string | required | Exact text in the source that states the fact. |

## data/sources_fetch.tsv

Company reports and policy pages that are not redistributed: where scripts/fetch-sources.js downloads each and the SHA-256 the download must match.

One row per: local_file.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `local_file` | string | required | Path under data/cache/ (ignored by git). |
| `url` | string | required | Download URL. |
| `sha256` | string | required; pattern `^([0-9a-f]{64}\|-)$` | SHA-256 the download must match; - for web pages that change with every load (no pinned hash; their quoted text is checked instead). |
| `bytes` | string | required; pattern `^([0-9]+\|-)$` | Expected size in bytes; - where not pinned. |

## data/context_figures.tsv

Figures from outside the KBA data that the page states: VW Group's own Western European BEV market share and ACEA's EU and German BEV growth (EU anchor), fleet CO2 against EU targets, and the lowest German list price of an electric model per group. validate.js finds each quote on its cited page and the value inside the quote.

One row per: key.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `key` | string | required | Name the page and the claim checker use (ctx(key)). |
| `value` | number | required | The figure as a plain number (no thousands separator). |
| `unit` | string | required | Unit and basis, e.g. g CO2/km, % growth against Jan–Aug 2025, EUR incl. VAT. |
| `period` | string | required | Period or date the figure refers to. |
| `label` | string | required | What the figure is. |
| `source` | string | required; pattern `^data/cache/(context\|ir)/[^#\s]+(#\d+)?$` | Local path of the cached source; #n is the PDF page (1-based PDF page, not the printed folio). |
| `quote` | string | required | Text on that page that contains the value (whitespace and HTML tags ignored when compared). |

## data/memo_claims.tsv

Claim list for memo.md: each row finds one number or statement with a regular expression and recomputes it from the data; scripts/check-memo-numbers.js fails if any differs.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `label` | string | required | Short name of the claim. |
| `pattern` | string | required | Regular expression; its first group is the number as written in the document (no group: the sentence must be present). |
| `formula` | string | may be empty | JavaScript expression over the helper functions in check-memo-numbers.js; returns the expected text, or an empty string when a statement-only claim holds. |

## data/readme_claims.tsv

Claim list for README.md: each row finds one number or statement with a regular expression and recomputes it from the data; scripts/check-memo-numbers.js fails if any differs.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `label` | string | required | Short name of the claim. |
| `pattern` | string | required | Regular expression; its first group is the number as written in the document (no group: the sentence must be present). |
| `formula` | string | may be empty | JavaScript expression over the helper functions in check-memo-numbers.js; returns the expected text, or an empty string when a statement-only claim holds. |

## data/memo_de_claims.tsv

Claim list for memo.de.md (German translation; same formulas as memo_claims.tsv, patterns in German number format): each row finds one number or statement with a regular expression and recomputes it from the data; scripts/check-memo-numbers.js fails if any differs.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `label` | string | required | Short name of the claim. |
| `pattern` | string | required | Regular expression; its first group is the number as written in the document (no group: the sentence must be present). |
| `formula` | string | may be empty | JavaScript expression over the helper functions in check-memo-numbers.js; returns the expected text, or an empty string when a statement-only claim holds. |

## data/raw/kba/_download_log.tsv

Download log of the FZ10 files (no header row; columns in this order).

No header row.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `file` | string | required | File name in data/raw/kba/. |
| `url` | string | required | KBA download URL. |
| `http_status` | integer | required; ≥ 0 | HTTP status of the download. |
| `downloaded` | string | required; pattern `^\d{4}-\d\d-\d\d$` | Download date, YYYY-MM-DD. |

## data/raw/fz8/_download_log.tsv

Download log of the KBA FZ8 files.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `file` | string | required | File name in data/raw/fz8/. |
| `url` | string | required | KBA download URL. |
| `http_status` | integer | required; ≥ 0 | HTTP status of the download. |
| `downloaded` | string | required; pattern `^\d{4}-\d\d-\d\d$` | Download date, YYYY-MM-DD. |
| `bytes` | integer | required; ≥ 0 | Size in bytes. |
| `sha256` | string | required; pattern `^[0-9a-f]{64}$` | SHA-256 of the file. |

## data/raw/fz28/_download_log.tsv

Download log of the KBA FZ28 files.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `file` | string | required | File name in data/raw/fz28/. |
| `url` | string | required | KBA download URL. |
| `http_status` | integer | required; ≥ 0 | HTTP status of the download. |
| `downloaded` | string | required; pattern `^\d{4}-\d\d-\d\d$` | Download date, YYYY-MM-DD. |
| `bytes` | integer | required; ≥ 0 | Size in bytes. |
| `sha256` | string | required; pattern `^[0-9a-f]{64}$` | SHA-256 of the file. |


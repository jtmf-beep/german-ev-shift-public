# Sources

All files were downloaded on 8 October 2026 (2026-10-08). The KBA statistics files (FZ10, FZ8, FZ28) are stored unchanged in `data/raw/`. KBA press releases, the BAFA page, company reports and the other policy pages are not redistributed: `scripts/fetch-sources.js` downloads them into `data/cache/` (not in git) and checks each PDF against the SHA-256 recorded in `data/sources_fetch.tsv`; only the figures and short quotes used here are kept in the repository.

## What is redistributed, and under which terms

| Material | In this repository? | Terms | Reason |
|---|---|---|---|
| KBA FZ10, FZ8, FZ28 statistics files (`data/raw/kba`, `data/raw/fz8`, `data/raw/fz28`) | Yes, unchanged | Each file states "Datenlizenz Deutschland - Namensnennung - Version 2.0" and "© Kraftfahrt-Bundesamt, Flensburg". The licence (https://www.govdata.de/dl-de/by-2-0) allows copying and passing the data to third parties if the provider, the licence and the dataset are named and changes are marked. KBA's copyright notice (https://www.kba.de/DE/Service/Hinweise/urheberrechtliche_inhalt.html) allows reproduction and distribution with the source named. | Allowed with attribution; attribution and "processed by the author" are given here, in the README and on the dashboard. The files hold only KBA's statistics service address and phone, no named person. |
| KBA press releases 01/2026 and 41/2026 | No: fetched; numbers and their source lines in `data/published_totals.csv` | KBA copyright notice above (reproduction with source named) | Each release names a press officer with phone, fax and e-mail; that is third-party personal data, so the files stay out. |
| BAFA notice of 19 May 2026 | No: fetched; quoted sentences in `data/facts.tsv` | BAFA imprint (https://www.bafa.de/DE/Service/Impressum/impressum_node.html): texts under Creative Commons Attribution-NoDerivatives 3.0 Germany "unless marked otherwise"; the saved page also carries a photo credited to Getty Images | Redistribution of the whole saved page is not clearly allowed (the licence covers texts only), so it is fetched instead. |
| Company reports, press information and web pages (BMW, Mercedes-Benz, Porsche, Volkswagen, Stellantis, ACEA, price pages), Federal Government, BMF, BMUKN and EU pages | No: fetched | No licence that allows redistribution was found for these files | Only figures (facts) and short quotes with their source and page are kept (`data/ir_figures.csv`, `data/ir_evidence.tsv`, `data/context_figures.tsv`, the quoted-statements table below). |

## Kraftfahrt-Bundesamt (KBA): registrations

- Product page, FZ10 "Neuzulassungen von Personenkraftwagen nach Marken und Modellreihen" (monthly): https://www.kba.de/DE/Statistik/Produktkatalog/produkte/Fahrzeuge/fz10/fz10_gentab.html
- Product page, FZ8 "Neuzulassungen ... nach Marken und ausgewählten Haltergruppen" (keeper groups, monthly; table 8.9.1 is January to the report month): https://www.kba.de/DE/Statistik/Produktkatalog/produkte/Fahrzeuge/fz8/fz8_gentab.html. Files used, downloaded 8 October 2026 and logged with URL and SHA-256 in `data/raw/fz8/_download_log.tsv`: fz8_202508.xlsx, fz8_202509.xlsx, fz8_202608.xlsx. FZ8 for September 2026 was not yet published on that date.
- Licence: Datenlizenz Deutschland – Namensnennung – Version 2.0 (dl-de/by-2-0, https://www.govdata.de/dl-de/by-2-0), stated in each file. Source: © Kraftfahrt-Bundesamt, Flensburg. `data/brands.csv`, `data/models.csv`, `data/keepers.csv`, `data/clean.csv` and `docs/data.js` are processed extracts (rows selected, months combined) made by the author.

Press releases used for the reconciliation in `scripts/validate.js`. They are not stored in this repository, because each names a KBA press officer with phone, fax and e-mail. `scripts/fetch-sources.js` downloads them into `data/cache/press/` (not in git); the figures used, each with the line of the release it is printed in, are kept in `data/published_totals.csv`, and `validate.js` checks every one against the fetched release.

| File | Release, URL, retrieved (local copy fetched, not in git) | Figures used |
|---|---|---|
| data/cache/press/kba_pm01_2026_dez2025.html | KBA Pressemitteilung Nr. 01/2026 "Fahrzeugzulassungen im Dezember 2025 - Jahresbilanz", https://www.kba.de/DE/Presse/Pressemitteilungen/Fahrzeugzulassungen/2026/pm01_2026_n_12_25_pm_komplett.html, retrieved 2026-10-08 (text unchanged on 2026-10-16) | Nr. 01/2026, 6 January 2026: 2,857,591 new cars in 2025, 545,142 BEV; brand totals for BMW, Mercedes, Porsche |
| data/cache/press/kba_pm41_2026_sep2026.html | KBA Pressemitteilung Nr. 41/2026 "Fahrzeugzulassungen im September 2026", https://www.kba.de/DE/Presse/Pressemitteilungen/Fahrzeugzulassungen/2026/pm41_2026_n_09_26_pm_komplett.html, retrieved 2026-10-08 (text unchanged on 2026-10-16) | Nr. 41/2026, 5 October 2026: 256,774 new cars in September 2026, 88,599 BEV, 27,681 plug-in hybrids, 2,221,798 January to September; private owners' share 40.3%; brand totals |

PDF versions of the same releases (not used by any script, not stored): Nr. 01/2026, https://www.kba.de/SharedDocs/Downloads/DE/Pressemitteilungen/2026/pm_01_2026_fahrzeugzulassungen_12_2025.pdf?__blob=publicationFile&v=4; Nr. 41/2026, https://www.kba.de/SharedDocs/Downloads/DE/Pressemitteilungen/2026/pm_41_2026_fahrzeugzulassungen_09_2026.pdf?__blob=publicationFile&v=5.

## Company reports: margins, deliveries, electric-transition costs

Each figure, with its PDF page, is in `data/ir_figures.csv`.

| File | Publisher and document | URL |
|---|---|---|
| data/cache/ir/bmw_AR2025.pdf | BMW Group Report 2025 | https://www.bmwgroup.com/content/dam/grpw/websites/bmwgroup_com/ir/downloads/en/2026/bericht/BMW-Group-Report-2025-en.pdf |
| data/cache/ir/bmw_H1_2026.pdf | BMW Group Quarterly Statement / Half-Year Report Q2 2026 | https://www.bmwgroup.com/content/dam/grpw/websites/bmwgroup_com/ir/downloads/en/2026/q2/BMW_Q2-2026-EN.pdf |
| data/cache/ir/mb_AR2022.pdf | Mercedes-Benz Group Annual Report 2022 | https://group.mercedes-benz.com/documents/investors/reports/annual-report/mercedes-benz/mercedes-benz-annual-report-2022-incl-combined-management-report-mbg-ag.pdf |
| data/cache/ir/mb_AR2024.pdf | Mercedes-Benz Group Annual Report 2024 | https://group.mercedes-benz.com/documents/investors/reports/annual-report/mercedes-benz/mercedes-benz-annual-report-2024-incl-combined-management-report-mbg-ag.pdf |
| data/cache/ir/mb_FY2025_press.pdf | Mercedes-Benz Group press information, annual results 2025, 12 February 2026 | https://media.mercedes-benz.nl/download/47b110a2-e280-46bb-a2ca-f3442b0da31e/20260212_mbgroupag_pressinformation_annualresults_2025_capitalmarketday-embargo.pdf |
| data/cache/ir/mb_Q2_2026_press.pdf | Mercedes-Benz Group press information, Q2 2026 results | https://media.mercedes-benz.it/download/6e8308fc-63fb-4798-8414-8f8329766675/mercedes-benz_group_ag_press_information_financial_results_q2_2026.pdf |
| data/cache/ir/por_AR2023.pdf | Porsche AG Annual and Sustainability Report 2023 | https://investorrelations.porsche.com/~/media/Files/P/porsche-ir/results-and-presentations/financial-reports-and-presentation/2023/q4-and-full-year/annual-and-sustainability-report-2023-porsche-ag-consolidated-financial-statements-ifrs.pdf |
| data/cache/ir/por_AR2025.pdf | Porsche AG Annual and Sustainability Report 2025 | https://investorrelations.porsche.com/~/media/Files/P/porsche-ir/results-and-presentations/financial-reports-and-presentation/2025/q4/annual-and-sustainability-report-2025-porsche-ag-consolidated-financial-statements-ifrs.pdf |
| data/cache/ir/por_H1_2026.pdf | Porsche AG Half-Year Financial Report 2026 | https://investorrelations.porsche.com/~/media/Files/P/porsche-ir/results-and-presentations/financial-reports-and-presentation/2026/q2/half-year-financial-report-2026-en.pdf |
| data/cache/ir/por_realignment_2025-09-19.pdf | Porsche AG update on strategic realignment, 19 September 2025 (context only, no figure used) | https://investorrelations.porsche.com/~/media/Files/P/porsche-ir/results-and-presentations/financial-reports-and-presentation/2025/other/2025-09-19-porsche-ag-update-strategic-realignment.pdf |

Note on Mercedes-Benz: the 2022 and 2024 annual reports come from group.mercedes-benz.com (downloaded 8 October 2026); the 2025 and 2026 figures come from Mercedes-Benz's own media sites. An earlier build used the annualreports.com archive copies; the 2022 copy is byte-identical to the company's file, and every cited figure and quote was re-checked on the company's 2024 file, which differs in bytes.

## Statements quoted in words (no number in data/ir_figures.csv)

| Claim on the dashboard or in the memo | Source, page | Exact wording |
|---|---|---|
| Porsche reports fewer combustion cars in Europe | data/cache/ir/por_AR2025.pdf, p. 51 | "supply shortages of the 718 Boxster/Cayman and the Macan models with combustion engines due to European cyber security regulations" |
| Porsche offers the combustion Macan mainly outside the EU | data/cache/ir/por_AR2025.pdf, p. 51 | "In most countries outside the European Union, the Porsche AG Group continues to offer the Macan with combustion engine" |
| Porsche names weak demand in China | data/cache/ir/por_AR2025.pdf, p. 52 | "the challenging market conditions in China, particularly in the luxury segment, and the very intense competition, especially for all-electric models, continued to have an impact on business performance" |
| Mercedes-Benz names lower volumes in China | data/cache/ir/mb_FY2025_press.pdf, p. 2 | "lower volumes, particularly in China, negative net pricing, tariffs and foreign exchange" |
| Mercedes-Benz booked EUR 380m of impairment losses on vehicles with electric drives (in the leased-assets note) | data/cache/ir/mb_AR2024.pdf, p. 341 (equipment on operating leases note) | "Due to the slower transition to all-electric vehicles, impairment losses of €380 million (2023: €8 million) were recorded for vehicles with electric drives in cost of sales mainly in the Mercedes-Benz Cars segment." |
| Mercedes-Benz Cars still counted smart units in 2024 (columns: 2024, 2023) | data/cache/ir/mb_AR2024.pdf, p. 47 | "smart 5,696 18,054" |
| Leapmotor International is a 51% Stellantis / 49% Leapmotor joint venture | data/cache/context/stla_2026-05_leapmotor_next_level.html | "Leapmotor International (“LPMI”) was launched as a 51% Stellantis / 49% Leapmotor joint venture with exclusive rights for the sale and manufacturing of Leapmotor products outside Greater China." |
| Leapmotor cars are sold in Germany through Leapmotor International | data/cache/context/stla_2024-09_leapmotor_orders_europe.html | "Initial markets for Leapmotor vehicles in Europe will be Belgium, France, Germany, Greece, Italy, Luxemburg, Malta, The Netherlands, Portugal, Romania, Spain, Switzerland, and the UK." |
| EU countervailing duties apply to imports of battery-electric vehicles from China | data/cache/context/eu_2024-2754_duties_china_bev.xhtml | "A definitive countervailing duty is imposed on imports of new battery electric vehicles, principally designed for the transport of nine or less persons, including the driver" |
| Duty rate for the BYD Group | data/cache/context/eu_2024-2754_duties_china_bev.xhtml | "BYD Group: 17,0 %" |
| Plug-in hybrids are outside the scope of the duties | data/cache/context/eu_2024-2754_duties_china_bev.xhtml | "Therefore, contrary to BEVs with a range extender, PHEV were indeed not covered by the scope of the investigation." |
| EU CO2 targets for cars are assessed over 2025 to 2027 together | data/cache/context/eu_2025-1214_co2_three_years.xhtml | "for the three-year period comprising the calendar years 2025 to 2027, a manufacturer, including when it is a member of a pool, shall ensure that its average specific emissions of CO 2 over that period do not exceed its specific emissions target over that period." |
| Carmakers may form pools to meet the CO2 targets | data/cache/context/eu_2019-631_co2_cars.xhtml | "Manufacturers, other than manufacturers which have been granted a derogation under Article 10, may form a pool for the purposes of meeting their obligations under Article 4." |
| The 2026 bonus is limited to households with taxable income up to EUR 80,000 (plus EUR 5,000 per child) | data/cache/context/bafa_richtlinie_e-auto_2026.pdf, p. 3 | "deren zu versteuerndes Haushaltjahreseinkommen 80 000 Euro, zuzüglich 5 000 Euro pro förderrelevantem Kind, höchstens jedoch 90 000 Euro, nicht übersteigt." |
| Plug-in hybrids qualify only up to 60 g CO2/km or from 80 km electric range | data/cache/context/bafa_richtlinie_e-auto_2026.pdf, p. 5 | "Für von außen aufladbare Hybridelektrofahrzeuge, die CO2-Emissionen von höchstens 60 Gramm je Kilometer oder eine elektrische Reichweite von mindestens 80 Kilometer aufweisen" |
| The programme has EUR 3 billion for about 800,000 vehicles | data/cache/context/bmukn_pr_ev_support_2026.html | "The total funding available for the scheme, 3 billion euros, will be enough for an estimated 800,000 vehicles for the 2026 to 2029 period." |
| The list-price cap for the reduced company-car tax on electric cars rose from EUR 70,000 to EUR 100,000 | data/cache/context/bmf_wachstumsbooster.html | "Dienstwagenbesteuerung: Anhebung der Bruttolistenpreisgrenze für Elektrofahrzeuge von 70.000 Euro auf 100.000 Euro" |
| Porsche ad hoc release, 19 September 2025: platform reschedule | data/cache/context/por_adhoc_2025-09-19.html | "the rescheduling of the new platform for electric vehicles will necessitate depreciation and provisions, which are expected to burden the operating profit by up to €1.8 billion in the 2025 financial year." |
| Porsche presentation, 19 September 2025: battery special expenses | data/cache/ir/por_realignment_2025-09-19.pdf, p. 13 | "the total amount of special expenses in the fiscal year 2025 will increase from €0.8 billion to €1. 3 billion, affecting results." |
| BMW CFO (as reported by Reuters, secondary source): iX3 margin parity in 2026 | data/cache/context/reuters_copy_bmw_margin_parity_2025-09.html | "With the iX3 50, BMW could achieve margins equal to combustion engine equivalents -- so-called margin parity -- already in 2026, Mertl said." |
| Mercedes-Benz (company claim): BEV/ICE margin gap closable by end of the decade | data/cache/context/mb_roadshow_q1-2026.pdf, p. 31 | "Considering all costs incl. CO 2 closing the BEV/ICE margin gap by end of this decade feasible" |
| BMW Automotive EBIT margin guidance for 2026 | data/cache/ir/bmw_H1_2026.pdf, p. 21 | "the EBIT margin for the Automotive segment is expected to be in the range of 1% to 3%." |
| Mercedes-Benz Cars return-on-sales guidance for 2026 | data/cache/ir/mb_FY2025_press.pdf, p. 6 | "Mercedes-Benz Cars 5% 3 to 5%" |
| Porsche Group return-on-sales forecast for 2026 | data/cache/ir/por_H1_2026.pdf, p. 17 | "Return on sales % 1.1 5.5 to 7.5" |
| Volkswagen AG forecast for 2026, September 2026 | data/cache/context/vw_adhoc_forecast_2026-09-18.html | "The company now expects to achieve an Operating Return on Sales of up to 1 percent (2025: 2.8 percent; previous forecast 4.0 to 5.5 percent; average analyst expectation: 4.1 percent)." |
| KBA publishes FZ10 for October 2026 on 6 November 2026 | data/cache/context/kba_kalender_2026-11.html | "06. Nov. FZ 10, Monatliche Neuzulassungen von Personenkraftwagen nach Marken und Modellreihen - Oktober 2026" |
| BMW publishes its third-quarter statement on 4 November 2026 | data/cache/ir/bmw_AR2025.pdf, p. 432 | "4 November 2026 Quarterly Statement to 30 September 2026" |
| Mercedes-Benz publishes its third-quarter report on 28 October 2026 | data/cache/context/mb_ir_events.html | "28 Oct 2026 Interim Report Q3 2026" |
| Porsche publishes its third-quarter statement on 27 October 2026 | data/cache/context/por_ir_calendar.html | "27 October 2026 Publication Quarterly Statement (call-date Q3)" |
| Volkswagen publishes its January-September report on 29 October 2026 | data/cache/context/vw_events.html | "29 Oct 2026 Interim Report January – September 2026" |

## Policy context (dates only; the project does not measure policy effects)

| File | Publisher and document | URL | Fact used |
|---|---|---|---|
| data/cache/context/bundesregierung_faq_umweltbonus.html | Federal Government, FAQ "Umweltbonus läuft aus" | https://www.bundesregierung.de/breg-de/aktuelles/faq-umweltbonus-1993830 | No new applications for the federal purchase bonus after 17 December 2023 |
| data/cache/context/bafa_e-auto-foerderung_2026-05-19.html (fetched, not in git) | BAFA, notice of 19 May 2026: applications open, "E-Auto-Förderung: Digitale Antragstellung ab jetzt möglich", retrieved 2026-10-08 (text unchanged on 2026-10-16) | https://www.bafa.de/SharedDocs/Kurzmeldungen/DE/Energie/E-Auto-Foerderung/20260519_E-Auto-Foerderung.html | New income-tested bonus for private buyers |
| data/cache/context/bafa_richtlinie_e-auto_2026.pdf (fetched, not in git) | BAFA, directive of 19 May 2026 (BAnz AT 19.06.2026 B3) | https://www.bafa.de/SharedDocs/Downloads/DE/Energie/Energieeffizienz/E-Auto_Foerderung_2026/Richtline_E-Auto.pdf?__blob=publicationFile&v=3 | Covers new cars first registered from 1 January 2026 |
| data/cache/context/porsche_cmd_2026-10-07.html (fetched, not in git) | Porsche AG press release, Capital Markets Day, 7 October 2026 | https://newsroom.porsche.com/en/2026/company/porsche-capital-markets-day-strategy-sportwagenschmiede-35-43419.html | Medium-term target: "Group operating return on sales of 10 to 15 per cent"; no new charge amounts given |

## KBA FZ10 monthly files (69)

| File | URL | Downloaded |
|---|---|---|
| data/raw/kba/fz10_2021_01.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2021_01.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2021_02.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2021_02.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2021_03.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2021_03.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2021_04.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2021_04.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2021_05.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2021_05.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2021_06.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2021_06.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2021_07.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2021_07.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2021_08.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2021_08.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2021_09.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2021_09.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2021_10.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2021_10.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2021_11.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2021_11.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2021_12.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2021_12.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2022_01.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2022_01.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2022_02.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2022_02.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2022_03.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2022_03.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2022_04.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2022_04.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2022_05.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2022_05.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2022_06.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2022_06.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2022_07.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2022_07.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2022_08.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2022_08.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2022_09.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2022_09.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2022_10.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2022_10.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2022_11.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2022_11.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2022_12.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2022_12.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2023_01.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2023_01.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2023_02.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2023_02.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2023_03.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2023_03.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2023_04.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2023_04.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2023_05.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2023_05.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2023_06.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2023_06.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2023_07.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2023_07.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2023_08.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2023_08.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2023_09.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2023_09.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2023_10.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2023_10.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2023_11.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2023_11.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2023_12.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2023_12.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2024_01.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2024_01.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2024_02.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2024_02.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2024_03.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2024_03.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2024_04.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2024_04.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2024_05.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2024_05.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2024_06.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2024_06.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2024_07.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2024_07.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2024_08.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2024_08.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2024_09.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2024_09.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2024_10.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2024_10.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2024_11.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2024_11.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2024_12.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2024_12.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2025_01.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2025_01.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2025_02.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2025_02.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2025_03.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2025_03.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2025_04.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2025_04.xlsx?__blob=publicationFile&v=3 | 2026-10-08 |
| data/raw/kba/fz10_2025_05.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2025_05.xlsx?__blob=publicationFile&v=4 | 2026-10-08 |
| data/raw/kba/fz10_2025_06.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2025_06.xlsx?__blob=publicationFile&v=7 | 2026-10-08 |
| data/raw/kba/fz10_2025_07.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2025_07.xlsx?__blob=publicationFile&v=3 | 2026-10-08 |
| data/raw/kba/fz10_2025_08.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2025_08.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2025_09.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2025_09.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2025_10.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2025_10.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2025_11.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2025_11.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2025_12.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2025_12.xlsx?__blob=publicationFile&v=5 | 2026-10-08 |
| data/raw/kba/fz10_2026_01.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2026_01.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2026_02.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2026_02.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |
| data/raw/kba/fz10_2026_03.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2026_03.xlsx?__blob=publicationFile&v=4 | 2026-10-08 |
| data/raw/kba/fz10_2026_04.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2026_04.xlsx?__blob=publicationFile&v=3 | 2026-10-08 |
| data/raw/kba/fz10_2026_05.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2026_05.xlsx?__blob=publicationFile&v=3 | 2026-10-08 |
| data/raw/kba/fz10_2026_06.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2026_06.xlsx?__blob=publicationFile&v=3 | 2026-10-08 |
| data/raw/kba/fz10_2026_07.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2026_07.xlsx?__blob=publicationFile&v=3 | 2026-10-08 |
| data/raw/kba/fz10_2026_08.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2026_08.xlsx?__blob=publicationFile&v=3 | 2026-10-08 |
| data/raw/kba/fz10_2026_09.xlsx | https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/FZ10/fz10_2026_09.xlsx?__blob=publicationFile&v=2 | 2026-10-08 |

## Context outside Germany's registrations (data/context_figures.tsv)

Each row of `data/context_figures.tsv` holds one figure with its cached source, page and the quoted text; `node scripts/validate.js` (section 12) finds the quote on that page and the figure inside the quote. Downloaded 9 October 2026 by `scripts/fetch-sources.js` (URLs and SHA-256 in `data/sources_fetch.tsv`); not redistributed.

| Use | Source | Note |
|---|---|---|
| VW Group's BEV market share in Western Europe, first half of 2026 and 2025 | Volkswagen AG, Half-Yearly Financial Report January–June 2026, PDF p. 11 | Volkswagen's own market estimate; it publishes January–September on 29 October 2026. Its definition of Western Europe is not stated there (UNVERIFIED). |
| EU and German BEV registrations, January–August 2026 | ACEA press release, new car registrations August 2026, p. 4 | ACEA's January–September release was not out on 9 October 2026. ACEA's German figure equals KBA FZ28 (515,545). ACEA gives no BEV split by manufacturer. |
| Fleet CO2 and targets per pool, 2024 | Commission Implementing Decision (EU) 2026/1907 of 29 July 2026, Annex I, Tables 1 and 2 | 2024 is the latest year the Commission has confirmed; Porsche's row is its stand-alone value inside the Volkswagen pool. |
| BMW Group EU fleet CO2 and stated limit, 2025 | BMW Group Report 2025, p. 126 | BMW's preliminary internal calculation (±0.5 g/km, p. 12). |
| Mercedes-Benz European passenger-car fleet CO2, 2025 | Mercedes-Benz Group Annual Report 2025, PDF p. 407 | Marked as an internal value; the report states no target. |
| Lowest electric list prices | Volkswagen, MINI, Mercedes-Benz, Porsche, BYD and Dacia German model pages; Citroën ë-C3 price list of 1 July 2026; Leapmotor T03 price list of 1 May 2026 | Prices before the federal bonus and discounts. MINI's page data and Dacia's page do not state the VAT basis (UNVERIFIED). Tesla's German site refused automated access (HTTP 403), so Tesla is missing. A web page whose price has changed since it was saved fails validate.js on a fresh download: re-date or drop the row. |

## Limits of the checks

What is checked: every number and bold heading in the memo, and every number in README.md prose, against a claim recomputed from the data; brand totals against the market total, model series against their brand and FZ8 keeper totals against FZ10, every month; policy dates and quoted statements against their source wording (`data/facts.tsv`, SOURCES.md); every company figure at its position in a quoted table row; the press-release figures listed in SOURCES.md; that memo.pdf was printed from the current memo.md. What is not: (1) the claim files (`data/memo_claims.tsv`, `data/memo_de_claims.tsv`) are trusted — a formula must read the data, but a wrong formula written together with a wrong sentence would pass; (2) the year each company figure belongs to is mapped by hand from the table header (the `column_order` note in `data/ir_evidence.tsv`), so a coordinated edit of a value and its position would pass; (3) the checks read digits, not number words, and a sentence without digits or bold is pinned only as the exact text a claim matches, so words added after it (for example "except at BMW") pass; (4) dashboard sentences are generated from the data with their direction words chosen from it, but are not tested claim by claim (the link-preview tags in the page head are: check-browser.js fails if they hold a number the page does not compute); (5) in README.md, numbers inside links, URLs, code blocks and names such as FZ10 or iX3 are not claims, and README sentences without a number are not tested; (6) a whole sentence added without any digit, such as "BMW will win the race", passes every check (shown by the planted-error runs).

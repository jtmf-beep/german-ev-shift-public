// Brands (as KBA FZ10 names them) grouped by owner in 2026. Used by build.js, competitors.js and the
// memo checker, so every group figure is computed from the same list.
// Porsche AG is controlled by Volkswagen AG; it is kept out of "VW GROUP" so it can be compared on its
// own with BMW Group and Mercedes-Benz, and "VW GROUP INCL. PORSCHE" adds it back.
// "CHINESE BRANDS" are brands launched by carmakers headquartered in China (MG Roewe belongs to SAIC).
// Volvo, Polestar and smart have Chinese owners or co-owners (Geely) but are not counted as Chinese brands.
// "BMW GROUP" is BMW and MINI; Rolls-Royce (42 electric registrations in January-September 2026, under
// 0.01% of the market) is left out so the group can be built for every year from data/clean.csv.
const GROUPS = {
  'BMW GROUP': ['BMW', 'MINI'],
  'MERCEDES-BENZ': ['MERCEDES'],
  'VW GROUP': ['VW', 'AUDI', 'SKODA', 'SEAT', 'BENTLEY', 'LAMBORGHINI'],
  'VW GROUP INCL. PORSCHE': ['VW', 'AUDI', 'SKODA', 'SEAT', 'BENTLEY', 'LAMBORGHINI', 'PORSCHE'],
  'STELLANTIS': ['OPEL', 'CITROEN', 'PEUGEOT', 'FIAT', 'DS', 'JEEP', 'ALFA ROMEO', 'LANCIA', 'MASERATI'],
  'RENAULT GROUP': ['RENAULT', 'DACIA', 'ALPINE'],
  'HYUNDAI-KIA': ['HYUNDAI', 'KIA'],
  'CHINESE BRANDS': ['BYD', 'LEAPMOTOR', 'MG ROEWE', 'XPENG', 'NIO', 'ZEEKR', 'LYNK & CO', 'GEELY', 'GWM', 'CHERY', 'OMODA', 'JAECOO', 'DEEPAL', 'DONGFENG', 'JAC', 'MAXUS'],
};
// Leapmotor is a brand of the Chinese carmaker Leapmotor, but outside China its cars are sold by
// Leapmotor International, a 51% Stellantis / 49% Leapmotor joint venture (Stellantis, SOURCES.md).
// The alternative grouping is shown next to every Chinese-brand figure. Groups whose name contains
// "INCL." or "EXCL." are variants: they are never counted alongside the main groups.
GROUPS['STELLANTIS INCL. LEAPMOTOR'] = [...GROUPS.STELLANTIS, 'LEAPMOTOR'];
GROUPS['CHINESE BRANDS EXCL. LEAPMOTOR'] = GROUPS['CHINESE BRANDS'].filter(b => b !== 'LEAPMOTOR');
const isVariant = g => / (INCL|EXCL)\. /.test(g);
module.exports = { GROUPS, isVariant };

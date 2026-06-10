/**
 * Polish cities + districts for the LocationPicker combobox.
 *
 * Scope: top ~80 cities by population (every wojewódzkie capital + every
 * city >50k inhabitants). Districts only for the 5 cities where they
 * matter most (Warszawa, Kraków, Łódź, Wrocław, Poznań) — adding the rest
 * is just a data edit, no code change.
 *
 * The filter pipeline (getTrainers → location substring match) treats
 * "Warszawa" and "Warszawa, Mokotów" identically for now: both narrow to
 * trainers whose `trainers.location` contains "Warszawa". District-level
 * narrowing needs migration 02X (add trainers.city + trainers.district
 * structured columns); the picker is forward-compatible.
 */

export type CityEntry = {
  /** Display name. */
  name: string;
  /** Województwo for disambiguation when two cities share a name. */
  voivodeship: string;
  /** District / dzielnica list. Order: most common first. */
  districts?: string[];
};

export const PL_CITIES: CityEntry[] = [
  // Top 20 by population — wojewódzkie capitals get districts.
  {
    name: "Warszawa",
    voivodeship: "mazowieckie",
    districts: [
      "Śródmieście", "Mokotów", "Wola", "Ochota", "Praga-Południe", "Praga-Północ",
      "Żoliborz", "Bielany", "Bemowo", "Ursynów", "Wilanów", "Białołęka",
      "Targówek", "Ursus", "Włochy", "Wawer", "Rembertów", "Wesoła",
    ],
  },
  {
    name: "Kraków",
    voivodeship: "małopolskie",
    districts: [
      "Stare Miasto", "Grzegórzki", "Prądnik Czerwony", "Prądnik Biały", "Krowodrza",
      "Bronowice", "Zwierzyniec", "Dębniki", "Łagiewniki-Borek Fałęcki", "Swoszowice",
      "Podgórze Duchackie", "Bieżanów-Prokocim", "Podgórze", "Czyżyny", "Mistrzejowice",
      "Bieńczyce", "Wzgórza Krzesławickie", "Nowa Huta",
    ],
  },
  {
    name: "Łódź",
    voivodeship: "łódzkie",
    districts: ["Bałuty", "Górna", "Polesie", "Śródmieście", "Widzew"],
  },
  {
    name: "Wrocław",
    voivodeship: "dolnośląskie",
    districts: ["Stare Miasto", "Śródmieście", "Krzyki", "Fabryczna", "Psie Pole"],
  },
  {
    name: "Poznań",
    voivodeship: "wielkopolskie",
    districts: ["Stare Miasto", "Nowe Miasto", "Grunwald", "Jeżyce", "Wilda"],
  },
  { name: "Gdańsk",   voivodeship: "pomorskie" },
  { name: "Szczecin", voivodeship: "zachodniopomorskie" },
  { name: "Bydgoszcz", voivodeship: "kujawsko-pomorskie" },
  { name: "Lublin",   voivodeship: "lubelskie" },
  { name: "Białystok", voivodeship: "podlaskie" },
  { name: "Katowice", voivodeship: "śląskie" },
  { name: "Gdynia",   voivodeship: "pomorskie" },
  { name: "Częstochowa", voivodeship: "śląskie" },
  { name: "Radom",    voivodeship: "mazowieckie" },
  { name: "Sosnowiec", voivodeship: "śląskie" },
  { name: "Toruń",    voivodeship: "kujawsko-pomorskie" },
  { name: "Kielce",   voivodeship: "świętokrzyskie" },
  { name: "Rzeszów",  voivodeship: "podkarpackie" },
  { name: "Gliwice",  voivodeship: "śląskie" },
  { name: "Zabrze",   voivodeship: "śląskie" },

  // 21-40
  { name: "Olsztyn",  voivodeship: "warmińsko-mazurskie" },
  { name: "Bielsko-Biała", voivodeship: "śląskie" },
  { name: "Bytom",    voivodeship: "śląskie" },
  { name: "Zielona Góra", voivodeship: "lubuskie" },
  { name: "Rybnik",   voivodeship: "śląskie" },
  { name: "Ruda Śląska", voivodeship: "śląskie" },
  { name: "Tychy",    voivodeship: "śląskie" },
  { name: "Opole",    voivodeship: "opolskie" },
  { name: "Gorzów Wielkopolski", voivodeship: "lubuskie" },
  { name: "Dąbrowa Górnicza", voivodeship: "śląskie" },
  { name: "Płock",    voivodeship: "mazowieckie" },
  { name: "Elbląg",   voivodeship: "warmińsko-mazurskie" },
  { name: "Wałbrzych", voivodeship: "dolnośląskie" },
  { name: "Włocławek", voivodeship: "kujawsko-pomorskie" },
  { name: "Tarnów",   voivodeship: "małopolskie" },
  { name: "Chorzów",  voivodeship: "śląskie" },
  { name: "Koszalin", voivodeship: "zachodniopomorskie" },
  { name: "Kalisz",   voivodeship: "wielkopolskie" },
  { name: "Legnica",  voivodeship: "dolnośląskie" },
  { name: "Grudziądz", voivodeship: "kujawsko-pomorskie" },

  // 41-80
  { name: "Słupsk",   voivodeship: "pomorskie" },
  { name: "Jaworzno", voivodeship: "śląskie" },
  { name: "Jastrzębie-Zdrój", voivodeship: "śląskie" },
  { name: "Jelenia Góra", voivodeship: "dolnośląskie" },
  { name: "Nowy Sącz", voivodeship: "małopolskie" },
  { name: "Konin",    voivodeship: "wielkopolskie" },
  { name: "Piotrków Trybunalski", voivodeship: "łódzkie" },
  { name: "Inowrocław", voivodeship: "kujawsko-pomorskie" },
  { name: "Lubin",    voivodeship: "dolnośląskie" },
  { name: "Mysłowice", voivodeship: "śląskie" },
  { name: "Piekary Śląskie", voivodeship: "śląskie" },
  { name: "Suwałki",  voivodeship: "podlaskie" },
  { name: "Ostrów Wielkopolski", voivodeship: "wielkopolskie" },
  { name: "Stargard", voivodeship: "zachodniopomorskie" },
  { name: "Siedlce",  voivodeship: "mazowieckie" },
  { name: "Gniezno",  voivodeship: "wielkopolskie" },
  { name: "Ostrowiec Świętokrzyski", voivodeship: "świętokrzyskie" },
  { name: "Pabianice", voivodeship: "łódzkie" },
  { name: "Świętochłowice", voivodeship: "śląskie" },
  { name: "Stalowa Wola", voivodeship: "podkarpackie" },
  { name: "Pruszków", voivodeship: "mazowieckie" },
  { name: "Tomaszów Mazowiecki", voivodeship: "łódzkie" },
  { name: "Legionowo", voivodeship: "mazowieckie" },
  { name: "Mielec",   voivodeship: "podkarpackie" },
  { name: "Tarnobrzeg", voivodeship: "podkarpackie" },
  { name: "Łomża",    voivodeship: "podlaskie" },
  { name: "Tczew",    voivodeship: "pomorskie" },
  { name: "Chełm",    voivodeship: "lubelskie" },
  { name: "Biała Podlaska", voivodeship: "lubelskie" },
  { name: "Bełchatów", voivodeship: "łódzkie" },
  { name: "Świdnica", voivodeship: "dolnośląskie" },
  { name: "Zamość",   voivodeship: "lubelskie" },
  { name: "Przemyśl", voivodeship: "podkarpackie" },
  { name: "Kędzierzyn-Koźle", voivodeship: "opolskie" },
  { name: "Krosno",   voivodeship: "podkarpackie" },
  { name: "Piła",     voivodeship: "wielkopolskie" },
  { name: "Ełk",      voivodeship: "warmińsko-mazurskie" },
  { name: "Świnoujście", voivodeship: "zachodniopomorskie" },
  { name: "Skierniewice", voivodeship: "łódzkie" },
  { name: "Żory",     voivodeship: "śląskie" },
];

/** Strip Polish diacritics for case- and accent-insensitive search. */
export function normalizeLocationQuery(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[łŁ]/g, "l")
    .replace(/[żźŻŹ]/g, "z")
    .replace(/[ąĄ]/g, "a")
    .replace(/[ćĆ]/g, "c")
    .replace(/[ęĘ]/g, "e")
    .replace(/[ńŃ]/g, "n")
    .replace(/[óÓ]/g, "o")
    .replace(/[śŚ]/g, "s")
    .toLowerCase();
}

export type LocationOption = {
  /** Token to put in the input + URL (e.g. "Warszawa" or "Warszawa, Mokotów"). */
  value: string;
  /** Bold primary label. */
  primary: string;
  /** Greyed-out context (parent city or voivodeship). */
  secondary?: string;
  /** Search haystack (normalized once at build time). */
  searchKey: string;
};

/** Flatten cities + districts into a single searchable option list. */
export function buildLocationOptions(): LocationOption[] {
  const out: LocationOption[] = [];
  for (const c of PL_CITIES) {
    out.push({
      value: c.name,
      primary: c.name,
      secondary: c.voivodeship,
      searchKey: normalizeLocationQuery(c.name + " " + c.voivodeship),
    });
    for (const d of c.districts ?? []) {
      out.push({
        value: `${c.name}, ${d}`,
        primary: d,
        secondary: c.name,
        searchKey: normalizeLocationQuery(d + " " + c.name),
      });
    }
  }
  return out;
}

/** All 16 voivodeships, sorted alphabetically (matches OLX ordering). */
export const PL_VOIVODESHIPS: string[] = [
  "dolnośląskie",
  "kujawsko-pomorskie",
  "lubelskie",
  "lubuskie",
  "łódzkie",
  "małopolskie",
  "mazowieckie",
  "opolskie",
  "podkarpackie",
  "podlaskie",
  "pomorskie",
  "śląskie",
  "świętokrzyskie",
  "warmińsko-mazurskie",
  "wielkopolskie",
  "zachodniopomorskie",
];

/** Cities sorted alphabetically inside a given voivodeship. */
export function getCitiesInVoivodeship(woj: string): CityEntry[] {
  return PL_CITIES
    .filter((c) => c.voivodeship === woj)
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

/** Capitalize voivodeship for display ("dolnośląskie" → "Dolnośląskie"). */
export function formatVoivodeship(woj: string): string {
  return woj.charAt(0).toUpperCase() + woj.slice(1);
}

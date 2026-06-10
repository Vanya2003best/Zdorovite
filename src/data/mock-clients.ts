/**
 * Mock client roster for /studio/klienci before real CRM tables land.
 * 20 entries covering all 5 statuses with realistic Polish names + variety
 * of edge cases (long names, missing photos, big LTV, brand-new lead, etc).
 *
 * Names are stable across mocks — reused on /studio (Pulpit) and per-client
 * detail screens, so a "Anna Nowak" on the dashboard is the same Anna in
 * the clients list and in her detail page.
 */

export type ClientStatus = "lead" | "new" | "active" | "pause" | "ended";

export type MockClient = {
  id: string;
  initials: string;
  /** 1–9, drives gradient palette in the avatar */
  avatarTone: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  name: string;
  status: ClientStatus;
  /** Days-in-status label shown next to the status pill for non-active.
   *  E.g. "9 dni" for Lead/Nowy, "34 dni" for Pauza. Active/Ended omit. */
  statusDaysLabel?: string;
  email: string;
  phone: string;
  /** Free-form trailing meta — "Klient od stycznia 2026" / "Konsultacja 2 maja" */
  trailingMeta: string;
  /** 2–3 chips under the meta line */
  tags: string[];
  /** Package state OR null when client has no package (typical for Leads) */
  pkg: {
    used: number;
    total: number;
    /** "ostatnia sesja wykorzystana / czeka na ofertę / Pierwszy kontakt" */
    note?: string;
    /** Visual variant for the progress bar */
    tone: "ok" | "low" | "empty" | "missing";
  } | null;
  /** Last interaction — session label OR contact label */
  lastEvent: {
    /** "Ostatnia sesja" / "Ostatni kontakt" */
    label: string;
    /** "Dziś · 14:00" / "5 kwietnia" */
    primary: string;
    /** "Siłownia · Mokotów" / "Email · brak odpowiedzi" */
    secondary: string;
    /** When primary is in the past and urgency matters — paints red */
    urgent?: boolean;
  };
  /** Right-most money column. Leads/Pauza use estimated potential. */
  ltv: {
    /** "Wartość 12 mies." / "Potencjał" */
    label: string;
    /** Number in PLN — formatted with thin-space thousands in the UI */
    amount: number;
    /** "/ 6 mies." for potential rows */
    suffix?: string;
    /** Hint that the value is estimated (paints brand-700, prepends ~) */
    estimated?: boolean;
  };
  /** Bottom action pair on the card */
  actions: {
    primary: { label: string; tone: "ink" | "brand" | "lead" | "pause" };
    secondary: { label: string };
  };
};

export const MOCK_CLIENTS: MockClient[] = [
  {
    id: "c-anna-nowak",
    initials: "AN",
    avatarTone: 1,
    name: "Anna Nowak",
    status: "active",
    email: "a.nowak@gmail.com",
    phone: "+48 601 234 567",
    trailingMeta: "Klient od stycznia 2026",
    tags: ["Siłownia", "Redukcja", "★ 4,9 trener"],
    pkg: { used: 5, total: 8, tone: "ok" },
    lastEvent: { label: "Ostatnia sesja", primary: "Dziś · 14:00", secondary: "Siłownia · Mokotów" },
    ltv: { label: "Wartość 12 mies.", amount: 4320 },
    actions: { primary: { label: "Wiadomość", tone: "ink" }, secondary: { label: "Profil →" } },
  },
  {
    id: "c-piotr-kowalski",
    initials: "PK",
    avatarTone: 2,
    name: "Piotr Kowalski",
    status: "active",
    email: "piotrk@outlook.com",
    phone: "+48 602 345 678",
    trailingMeta: "Klient od listopada 2025",
    tags: ["Online", "Kardio", "8× pakiet · 88%"],
    pkg: { used: 7, total: 8, tone: "ok" },
    lastEvent: { label: "Ostatnia sesja", primary: "Wczoraj · 18:30", secondary: "Online · interwały" },
    ltv: { label: "Wartość 12 mies.", amount: 6840 },
    actions: { primary: { label: "Wiadomość", tone: "ink" }, secondary: { label: "Profil →" } },
  },
  {
    id: "c-malgorzata-wisniewska",
    initials: "MW",
    avatarTone: 4,
    name: "Małgorzata Wiśniewska-Kowalska",
    status: "new",
    statusDaysLabel: "9 dni",
    email: "m.wisniewska.kowalska@gmail.com",
    phone: "+48 603 456 789",
    trailingMeta: "",
    tags: ["Siłownia", "Onboarding", "Plan startowy"],
    pkg: { used: 1, total: 4, tone: "ok" },
    lastEvent: { label: "Ostatnia sesja", primary: "Pt 8 maja", secondary: "Wprowadzenie · pomiary" },
    ltv: { label: "Wartość 12 mies.", amount: 880 },
    actions: { primary: { label: "Plan onboarding", tone: "lead" }, secondary: { label: "Profil →" } },
  },
  {
    id: "c-tomasz-zielinski",
    initials: "TZ",
    avatarTone: 7,
    name: "Tomasz Zieliński",
    status: "lead",
    statusDaysLabel: "9 dni",
    email: "tomek.z@wp.pl",
    phone: "+48 604 567 890",
    trailingMeta: "Konsultacja 2 maja · 15 min",
    tags: ["Z formularza", "Online", "Cel: redukcja"],
    pkg: { used: 0, total: 0, note: "Czeka na ofertę", tone: "missing" },
    lastEvent: { label: "Ostatni kontakt", primary: "3 dni temu", secondary: "Email · brak odpowiedzi" },
    ltv: { label: "Potencjał", amount: 2400, suffix: "/ 6 mies.", estimated: true },
    actions: { primary: { label: "Konwertuj", tone: "lead" }, secondary: { label: "Wiadomość" } },
  },
  {
    id: "c-karolina-sikora",
    initials: "KS",
    avatarTone: 5,
    name: "Karolina Sikora",
    status: "active",
    email: "k.sikora@gmail.com",
    phone: "+48 605 678 901",
    trailingMeta: "Klientka od września 2025",
    tags: ["Siłownia", "Powrót po ciąży", "★ 5,0 trener"],
    pkg: { used: 4, total: 8, tone: "ok" },
    lastEvent: { label: "Ostatnia sesja", primary: "Wczoraj · 09:00", secondary: "Siłownia · nogi" },
    ltv: { label: "Wartość 12 mies.", amount: 5760 },
    actions: { primary: { label: "Wiadomość", tone: "ink" }, secondary: { label: "Profil →" } },
  },
  {
    id: "c-jakub-lewandowski",
    initials: "JL",
    avatarTone: 6,
    name: "Jakub Lewandowski",
    status: "pause",
    statusDaysLabel: "34 dni",
    email: "jakub.l@gmail.com",
    phone: "+48 606 789 012",
    trailingMeta: "Klient od czerwca 2025",
    tags: ["Siłownia", "Saldo wykorzystane", "Reaktywacja"],
    pkg: { used: 0, total: 8, tone: "empty" },
    lastEvent: { label: "Ostatnia sesja", primary: "5 kwietnia", secondary: "34 dni temu" },
    ltv: { label: "Wartość 12 mies.", amount: 7200 },
    actions: { primary: { label: "Reaktywuj", tone: "pause" }, secondary: { label: "Wiadomość" } },
  },
  {
    id: "c-ewa-mazur",
    initials: "EM",
    avatarTone: 3,
    name: "Ewa Mazur",
    status: "lead",
    statusDaysLabel: "3 dni",
    email: "ewa.mazur@gmail.com",
    phone: "+48 607 890 123",
    trailingMeta: "Zapytanie 8 maja",
    tags: ["Z /trainers", "Joga · ciąża", "Wymaga odpowiedzi"],
    pkg: { used: 0, total: 0, note: "Pierwszy kontakt", tone: "missing" },
    lastEvent: { label: "Ostatni kontakt", primary: "3 dni temu", secondary: "Pilne · czeka odpowiedź", urgent: true },
    ltv: { label: "Potencjał", amount: 3600, suffix: "/ 6 mies.", estimated: true },
    actions: { primary: { label: "Konwertuj", tone: "lead" }, secondary: { label: "Wiadomość" } },
  },
  {
    id: "c-rafal-dabrowski",
    initials: "RD",
    avatarTone: 8,
    name: "Rafał Dąbrowski",
    status: "active",
    email: "rdabr@interia.pl",
    phone: "+48 608 901 234",
    trailingMeta: "Klient od marca 2026",
    tags: ["Online", "Klatka + barki"],
    pkg: { used: 3, total: 4, tone: "ok" },
    lastEvent: { label: "Ostatnia sesja", primary: "Pon 9 maja", secondary: "Online · klatka" },
    ltv: { label: "Wartość 12 mies.", amount: 3240 },
    actions: { primary: { label: "Wiadomość", tone: "ink" }, secondary: { label: "Profil →" } },
  },
  {
    id: "c-agnieszka-bak",
    initials: "AB",
    avatarTone: 9,
    name: "Agnieszka Bąk",
    status: "ended",
    email: "agbak@gmail.com",
    phone: "+48 609 012 345",
    trailingMeta: "Klientka 2024 – kwi 2026",
    tags: ["Pakiet 8/8", "Pozytywna ocena"],
    pkg: { used: 8, total: 8, note: "Wykorzystany", tone: "ok" },
    lastEvent: { label: "Ostatnia sesja", primary: "28 kwietnia", secondary: "14 dni temu" },
    ltv: { label: "Wartość 12 mies.", amount: 3840 },
    actions: { primary: { label: "Zaproponuj nowy", tone: "ink" }, secondary: { label: "Profil →" } },
  },
  {
    id: "c-pawel-michalak",
    initials: "PM",
    avatarTone: 1,
    name: "Paweł Michalak",
    status: "active",
    email: "pmichalak@op.pl",
    phone: "+48 610 123 456",
    trailingMeta: "Klient od kwietnia 2026",
    tags: ["Siłownia", "Plecy + brzuch"],
    pkg: { used: 3, total: 8, tone: "ok" },
    lastEvent: { label: "Ostatnia sesja", primary: "Wt 10 maja", secondary: "Siłownia · plecy" },
    ltv: { label: "Wartość 12 mies.", amount: 1920 },
    actions: { primary: { label: "Wiadomość", tone: "ink" }, secondary: { label: "Profil →" } },
  },
  {
    id: "c-natalia-jankowska",
    initials: "NJ",
    avatarTone: 5,
    name: "Natalia Jankowska",
    status: "pause",
    statusDaysLabel: "42 dni",
    email: "n.jankowska@gmail.com",
    phone: "+48 611 234 567",
    trailingMeta: "Klientka od listopada 2025",
    tags: ["Joga", "Hatha", "Saldo 3 sesje"],
    pkg: { used: 5, total: 8, tone: "low" },
    lastEvent: { label: "Ostatnia sesja", primary: "29 marca", secondary: "Joga · stres" },
    ltv: { label: "Wartość 12 mies.", amount: 2880 },
    actions: { primary: { label: "Reaktywuj", tone: "pause" }, secondary: { label: "Wiadomość" } },
  },
  {
    id: "c-marcin-szczepanski",
    initials: "MS",
    avatarTone: 2,
    name: "Marcin Szczepański",
    status: "active",
    email: "marcin.sz@gmail.com",
    phone: "+48 612 345 678",
    trailingMeta: "Klient od stycznia 2026",
    tags: ["Crossfit", "Siła", "Maraton 2026"],
    pkg: { used: 6, total: 12, tone: "ok" },
    lastEvent: { label: "Ostatnia sesja", primary: "Wt 10 maja", secondary: "Crossfit · WOD" },
    ltv: { label: "Wartość 12 mies.", amount: 5040 },
    actions: { primary: { label: "Wiadomość", tone: "ink" }, secondary: { label: "Profil →" } },
  },
  {
    id: "c-aleksandra-pawlak",
    initials: "AP",
    avatarTone: 5,
    name: "Aleksandra Pawlak",
    status: "new",
    statusDaysLabel: "4 dni",
    email: "ola.pawlak@gmail.com",
    phone: "+48 613 456 789",
    trailingMeta: "",
    tags: ["Pilates", "Mat", "Onboarding"],
    pkg: { used: 1, total: 4, tone: "ok" },
    lastEvent: { label: "Ostatnia sesja", primary: "Pt 8 maja", secondary: "Pilates · wprowadzenie" },
    ltv: { label: "Wartość 12 mies.", amount: 400 },
    actions: { primary: { label: "Plan onboarding", tone: "lead" }, secondary: { label: "Profil →" } },
  },
  {
    id: "c-michal-wozniak",
    initials: "MW",
    avatarTone: 6,
    name: "Michał Woźniak",
    status: "lead",
    statusDaysLabel: "1 dzień",
    email: "m.wozniak@interia.pl",
    phone: "+48 614 567 890",
    trailingMeta: "Z reklamy FB · 10 maja",
    tags: ["Z reklamy", "Online", "Budowanie masy"],
    pkg: { used: 0, total: 0, note: "Pierwszy kontakt", tone: "missing" },
    lastEvent: { label: "Ostatni kontakt", primary: "Wczoraj", secondary: "Wiadomość · przeczytana" },
    ltv: { label: "Potencjał", amount: 4800, suffix: "/ 6 mies.", estimated: true },
    actions: { primary: { label: "Konwertuj", tone: "lead" }, secondary: { label: "Wiadomość" } },
  },
  {
    id: "c-monika-krol",
    initials: "MK",
    avatarTone: 7,
    name: "Monika Król",
    status: "active",
    email: "monika.krol@op.pl",
    phone: "+48 615 678 901",
    trailingMeta: "Klientka od grudnia 2025",
    tags: ["Siłownia", "Rehabilitacja kolana"],
    pkg: { used: 2, total: 8, tone: "ok" },
    lastEvent: { label: "Ostatnia sesja", primary: "Czw 8 maja", secondary: "Rehab · noga" },
    ltv: { label: "Wartość 12 mies.", amount: 2640 },
    actions: { primary: { label: "Wiadomość", tone: "ink" }, secondary: { label: "Profil →" } },
  },
  {
    id: "c-bartosz-witkowski",
    initials: "BW",
    avatarTone: 3,
    name: "Bartosz Witkowski",
    status: "ended",
    email: "bartek.w@gmail.com",
    phone: "+48 616 789 012",
    trailingMeta: "Klient sty 2025 – mar 2026",
    tags: ["Pakiet 12/12", "Wyjazd"],
    pkg: { used: 12, total: 12, note: "Wykorzystany", tone: "ok" },
    lastEvent: { label: "Ostatnia sesja", primary: "23 marca", secondary: "50 dni temu" },
    ltv: { label: "Wartość 12 mies.", amount: 5040 },
    actions: { primary: { label: "Zaproponuj nowy", tone: "ink" }, secondary: { label: "Profil →" } },
  },
  {
    id: "c-julia-baranowska",
    initials: "JB",
    avatarTone: 9,
    name: "Julia Baranowska",
    status: "pause",
    statusDaysLabel: "28 dni",
    email: "j.baranowska@gmail.com",
    phone: "+48 617 890 123",
    trailingMeta: "Klientka od sierpnia 2025",
    tags: ["Siłownia", "Saldo 2 sesje"],
    pkg: { used: 6, total: 8, tone: "low" },
    lastEvent: { label: "Ostatnia sesja", primary: "11 kwietnia", secondary: "Siłownia · nogi" },
    ltv: { label: "Wartość 12 mies.", amount: 3840 },
    actions: { primary: { label: "Reaktywuj", tone: "pause" }, secondary: { label: "Wiadomość" } },
  },
  {
    id: "c-krzysztof-adamski",
    initials: "KA",
    avatarTone: 8,
    name: "Krzysztof Adamski",
    status: "active",
    email: "kadamski@interia.pl",
    phone: "+48 618 901 234",
    trailingMeta: "Klient od lutego 2026",
    tags: ["Online", "Mobility"],
    pkg: { used: 4, total: 8, tone: "ok" },
    lastEvent: { label: "Ostatnia sesja", primary: "Pon 9 maja", secondary: "Online · mobility" },
    ltv: { label: "Wartość 12 mies.", amount: 2880 },
    actions: { primary: { label: "Wiadomość", tone: "ink" }, secondary: { label: "Profil →" } },
  },
  {
    id: "c-zofia-grabowska",
    initials: "ZG",
    avatarTone: 5,
    name: "Zofia Grabowska",
    status: "pause",
    statusDaysLabel: "60 dni",
    email: "zofia.g@gmail.com",
    phone: "+48 619 012 345",
    trailingMeta: "Klientka od maja 2025",
    tags: ["Pilates", "Saldo wykorzystane", "Kontuzja"],
    pkg: { used: 8, total: 8, note: "Wykorzystany", tone: "empty" },
    lastEvent: { label: "Ostatnia sesja", primary: "11 marca", secondary: "60 dni temu" },
    ltv: { label: "Wartość 12 mies.", amount: 1920 },
    actions: { primary: { label: "Reaktywuj", tone: "pause" }, secondary: { label: "Wiadomość" } },
  },
  {
    id: "c-dawid-kowalczyk",
    initials: "DK",
    avatarTone: 6,
    name: "Dawid Kowalczyk",
    status: "ended",
    email: "dawid.k@gmail.com",
    phone: "+48 620 123 456",
    trailingMeta: "Klient lis 2025 – kwi 2026",
    tags: ["Pakiet 8/8", "Cel osiągnięty"],
    pkg: { used: 8, total: 8, note: "Wykorzystany", tone: "ok" },
    lastEvent: { label: "Ostatnia sesja", primary: "30 kwietnia", secondary: "11 dni temu" },
    ltv: { label: "Wartość 12 mies.", amount: 3840 },
    actions: { primary: { label: "Zaproponuj nowy", tone: "ink" }, secondary: { label: "Profil →" } },
  },
];

export function countByStatus(): Record<ClientStatus, number> {
  const counts: Record<ClientStatus, number> = { lead: 0, new: 0, active: 0, pause: 0, ended: 0 };
  for (const c of MOCK_CLIENTS) counts[c.status]++;
  return counts;
}

export function ltv12mTotal(): number {
  return MOCK_CLIENTS.filter((c) => !c.ltv.estimated).reduce((s, c) => s + c.ltv.amount, 0);
}

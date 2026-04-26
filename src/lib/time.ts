/**
 * Pure timezone helpers for Warsaw-local dates.
 * Safe to import from both client and server components.
 *
 * MVP: hardcoded +02:00 (CEST). Will need Intl/Temporal when DST flips in late Oct.
 */
const POLAND_OFFSET = "+02:00";

export type Slot = {
  /** ISO UTC timestamp — what we store in bookings.start_time */
  startIso: string;
  /** "08:00" — display label */
  label: string;
  /** False if already booked */
  available: boolean;
};

/** Parse "HH:MM:SS" or "HH:MM" to minutes since midnight */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Warsaw-local "YYYY-MM-DD" + minutes-since-midnight → ISO UTC string */
export function warsawLocalToIso(date: string, minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return new Date(`${date}T${hh}:${mm}:00${POLAND_OFFSET}`).toISOString();
}

/** Warsaw-local day-of-week for a given YYYY-MM-DD (0=Sun..6=Sat) */
export function warsawDayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00${POLAND_OFFSET}`).getDay();
}

/** Format "Czwartek · 25 kwietnia" */
export function formatWarsawDate(date: string): string {
  const d = new Date(`${date}T12:00:00${POLAND_OFFSET}`);
  const weekday = d.toLocaleDateString("pl-PL", {
    weekday: "long",
    timeZone: "Europe/Warsaw",
  });
  const day = d.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Warsaw",
  });
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} · ${day}`;
}

/** Today (or +N days) in Warsaw-local as YYYY-MM-DD. TZ-agnostic. */
export function warsawDateOffset(daysFromToday: number): string {
  // en-CA produces YYYY-MM-DD regardless of server locale
  const todayWarsaw = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = todayWarsaw.split("-").map(Number);
  // Construct UTC date to shift days safely, then slice
  const shifted = new Date(Date.UTC(y, m - 1, d + daysFromToday));
  return shifted.toISOString().slice(0, 10);
}

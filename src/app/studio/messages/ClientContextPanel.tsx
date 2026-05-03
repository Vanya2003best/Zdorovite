// Right-side panel showing what we know about the person we're chatting with:
// — first booking date ("Klient od …"), upcoming session, total session count.
// Falls back to "Lead" framing when there are no bookings yet.

type Booking = {
  start_time: string;
  // Snapshot fields preferred over JOIN (migration 018).
  service_name?: string | null;
  package_name?: string | null;
  service?: { name: string | null } | null;
  package?: { name: string | null } | null;
};

export default function ClientContextPanel({
  name,
  avatar,
  firstBookingAt,
  upcoming,
  totalBookings,
}: {
  name: string;
  avatar: string | null;
  firstBookingAt: string | null;
  upcoming: Booking | null;
  totalBookings: number;
}) {
  const isClient = totalBookings > 0;
  const sinceLabel = firstBookingAt
    ? `Klient od ${new Date(firstBookingAt).toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}`
    : "Nowy lead — brak rezerwacji";

  return (
    <aside className="hidden lg:block bg-white border-l border-slate-200 overflow-y-auto">
      {/* Header */}
      <div className="pt-6 px-5 text-center">
        <div className="w-20 h-20 rounded-full overflow-hidden mx-auto border-2 border-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] bg-emerald-50">
          {avatar ? (
            <img src={avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full inline-flex items-center justify-center font-semibold text-2xl text-emerald-700">
              {(name || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <h3 className="text-[17px] font-semibold tracking-tight mt-3">{name || "Klient"}</h3>
        <p className="text-[12px] text-slate-500 mt-1">{sinceLabel}</p>
      </div>

      <div className="flex gap-1.5 justify-center px-4 pt-4 pb-4 border-b border-slate-200">
        {["Profil", "Plan", "Pomiary"].map((l) => (
          <button
            key={l}
            type="button"
            disabled
            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 hover:border-slate-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
            title="Wkrótce"
          >
            {l}
          </button>
        ))}
      </div>

      {/* Status / package */}
      <Section title={isClient ? "Aktywna współpraca" : "Status"}>
        {isClient ? (
          <div className="rounded-[10px] bg-emerald-50 border border-emerald-200 p-3">
            <div className="text-[13px] font-semibold text-slate-900">{totalBookings} {totalBookings === 1 ? "sesja" : totalBookings < 5 ? "sesje" : "sesji"} z Tobą</div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              Pierwsza: {firstBookingAt ? new Date(firstBookingAt).toLocaleDateString("pl-PL") : "—"}
            </div>
          </div>
        ) : (
          <div className="rounded-[10px] bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-900">
            Brak rezerwacji jeszcze — pierwszy kontakt.
          </div>
        )}
      </Section>

      {/* Upcoming session */}
      <Section title="Najbliższa sesja">
        {upcoming ? (
          <ul className="grid gap-2.5">
            <Row
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>}
              label={new Date(upcoming.start_time).toLocaleDateString("pl-PL", { weekday: "long" })}
              value={new Date(upcoming.start_time).toLocaleString("pl-PL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            />
            <Row
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>}
              label="Usługa"
              value={upcoming.service_name ?? upcoming.package_name ?? upcoming.service?.name ?? upcoming.package?.name ?? "Sesja"}
            />
          </ul>
        ) : (
          <p className="text-[12px] text-slate-500">Brak nadchodzących sesji.</p>
        )}
      </Section>

      {/* Notes — placeholder, not wired to DB yet */}
      <Section title="Notatki o kliencie">
        <div className="rounded-[10px] bg-slate-50 p-3 border-l-[3px] border-emerald-500 text-[12px] text-slate-700 leading-relaxed">
          Tu zapiszesz notatki o kliencie — historię, cele, kontuzje. <span className="text-slate-400">(wkrótce edycja)</span>
        </div>
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-slate-200 last:border-b-0">
      <h4 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-slate-500 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <li className="flex gap-2.5 items-center">
      <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 inline-flex items-center justify-center shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] text-slate-500 capitalize">{label}</div>
        <div className="text-[13px] text-slate-900 font-medium truncate">{value}</div>
      </div>
    </li>
  );
}

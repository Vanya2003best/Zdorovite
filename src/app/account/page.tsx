import { requireClient, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ROLE_LABELS: Record<string, string> = {
  client: "Klient",
  admin: "Administrator",
};

export default async function AccountPage() {
  // Trainers redirected to /studio by requireClient
  const { user, profile } = await requireClient("/account");

  const supabase = await createClient();
  const { data: extra } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", user.id)
    .single();

  const admin = isAdmin(profile);

  return (
    <div className="mx-auto max-w-[720px] px-5 sm:px-6 py-12 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Twoje konto</h1>
      <p className="text-sm text-slate-600 mt-2 mb-8">
        Zalogowany jako <strong className="text-slate-900">{user.email}</strong>
      </p>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 grid gap-3">
        <Row label="Imię" value={profile.display_name} />
        <Row label="Email" value={user.email ?? "—"} />
        <Row label="Rola" value={ROLE_LABELS[profile.role] ?? profile.role} />
        <Row
          label="Konto utworzone"
          value={extra?.created_at ? new Date(extra.created_at).toLocaleString("pl-PL") : "—"}
        />
      </div>

      <div className="flex flex-wrap gap-3 mt-6">
        <a
          href="/account/bookings"
          className="h-11 px-5 inline-flex items-center rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-black transition"
        >
          Moje rezerwacje
        </a>
        <a
          href="/account/messages"
          className="h-11 px-5 inline-flex items-center rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-black transition"
        >
          Wiadomości
        </a>
        <a
          href="/register/trainer"
          className="h-11 px-5 inline-flex items-center rounded-lg bg-emerald-500 text-white text-sm font-medium hover:brightness-105 transition"
        >
          Zostań trenerem
        </a>
        {admin && (
          <a
            href="/admin"
            className="h-11 px-5 inline-flex items-center rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-900 transition"
          >
            Panel admina
          </a>
        )}
        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            className="h-11 px-5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-900 hover:border-slate-400 transition"
          >
            Wyloguj się
          </button>
        </form>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 items-baseline py-1.5">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value}</span>
    </div>
  );
}

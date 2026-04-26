import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { specializations as ALL_SPECS, getSpecLabel, getSpecIcon } from "@/data/specializations";
import EditableText from "@/components/EditableText";
import InlineServicesEditor from "@/app/trainers/[id]/InlineServicesEditor";
import InlinePackagesEditor from "@/app/trainers/[id]/InlinePackagesEditor";
import PublishToggle from "./PublishToggle";

type Pkg = {
  id: string;
  name: string;
  description: string;
  items: string[];
  price: number;
  period?: string;
  featured?: boolean;
};

export default async function StudioProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single();

  const { data: trainer } = await supabase
    .from("trainers")
    .select("slug, tagline, about, experience, price_from, location, languages, cover_image, rating, review_count, published")
    .eq("id", user.id)
    .maybeSingle();

  if (!trainer) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-300 py-16 text-center">
        <p className="text-slate-500">Najpierw dokończ rejestrację jako trener.</p>
        <Link
          href="/register/trainer"
          className="inline-flex mt-4 h-10 items-center px-5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-black transition"
        >
          Stań się trenerem →
        </Link>
      </div>
    );
  }

  const { data: specs } = await supabase
    .from("trainer_specializations")
    .select("specialization_id")
    .eq("trainer_id", user.id);
  const mySpecIds = new Set((specs ?? []).map((s) => s.specialization_id));

  const { data: services } = await supabase
    .from("services")
    .select("id, name, description, duration, price, position")
    .eq("trainer_id", user.id)
    .order("position", { ascending: true });

  const { data: packages } = await supabase
    .from("packages")
    .select("id, name, description, items, price, period, featured, position")
    .eq("trainer_id", user.id)
    .order("position", { ascending: true });

  return (
    <div className="grid gap-5">
      {/* Top control bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Mój profil</h1>
          <p className="text-[13px] text-slate-600 mt-1">
            Edytuj dowolny element, klikając w niego. Zmiany zapisują się automatycznie.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PublishToggle published={trainer.published} />
          <Link
            href="/studio/profile/preview"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-[13px] font-medium text-slate-700 border border-slate-200 bg-white hover:border-slate-400 transition"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            Podgląd klienta
          </Link>
        </div>
      </header>

      {/* Cover + Avatar + Name card */}
      <Card>
        <div className="relative h-[160px] sm:h-[200px] -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 bg-gradient-to-br from-emerald-100 via-teal-50 to-emerald-50 rounded-t-2xl border-b border-slate-200 overflow-hidden">
          {trainer.cover_image && (
            <img src={trainer.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <button
            type="button"
            disabled
            title="Wkrótce: ładowanie zdjęcia okładki (wymaga Supabase Storage)"
            className="absolute top-4 right-4 inline-flex items-center gap-2 h-9 px-3.5 rounded-full bg-white/90 backdrop-blur-md text-[12px] font-medium text-slate-700 border border-white shadow-sm cursor-not-allowed opacity-90"
          >
            ✎ Zmień okładkę
          </button>
        </div>

        <div className="flex items-end gap-4 -mt-12 relative">
          <div className="relative shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-md" />
            ) : (
              <span className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center font-semibold text-3xl border-4 border-white shadow-md">
                {(profile?.display_name ?? "?").charAt(0).toUpperCase()}
              </span>
            )}
            <button
              type="button"
              disabled
              title="Wkrótce: zmiana awatara (wymaga Supabase Storage)"
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 inline-flex items-center justify-center text-sm shadow-sm cursor-not-allowed opacity-90"
            >
              ✎
            </button>
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <h2 className="text-2xl font-semibold tracking-tight">{profile?.display_name}</h2>
            <p className="text-[14px] text-slate-600 mt-1">
              <EditableText
                field="tagline"
                initial={trainer.tagline}
                multiline
                maxLength={200}
                placeholder="Dodaj tagline (jedno zdanie o sobie)"
              />
            </p>
          </div>
        </div>

        {/* Quick badges */}
        <div className="flex flex-wrap gap-3 mt-5 text-[13px] text-slate-700 pt-4 border-t border-slate-100">
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
            <strong className="text-slate-900">{trainer.rating}</strong>
            <span className="text-slate-500">· {trainer.review_count} opinii</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            📍{" "}
            <EditableText
              field="location"
              initial={trainer.location}
              maxLength={100}
              placeholder="Miasto, dzielnica"
            />
          </span>
          <span className="inline-flex items-center gap-1.5">
            🌐 {(trainer.languages ?? []).join(" · ") || <span className="text-slate-400 italic">brak języków</span>}
          </span>
        </div>
      </Card>

      {/* Specializations */}
      <Card>
        <CardHeader title="Specjalizacje" hint={`${mySpecIds.size}/10 wybranych`} />
        <div className="flex flex-wrap gap-2 mt-3">
          {ALL_SPECS.map((spec) => {
            const active = mySpecIds.has(spec.id);
            return (
              <span
                key={spec.id}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] border ${
                  active
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-medium"
                    : "bg-white border-slate-200 text-slate-400"
                }`}
                title={active ? "Wybrana specjalizacja" : "Nie wybrana"}
              >
                <span>{spec.icon}</span>
                {spec.label}
              </span>
            );
          })}
        </div>
        <p className="text-[12px] text-slate-500 mt-3">
          Edycja przez popover — wkrótce. Tymczasem użyj{" "}
          <Link href="/account/become-trainer" className="text-emerald-700 hover:underline font-medium">
            pełnego edytora
          </Link>.
        </p>
      </Card>

      {/* About */}
      <Card>
        <CardHeader title="O mnie" />
        <p className="text-[14px] text-slate-700 leading-[1.65] mt-3">
          <EditableText
            field="about"
            initial={trainer.about}
            multiline
            maxLength={3000}
            placeholder="Opowiedz o sobie, swoim podejściu, doświadczeniu, klientach z którymi pracujesz..."
          />
        </p>
      </Card>

      {/* Stats: experience + price */}
      <Card>
        <CardHeader title="Cena i doświadczenie" />
        <div className="grid grid-cols-2 gap-6 mt-3">
          <div>
            <div className="text-[12px] uppercase tracking-[0.06em] text-slate-500 font-medium mb-1">
              Cena od (zł / sesja)
            </div>
            <div className="text-2xl font-semibold tracking-tight">
              <EditableText
                field="price_from"
                initial={String(trainer.price_from)}
                type="number"
                min={0}
                max={10000}
                className="w-24"
              />
              {" zł"}
            </div>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-[0.06em] text-slate-500 font-medium mb-1">
              Lata doświadczenia
            </div>
            <div className="text-2xl font-semibold tracking-tight">
              <EditableText
                field="experience"
                initial={String(trainer.experience)}
                type="number"
                min={0}
                max={60}
                className="w-16"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Services */}
      <Card>
        <CardHeader
          title="Pojedyncze sesje"
          hint={`${(services ?? []).length} ${(services ?? []).length === 1 ? "usługa" : "usług"}`}
        />
        <div className="mt-4">
          <InlineServicesEditor services={(services ?? []) as { id: string; name: string; description: string; duration: number; price: number; }[]} />
        </div>
      </Card>

      {/* Packages */}
      <Card>
        <CardHeader
          title="Pakiety długoterminowe"
          hint={`${(packages ?? []).length} ${(packages ?? []).length === 1 ? "pakiet" : "pakietów"}`}
        />
        <div className="mt-4">
          <InlinePackagesEditor packages={(packages ?? []) as Pkg[]} />
        </div>
      </Card>

      {/* Settings card */}
      <Card>
        <CardHeader title="Ustawienia" />
        <div className="grid gap-3 mt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <strong className="text-[14px] text-slate-900">Adres profilu</strong>
              <p className="text-[12px] text-slate-500 mt-0.5">
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">nazdrow.pl/trainers/{trainer.slug}</code>
              </p>
            </div>
            <Link
              href="/account/become-trainer"
              className="text-[13px] text-emerald-700 hover:underline font-medium"
            >
              Zmień slug →
            </Link>
          </div>
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div>
              <strong className="text-[14px] text-slate-900">Wygląd profilu</strong>
              <p className="text-[12px] text-slate-500 mt-0.5">Szablon, kolor akcentu, widoczne sekcje</p>
            </div>
            <Link href="/studio/design" className="text-[13px] text-emerald-700 hover:underline font-medium">
              Otwórz edytor →
            </Link>
          </div>
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div>
              <strong className="text-[14px] text-slate-900">Godziny pracy</strong>
              <p className="text-[12px] text-slate-500 mt-0.5">Kiedy klienci mogą rezerwować sesje</p>
            </div>
            <Link href="/studio/availability" className="text-[13px] text-emerald-700 hover:underline font-medium">
              Otwórz edytor →
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      {children}
    </section>
  );
}

function CardHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h3>
      {hint && <span className="text-[12px] text-slate-500">{hint}</span>}
    </div>
  );
}

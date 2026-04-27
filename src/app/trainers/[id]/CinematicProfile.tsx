import Link from "next/link";
import type { Trainer } from "@/types";
import { getSpecLabel } from "@/data/specializations";
import EditModeBar from "./EditModeBar";
import EditProfileFab from "./EditProfileFab";
import FavoriteButton from "./FavoriteButton";

// Cinematic = full-bleed dark hero · 148px display type · numbered chapter sections · bento reel.
// Designed pixel-close to designs/14-profile-cinematic-desktop.html.
//
// Skipped from the original mock (no data backing yet): coordinates strip, video intro,
// hand-tuned per-trainer quote in the fullbleed shot, scroll progress bar, animated ticker.

const FALLBACK_HERO = "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=2000&h=1200&fit=crop";
const FALLBACK_FULLBLEED = "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=2000&h=1200&fit=crop";

export default function CinematicProfile({
  trainer,
  editMode,
  isOwner,
  published,
  initialIsFavorite,
  needsLoginToFavorite,
}: {
  trainer: Trainer;
  editMode: boolean;
  isOwner: boolean;
  published: boolean;
  initialIsFavorite: boolean;
  needsLoginToFavorite: boolean;
}) {
  const heroBg = trainer.customization.coverImage || trainer.gallery[0] || FALLBACK_HERO;
  const fullbleed = trainer.gallery[1] || trainer.gallery[0] || FALLBACK_FULLBLEED;

  // Split name: last word becomes the italic line-2.
  const nameWords = trainer.name.split(" ");
  const lastWord = nameWords.length > 1 ? nameWords[nameWords.length - 1] : "";
  const firstWords = nameWords.length > 1 ? nameWords.slice(0, -1).join(" ") : trainer.name;

  // Split about into chapter blocks. We use \n\n boundaries; if user has a single paragraph
  // we show it as the single "01 / O mnie" block. Limited to 3 to keep the editorial vibe.
  const aboutBlocks = (trainer.about || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 3);

  const chapterTitles = ["01 / Zaczęło się", "02 / Metoda", "03 / Z kim pracuję"];
  const chapterHeads = ["Skąd przyszłaś.", "Jak pracujesz.", "Z kim."];

  return (
    <div className="bg-[#0a0a0c] text-[#f5f5f4] min-h-screen font-sans antialiased">
      {editMode && <EditModeBar slug={trainer.id} published={published} />}
      {isOwner && !editMode && <EditProfileFab slug={trainer.id} />}

      {/* Top progress accent line */}
      <div className="fixed top-0 left-0 right-0 h-0.5 z-[60] bg-gradient-to-r from-[#d4ff00] via-[#d4ff00] to-transparent" style={{ backgroundSize: "34% 100%", backgroundRepeat: "no-repeat" }} />

      {/* CHROME — sticky nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0c]/70 backdrop-blur-xl backdrop-saturate-[1.4]">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-12 h-[68px] flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5 text-[15px] font-medium tracking-tight">
            <span className="w-7 h-7 rounded-md bg-[#d4ff00] text-[#0a0a0c] inline-flex items-center justify-center text-[13px] font-bold">N</span>
            NaZdrow!
          </Link>
          <nav className="hidden md:flex gap-8 text-[13px] text-white/70">
            <Link href="/trainers" className="hover:text-white transition">Trenerzy</Link>
            <Link href="#" className="hover:text-white transition">Kategorie</Link>
            <Link href="/register/trainer" className="hover:text-white transition">Dla trenerów</Link>
          </nav>
          <div className="flex gap-2.5 items-center">
            <span className="hidden sm:inline-flex font-mono text-[11px] text-white/50 px-2.5 py-1.5 border border-white/10 rounded-full items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4ff00] shadow-[0_0_10px_#d4ff00]" />
              Dostępna · {trainer.location}
            </span>
            {!isOwner && (
              <FavoriteButton
                slug={trainer.id}
                initialIsFavorite={initialIsFavorite}
                needsLogin={needsLoginToFavorite}
                className="w-10 h-10 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-white inline-flex items-center justify-center hover:bg-white/20 transition disabled:opacity-70"
                size={16}
              />
            )}
            <Link href={`/trainers/${trainer.id}/book`} className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[#d4ff00] text-[#0a0a0c] text-[13px] font-semibold hover:brightness-110 transition">
              Umów sesję →
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative min-h-[92vh] px-6 sm:px-12 pt-20 pb-12 overflow-hidden flex items-end">
        {/* bg image with gradient overlays */}
        <div
          className="absolute inset-0 z-0 contrast-[1.05] saturate-[0.95]"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(10,10,12,0.4) 0%, rgba(10,10,12,0.2) 40%, rgba(10,10,12,0.95) 100%), url('${heroBg}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 z-0" style={{ background: "radial-gradient(ellipse at 30% 80%, rgba(212,255,0,0.08), transparent 50%)" }} />

        {/* Top meta strip */}
        <div className="absolute top-10 left-6 sm:left-12 right-6 sm:right-12 z-10 flex justify-between items-center font-mono text-[11px] text-white/50 uppercase tracking-[0.12em]">
          <div className="flex gap-6 items-center">
            <span>NaZdrow! / Profil</span>
            <span className="text-[#d4ff00]">01</span>
            <span className="hidden sm:inline">Cinematic edition</span>
          </div>
          <div className="hidden md:flex gap-6 items-center">
            <span>{trainer.location}</span>
          </div>
        </div>

        <div className="relative z-10 w-full grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-12 items-end">
          <div>
            <h1
              className="font-medium text-white m-0 mb-6"
              style={{ fontSize: "clamp(64px, 11vw, 148px)", lineHeight: 0.88, letterSpacing: "-0.06em" }}
            >
              {firstWords}
              {lastWord && (
                <span className="block italic font-light text-white/70 ml-[0.25em]">{lastWord}.</span>
              )}
            </h1>
            <p className="text-[16px] sm:text-[18px] leading-[1.5] text-white/70 max-w-[440px] tracking-[-0.01em]">
              {trainer.tagline}
            </p>

            <div className="flex gap-2.5 mt-9 flex-wrap">
              <Link
                href={`/trainers/${trainer.id}/book`}
                className="inline-flex items-center gap-2 h-14 px-7 rounded-full bg-[#d4ff00] text-[#0a0a0c] text-[15px] font-semibold hover:brightness-110 transition"
              >
                Zarezerwuj sesję →
              </Link>
              <Link
                href={`/account/messages?with=${trainer.id}`}
                className="inline-flex items-center gap-2 h-14 px-7 rounded-full border border-white/15 text-[15px] font-medium hover:bg-white/5 transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                Wiadomość
              </Link>
            </div>
          </div>

          {/* Side stats card */}
          <div className="grid grid-cols-2 gap-px bg-white/15 border border-white/15 rounded-2xl overflow-hidden max-w-[440px]">
            <Stat value={String(trainer.experience)} suffix="lat" label="Staż" />
            <Stat value={String(trainer.reviewCount)} suffix="+" label="Klientów" />
            <Stat value={trainer.rating.toString().replace(".", ",")} suffix="★" label={`Z ${trainer.reviewCount} opinii`} />
            <Stat value="<2" suffix="h" label="Czas odpowiedzi" />
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-3 font-mono text-[10px] text-white/50 uppercase tracking-[0.2em]">
          <span>Scroll</span>
          <span className="w-px h-10 bg-gradient-to-b from-white/50 to-transparent" />
        </div>
      </section>

      {/* TICKER */}
      <div className="border-y border-white/10 py-4 overflow-hidden bg-[#0a0a0c]">
        <div className="flex gap-12 font-mono text-[14px] text-white/70 whitespace-nowrap uppercase tracking-[0.12em] px-6">
          {[...trainer.specializations, ...trainer.specializations].map((sp, i) => (
            <span key={i} className="inline-flex gap-12 items-center shrink-0">
              <span className="text-[#d4ff00]">{getSpecLabel(sp)}</span>
              <span className="text-white/40">—</span>
            </span>
          ))}
        </div>
      </div>

      {/* CHAPTER I — About */}
      {aboutBlocks.length > 0 && (
        <section className="py-24 sm:py-36">
          <div className="mx-auto max-w-[1440px] px-6 sm:px-12 grid lg:grid-cols-[420px_1fr] gap-16 lg:gap-24 items-start">
            <div className="lg:sticky lg:top-24">
              <Chap>Rozdział I · O mnie</Chap>
              <h2 style={{ fontSize: "clamp(48px, 7vw, 88px)", lineHeight: 0.95, letterSpacing: "-0.04em" }} className="font-medium m-0 mb-9">
                Droga,<br /><em className="italic font-light text-white/70">nie cel.</em>
              </h2>
              <p className="text-[15px] leading-[1.55] text-white/70">
                {trainer.tagline}
              </p>
            </div>
            <div className="grid gap-16 sm:gap-18">
              {aboutBlocks.map((paragraph, i) => (
                <div key={i}>
                  <div className="font-mono text-[11px] text-[#d4ff00] tracking-[0.2em] mb-3">{chapterTitles[i] ?? `0${i + 1} /`}</div>
                  <h3 className="text-[28px] sm:text-[42px] leading-[1.1] tracking-[-0.025em] font-medium m-0 mb-5">
                    {chapterHeads[i] ?? "—"}
                  </h3>
                  <p className="text-[15px] sm:text-[17px] leading-[1.6] text-white/70 m-0 tracking-[-0.005em]">
                    {paragraph}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FULLBLEED editorial shot */}
      <section className="relative my-12 sm:my-20 h-[60vh] sm:h-[72vh] overflow-hidden">
        <img src={fullbleed} alt="" className="w-full h-full object-cover scale-[1.03]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0c]/90" />
        <div className="absolute left-6 sm:left-12 right-6 sm:right-12 bottom-8 sm:bottom-12 z-10 flex justify-between items-end gap-6 flex-wrap">
          <div style={{ fontSize: "clamp(22px, 3vw, 40px)", lineHeight: 1.15, letterSpacing: "-0.025em" }} className="font-normal max-w-[640px]">
            „Każdy klient jest <em className="not-italic text-[#d4ff00]">inny</em>. Każdy program — <em className="not-italic text-[#d4ff00]">indywidualny</em>."
          </div>
          <div className="font-mono text-[11px] text-white/50 uppercase tracking-[0.15em] text-right shrink-0">
            Filozofia<br />§ 02 / Metoda
          </div>
        </div>
      </section>

      {/* CHAPTER II — Services */}
      {trainer.services.length > 0 && (
        <section className="py-24 sm:py-36">
          <div className="mx-auto max-w-[1440px] px-6 sm:px-12">
            <Chap>Rozdział II · Usługi</Chap>
            <h2 style={{ fontSize: "clamp(40px, 7vw, 88px)", lineHeight: 0.95, letterSpacing: "-0.04em" }} className="font-medium m-0 mb-9">
              Sposoby pracy <em className="italic font-light text-white/70">— wybierz</em>
            </h2>
            <div className="grid gap-px bg-white/10 border-y border-white/10 mt-10">
              {trainer.services.map((svc, i) => (
                <Link
                  key={svc.id ?? i}
                  href={svc.id ? `/trainers/${trainer.id}/book?service=${svc.id}` : `/trainers/${trainer.id}/book`}
                  className="group bg-[#0a0a0c] grid grid-cols-[60px_1fr_auto] sm:grid-cols-[120px_1fr_1fr_180px] gap-4 sm:gap-8 items-center py-7 sm:py-9 px-2 hover:bg-[#111114] hover:px-4 sm:hover:px-6 transition-all"
                >
                  <div className="font-mono text-[12px] sm:text-[13px] text-white/50 tracking-[0.1em]">/ {String(i + 1).padStart(3, "0")}</div>
                  <div className="text-[20px] sm:text-[28px] tracking-[-0.02em] font-medium leading-tight group-hover:text-[#d4ff00] transition">
                    {svc.name}
                  </div>
                  <div className="hidden sm:block text-[14px] text-white/70 leading-[1.55]">{svc.description}</div>
                  <div className="text-right flex flex-col gap-0.5 shrink-0">
                    <div className="text-[20px] sm:text-[26px] tracking-[-0.02em] font-medium">{svc.price} zł</div>
                    <div className="font-mono text-[10px] sm:text-[11px] text-white/50 tracking-[0.08em] uppercase">{svc.duration} min</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CHAPTER III — Pricing stage */}
      {trainer.packages.length > 0 && (
        <section className="py-24 sm:py-36 px-6 sm:px-12 bg-[#111114] border-y border-white/10">
          <div className="mx-auto max-w-[1440px] mb-12 grid lg:grid-cols-[1fr_auto] gap-12 items-end">
            <div>
              <Chap>Rozdział III · Pakiety</Chap>
              <h2 style={{ fontSize: "clamp(40px, 7vw, 88px)", lineHeight: 0.95, letterSpacing: "-0.04em" }} className="font-medium m-0">
                Długa gra. <em className="italic font-light text-white/70">Realne wyniki.</em>
              </h2>
            </div>
            <p className="text-[15px] sm:text-[17px] leading-[1.55] text-white/70 max-w-[420px]">
              Pojedyncze sesje są dla tych, którzy chcą spróbować. Pakiety — dla tych, którzy są gotowi na prawdziwą zmianę.
            </p>
          </div>
          <div className="mx-auto max-w-[1440px] grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trainer.packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative rounded-[20px] p-9 flex flex-col min-h-[420px] transition-all duration-300 ${
                  pkg.featured
                    ? "border border-[#d4ff00] bg-gradient-to-b from-[#d4ff00]/[0.08] to-[#d4ff00]/[0.02] shadow-[0_30px_80px_-40px_rgba(212,255,0,0.35)]"
                    : "border border-white/15 bg-white/[0.025] hover:border-white/25 hover:-translate-y-1"
                }`}
              >
                {pkg.featured && (
                  <span className="absolute -top-3 left-9 bg-[#d4ff00] text-[#0a0a0c] font-mono text-[11px] font-bold tracking-[0.15em] px-3 py-1.5 rounded-full">
                    ★ NAJCZĘŚCIEJ WYBIERANY
                  </span>
                )}
                <div className={`font-mono text-[11px] tracking-[0.2em] uppercase mb-4 ${pkg.featured ? "text-[#d4ff00]" : "text-white/50"}`}>
                  {pkg.name}
                </div>
                <div className="text-[24px] sm:text-[28px] tracking-[-0.02em] font-medium leading-[1.15] m-0 mb-4">
                  {pkg.description || pkg.name}
                </div>
                <div className="flex items-baseline gap-1.5 mb-4 pb-6 border-b border-white/10">
                  <span className="text-[40px] sm:text-[48px] font-medium tracking-[-0.03em] leading-none">{pkg.price.toLocaleString("pl-PL")} zł</span>
                  {pkg.period && <span className="font-mono text-[13px] text-white/50">/ {pkg.period}</span>}
                </div>
                <ul className="list-none p-0 m-0 grid gap-3 mb-8">
                  {pkg.items.slice(0, 6).map((item, i) => (
                    <li key={i} className="flex gap-2.5 text-[14px] text-white/70 leading-[1.45]">
                      <span className={`w-4 h-4 rounded-full inline-flex items-center justify-center shrink-0 mt-0.5 ${
                        pkg.featured ? "bg-[#d4ff00] text-[#0a0a0c]" : "bg-white/10 text-[#d4ff00]"
                      }`}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/trainers/${trainer.id}/book`}
                  className={`mt-auto inline-flex items-center justify-center gap-2 h-12 px-5 rounded-full text-[14px] font-medium transition ${
                    pkg.featured
                      ? "bg-[#d4ff00] text-[#0a0a0c] font-semibold hover:brightness-110"
                      : "border border-white/15 hover:bg-white/5"
                  }`}
                >
                  Wybierz {pkg.name} →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CHAPTER IV — Reel */}
      {trainer.gallery.length > 0 && (
        <section className="py-24 sm:py-36">
          <div className="mx-auto max-w-[1440px] mb-12 px-6 sm:px-12 flex justify-between items-end gap-12 flex-wrap">
            <div>
              <Chap>Rozdział IV · Kadry</Chap>
              <h2 style={{ fontSize: "clamp(40px, 7vw, 88px)", lineHeight: 0.95, letterSpacing: "-0.04em" }} className="font-medium m-0">
                Z drogi, <em className="italic font-light text-white/70">lasu, startów.</em>
              </h2>
            </div>
            <span className="font-mono text-[11px] text-white/50 uppercase tracking-[0.12em]">
              {trainer.gallery.length} kadrów
            </span>
          </div>
          <ReelGrid photos={trainer.gallery} />
        </section>
      )}

      {/* CHAPTER V — Reviews */}
      {trainer.reviews.length > 0 && (
        <section className="py-24 sm:py-36">
          <div className="mx-auto max-w-[1440px] px-6 sm:px-12">
            <div className="grid lg:grid-cols-[1fr_auto] gap-12 lg:gap-24 items-end mb-14">
              <div>
                <Chap>Rozdział V · Opinie</Chap>
                <h2 style={{ fontSize: "clamp(40px, 7vw, 88px)", lineHeight: 0.95, letterSpacing: "-0.04em" }} className="font-medium m-0">
                  Głosy <em className="italic font-light text-white/70">z drogi.</em>
                </h2>
              </div>
              <div className="flex gap-8 items-end">
                <div style={{ fontSize: "clamp(80px, 12vw, 160px)", lineHeight: 0.85, letterSpacing: "-0.06em" }} className="font-medium">
                  {trainer.rating.toString().replace(".", ",")}
                  <em className="not-italic text-[#d4ff00]">★</em>
                </div>
                <div className="pb-3">
                  <div className="text-[#d4ff00] tracking-[0.25em] mb-2">★★★★★</div>
                  <div className="font-mono text-[11px] text-white/50 tracking-[0.12em] uppercase">{trainer.reviewCount} opinii</div>
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {trainer.reviews.slice(0, 6).map((r) => (
                <div key={r.id} className="bg-white/[0.025] border border-white/10 rounded-2xl p-7 flex flex-col">
                  <div className="text-[#d4ff00] tracking-[0.25em] text-[13px] mb-4">{"★".repeat(Math.round(r.rating))}</div>
                  <p className="text-[15px] leading-[1.55] text-white m-0 mb-6 flex-grow tracking-[-0.005em]">„{r.text}"</p>
                  <div className="flex gap-3 items-center pt-5 border-t border-white/10">
                    {r.authorAvatar && (
                      <div className="w-10 h-10 rounded-full overflow-hidden">
                        <img src={r.authorAvatar} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div>
                      <div className="text-[14px] font-medium tracking-[-0.005em]">{r.authorName}</div>
                      <div className="font-mono text-[11px] text-white/50 tracking-[0.05em] mt-0.5">{r.date}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FINALE */}
      <section className="relative py-32 sm:py-44 px-6 sm:px-12 text-center overflow-hidden bg-[#0a0a0c]">
        <div className="absolute inset-0 z-0" style={{ background: "radial-gradient(ellipse at center, rgba(212,255,0,0.12) 0%, transparent 60%)" }} />
        <h2
          className="relative z-10 font-medium m-0 mb-8"
          style={{ fontSize: "clamp(64px, 12vw, 168px)", lineHeight: 0.9, letterSpacing: "-0.05em" }}
        >
          Gotów?<br /><em className="italic font-light text-[#d4ff00]">Zaczynamy.</em>
        </h2>
        <p className="relative z-10 text-[16px] sm:text-[20px] leading-[1.5] text-white/70 max-w-[580px] mx-auto mb-12">
          Pierwsza 20-minutowa rozmowa jest bezpłatna. Opowiesz mi, gdzie jesteś — a ja powiem, dokąd możemy iść razem.
        </p>
        <div className="relative z-10 flex gap-3 justify-center flex-wrap">
          <Link
            href={`/trainers/${trainer.id}/book`}
            className="inline-flex items-center gap-2 h-14 px-7 rounded-full bg-[#d4ff00] text-[#0a0a0c] text-[15px] font-semibold hover:brightness-110 transition"
          >
            Umów bezpłatną rozmowę →
          </Link>
          <Link
            href={`/account/messages?with=${trainer.id}`}
            className="inline-flex items-center gap-2 h-14 px-7 rounded-full border border-white/15 text-[15px] font-medium hover:bg-white/5 transition"
          >
            Napisz wiadomość
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 sm:px-12 py-10 border-t border-white/10 flex justify-between font-mono text-[11px] text-white/50 uppercase tracking-[0.1em] gap-4 flex-wrap">
        <span>© 2026 NaZdrow! · {trainer.name}</span>
        <span className="hidden sm:inline">Cinematic template · v1</span>
        <span>{trainer.location}</span>
      </footer>
    </div>
  );
}

function Stat({ value, suffix, label }: { value: string; suffix?: string; label: string }) {
  return (
    <div className="bg-[#0a0a0c]/60 backdrop-blur-md p-4 sm:p-5">
      <div className="text-[24px] sm:text-[32px] tracking-[-0.03em] font-medium leading-none">
        {value}
        {suffix && <em className="not-italic text-[#d4ff00] text-[16px] sm:text-[18px] ml-0.5">{suffix}</em>}
      </div>
      <div className="text-[10px] sm:text-[11px] text-white/50 mt-1.5 uppercase tracking-[0.08em]">{label}</div>
    </div>
  );
}

function Chap({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] text-white/50 tracking-[0.2em] uppercase mb-3.5 flex gap-2.5 items-center">
      <span className="w-8 h-px bg-[#d4ff00]" />
      {children}
    </div>
  );
}

// Asymmetric 12-col bento grid mirroring design-14's reel layout.
function ReelGrid({ photos }: { photos: string[] }) {
  const slots = [
    "col-span-12 sm:col-span-6 row-span-3", // a — large
    "col-span-6 sm:col-span-3 row-span-2",  // b
    "col-span-6 sm:col-span-3 row-span-2",  // c
    "col-span-6 sm:col-span-4 row-span-2",  // d
    "col-span-6 sm:col-span-4 row-span-2",  // e
    "col-span-12 sm:col-span-4 row-span-2", // f
    "col-span-6 sm:col-span-3 row-span-2",  // g
    "col-span-6 sm:col-span-5 row-span-2",  // h — wide
    "col-span-12 sm:col-span-4 row-span-2", // i
  ];
  return (
    <div className="grid grid-cols-12 auto-rows-[140px] gap-3 px-6 sm:px-12">
      {photos.slice(0, 9).map((src, i) => (
        <div key={i} className={`overflow-hidden rounded-xl ${slots[i] ?? "col-span-4 row-span-2"} relative group`}>
          <img src={src} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]" />
        </div>
      ))}
    </div>
  );
}

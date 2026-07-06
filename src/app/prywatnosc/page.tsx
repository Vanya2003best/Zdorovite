import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polityka prywatności · NaZdrow!",
  description:
    "Polityka prywatności serwisu NaZdrow! — kto jest administratorem danych, w jakich celach i na jakich podstawach prawnych przetwarzamy dane oraz jakie prawa przysługują użytkownikom (RODO).",
};

/**
 * /prywatnosc — Polityka prywatności (WERSJA ROBOCZA, RODO).
 *
 * Draft copy with explicit placeholders for administrator data — do NOT
 * invent NIP/address. Cookies section reflects the actual state of the
 * app: only essential cookies (Supabase auth session), no analytics or
 * marketing trackers — update it if any tracker is ever added.
 */

type Section = { heading: string; paragraphs: string[]; bullets?: string[] };

const SECTIONS: Section[] = [
  {
    heading: "1. Administrator danych",
    paragraphs: [
      "Administratorem danych osobowych użytkowników serwisu NaZdrow! (nazdrow.pl, dalej: „Serwis”) jest [NAZWA I ADRES ADMINISTRATORA], [NIP / KRS / CEIDG — DO UZUPEŁNIENIA] (dalej: „Administrator”).",
      "W sprawach dotyczących danych osobowych można kontaktować się z Administratorem pod adresem e-mail: kontakt@nazdrow.pl lub pisemnie na adres: [ADRES KORESPONDENCYJNY — DO UZUPEŁNIENIA].",
    ],
  },
  {
    heading: "2. Jakie dane przetwarzamy",
    paragraphs: ["W zależności od sposobu korzystania z Serwisu przetwarzamy następujące kategorie danych:"],
    bullets: [
      "dane konta: adres e-mail, imię i nazwisko lub nazwa wyświetlana, hasło (w postaci zaszyfrowanej);",
      "dane profilu trenera: zdjęcia, opis, specjalizacje, certyfikaty, lokalizacja, cennik usług;",
      "dane rezerwacji: terminy sesji, wybrane usługi, historia treningów;",
      "treść wiadomości wymienianych przez czat między klientem a trenerem;",
      "opinie i oceny wystawiane trenerom;",
      "dane podane dobrowolnie w ramach funkcji postępów (np. waga, cele treningowe, informacje o stanie zdrowia) — przetwarzane wyłącznie na podstawie wyraźnej zgody (art. 9 ust. 2 lit. a RODO);",
      "dane techniczne: adres IP, informacje o urządzeniu i przeglądarce, logi serwera.",
    ],
  },
  {
    heading: "3. Cele i podstawy prawne przetwarzania",
    paragraphs: ["Dane przetwarzamy w następujących celach:"],
    bullets: [
      "świadczenie usług Serwisu — założenie i obsługa konta, rezerwacje, czat, profile trenerów (art. 6 ust. 1 lit. b RODO — wykonanie umowy);",
      "rozliczanie abonamentu trenerów oraz realizacja obowiązków księgowych i podatkowych (art. 6 ust. 1 lit. b i c RODO);",
      "obsługa reklamacji i zapytań (art. 6 ust. 1 lit. b i f RODO);",
      "zapewnienie bezpieczeństwa Serwisu, zapobieganie nadużyciom, dochodzenie lub obrona roszczeń (art. 6 ust. 1 lit. f RODO — prawnie uzasadniony interes Administratora);",
      "przetwarzanie danych o stanie zdrowia w ramach funkcji postępów — wyłącznie za wyraźną zgodą użytkownika (art. 9 ust. 2 lit. a RODO); zgodę można wycofać w każdej chwili.",
    ],
  },
  {
    heading: "4. Odbiorcy danych",
    paragraphs: [
      "Dane mogą być powierzane podmiotom przetwarzającym je na zlecenie Administratora — wyłącznie w zakresie niezbędnym do działania Serwisu i na podstawie umów powierzenia przetwarzania danych. Są to w szczególności dostawcy usług hostingu, infrastruktury bazodanowej i poczty elektronicznej.",
      "Dane widoczne w publicznym profilu trenera (imię, zdjęcia, opis, opinie) są z natury dostępne dla odwiedzających Serwis — o ich publikacji decyduje trener.",
      "Nie sprzedajemy danych osobowych i nie udostępniamy ich podmiotom trzecim w celach marketingowych.",
    ],
  },
  {
    heading: "5. Okres przechowywania",
    paragraphs: [
      "Dane konta przechowujemy przez czas jego istnienia. Po usunięciu konta dane są usuwane lub anonimizowane, z wyjątkiem danych, których dłuższe przechowywanie jest wymagane przepisami (np. dokumenty rozliczeniowe — 5 lat) lub uzasadnione dochodzeniem roszczeń (do upływu terminów przedawnienia).",
      "Logi techniczne przechowywane są nie dłużej niż 12 miesięcy.",
    ],
  },
  {
    heading: "6. Prawa użytkownika",
    paragraphs: ["Każdemu użytkownikowi przysługują następujące prawa:"],
    bullets: [
      "prawo dostępu do danych oraz otrzymania ich kopii (art. 15 RODO);",
      "prawo do sprostowania danych (art. 16 RODO);",
      "prawo do usunięcia danych — „prawo do bycia zapomnianym” (art. 17 RODO);",
      "prawo do ograniczenia przetwarzania (art. 18 RODO);",
      "prawo do przenoszenia danych (art. 20 RODO);",
      "prawo sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie (art. 21 RODO);",
      "prawo do wycofania zgody w dowolnym momencie — bez wpływu na zgodność z prawem przetwarzania dokonanego przed jej wycofaniem;",
      "prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).",
    ],
  },
  {
    heading: "7. Pliki cookies",
    paragraphs: [
      "Serwis wykorzystuje wyłącznie pliki cookies niezbędne do jego działania — służące utrzymaniu sesji zalogowanego użytkownika i zapewnieniu bezpieczeństwa. Nie stosujemy cookies analitycznych ani marketingowych.",
      "Pliki cookies można usunąć lub zablokować w ustawieniach przeglądarki, przy czym zablokowanie cookies niezbędnych uniemożliwi logowanie do Serwisu.",
    ],
  },
  {
    heading: "8. Dobrowolność podania danych",
    paragraphs: [
      "Podanie danych jest dobrowolne, ale niezbędne do korzystania z funkcji wymagających konta (rezerwacje, czat, profil trenera). Dane dotyczące zdrowia i postępów są w pełni opcjonalne.",
    ],
  },
  {
    heading: "9. Zmiany polityki prywatności",
    paragraphs: [
      "O istotnych zmianach niniejszej polityki poinformujemy w Serwisie z wyprzedzeniem. Aktualna wersja jest zawsze dostępna pod adresem nazdrow.pl/prywatnosc.",
      "Niniejsza wersja obowiązuje od dnia [DATA WEJŚCIA W ŻYCIE — DO UZUPEŁNIENIA].",
    ],
  },
];

export default function PrywatnoscPage() {
  return (
    <div className="bg-slate-100 min-h-screen">
      <section className="text-white pt-10 pb-12" style={{ background: "#002f34" }}>
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <h1 className="m-0 text-[30px] sm:text-[40px] leading-[1.1] tracking-[-0.025em] font-bold">
            Polityka prywatności
          </h1>
          <p className="text-[14px] sm:text-[15px] text-white/75 mt-3 mb-0 max-w-[640px]">
            Jak NaZdrow! przetwarza dane osobowe użytkowników — zgodnie z RODO.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 -mt-6 pb-14">
        <div className="bg-white rounded-[14px] border border-slate-200 p-6 sm:p-10 max-w-[860px]">
          {/* Draft banner — stays until legal review. */}
          <div className="flex items-start gap-3 rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-3 mb-8">
            <span aria-hidden className="text-[18px] leading-none mt-0.5">⚠️</span>
            <p className="m-0 text-[13px] leading-relaxed text-amber-900">
              <b>Wersja robocza</b> — dokument wymaga weryfikacji prawnej. Miejsca oznaczone
              nawiasami kwadratowymi (np. „[NAZWA I ADRES ADMINISTRATORA]”) zostaną uzupełnione
              przed publikacją ostatecznej wersji.
            </p>
          </div>

          {SECTIONS.map((sec) => (
            <div key={sec.heading} className="mb-8 last:mb-0">
              <h2 className="m-0 mb-3 text-[17px] sm:text-[19px] font-bold tracking-[-0.01em] text-[#002f34]">
                {sec.heading}
              </h2>
              {sec.paragraphs.map((p, i) => (
                <p key={i} className="m-0 mb-2.5 text-[14px] leading-relaxed text-slate-700">
                  {p}
                </p>
              ))}
              {sec.bullets && (
                <ul className="m-0 mt-1 pl-5 list-disc space-y-1.5 text-[14px] leading-relaxed text-slate-700">
                  {sec.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <div className="mt-10 pt-6 border-t border-slate-200 text-[13px] text-slate-500">
            Zobacz też:{" "}
            <Link href="/regulamin" className="text-emerald-700 font-semibold hover:underline">
              Regulamin serwisu
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

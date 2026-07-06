import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Regulamin · NaZdrow!",
  description:
    "Regulamin serwisu internetowego NaZdrow! — zasady korzystania z platformy łączącej trenerów personalnych z klientami.",
};

/**
 * /regulamin — Regulamin serwisu (WERSJA ROBOCZA).
 *
 * Draft legal copy with explicit placeholders for company data
 * ([NAZWA I ADRES ADMINISTRATORA] etc.) — do NOT invent NIP/address.
 * The visible amber banner stays until the document passes legal review.
 * Payments stay trainer↔client direct (no commission, platform is never
 * a payment intermediary) — §4/§6 must not drift from that model.
 */

type Section = { heading: string; paragraphs: string[]; bullets?: string[] };

const SECTIONS: Section[] = [
  {
    heading: "§ 1. Postanowienia ogólne",
    paragraphs: [
      "Niniejszy regulamin (dalej: „Regulamin”) określa zasady korzystania z serwisu internetowego NaZdrow!, dostępnego pod adresem nazdrow.pl (dalej: „Serwis”).",
      "Operatorem Serwisu i usługodawcą usług świadczonych drogą elektroniczną jest [NAZWA I ADRES ADMINISTRATORA], [NIP / KRS / CEIDG — DO UZUPEŁNIENIA] (dalej: „Operator”).",
      "Kontakt z Operatorem: kontakt@nazdrow.pl.",
    ],
    bullets: [
      "Trener — osoba prowadząca w Serwisie profil zawodowy i oferująca usługi treningowe.",
      "Klient — osoba korzystająca z Serwisu w celu znalezienia Trenera i rezerwacji sesji.",
      "Użytkownik — każda osoba korzystająca z Serwisu (Trener lub Klient).",
      "Sesja — usługa treningowa świadczona przez Trenera na rzecz Klienta.",
    ],
  },
  {
    heading: "§ 2. Charakter Serwisu",
    paragraphs: [
      "Serwis jest platformą pośredniczącą w nawiązywaniu kontaktu między Trenerami a Klientami. Umożliwia w szczególności: przeglądanie profili Trenerów, rezerwację terminów sesji, komunikację przez czat oraz wystawianie opinii.",
      "Umowa o przeprowadzenie Sesji zawierana jest bezpośrednio między Klientem a Trenerem. Operator nie jest stroną tej umowy, nie świadczy usług treningowych i nie ponosi odpowiedzialności za ich wykonanie.",
      "Operator nie pośredniczy w płatnościach za Sesje. Rozliczenie za Sesję następuje bezpośrednio między Klientem a Trenerem, w formie uzgodnionej między nimi (np. BLIK, przelew, gotówka). Operator nie pobiera prowizji od Sesji.",
    ],
  },
  {
    heading: "§ 3. Rejestracja i konto",
    paragraphs: [
      "Korzystanie z części funkcji Serwisu (rezerwacje, czat, prowadzenie profilu Trenera) wymaga założenia konta. Rejestracja jest dobrowolna i bezpłatna dla Klientów.",
      "Użytkownik zobowiązuje się do podawania danych zgodnych z prawdą oraz do nieudostępniania danych logowania osobom trzecim.",
      "Trener oświadcza, że posiada kwalifikacje i uprawnienia wymagane do świadczenia oferowanych przez siebie usług oraz że informacje publikowane w jego profilu (w tym certyfikaty i cennik) są prawdziwe.",
      "Operator może zawiesić lub usunąć konto Użytkownika naruszającego Regulamin lub przepisy prawa, po uprzednim wezwaniu do zaprzestania naruszeń, o ile charakter naruszenia nie uzasadnia natychmiastowego działania.",
    ],
  },
  {
    heading: "§ 4. Rezerwacje, odwołania i płatności",
    paragraphs: [
      "Klient rezerwuje termin Sesji za pośrednictwem kalendarza dostępnego w profilu Trenera. Rezerwacja stanowi ofertę zawarcia umowy z Trenerem, którą Trener potwierdza lub odrzuca.",
      "Zasady odwoływania i zmiany terminu Sesji (w tym ewentualne koszty późnego odwołania) określa Trener w swoim profilu. W braku odmiennych ustaleń przyjmuje się, że bezkosztowe odwołanie jest możliwe nie później niż 12 godzin przed rozpoczęciem Sesji.",
      "Wszelkie rozliczenia za Sesje odbywają się bezpośrednio między Klientem a Trenerem (§ 2 ust. 3). Serwis nie przyjmuje, nie przechowuje ani nie przekazuje środków pieniężnych Klientów.",
    ],
  },
  {
    heading: "§ 5. Abonament dla Trenerów",
    paragraphs: [
      "Prowadzenie opublikowanego profilu Trenera jest usługą odpłatną, rozliczaną w formie abonamentu zgodnie z cennikiem dostępnym pod adresem nazdrow.pl/cennik.",
      "Trener może w każdej chwili zrezygnować z abonamentu. Profil pozostaje aktywny do końca opłaconego okresu rozliczeniowego.",
    ],
  },
  {
    heading: "§ 6. Opinie",
    paragraphs: [
      "Opinię o Trenerze może wystawić wyłącznie Klient, który odbył z nim Sesję zarezerwowaną przez Serwis.",
      "Zabronione jest publikowanie opinii nieprawdziwych, naruszających dobra osobiste lub zawierających treści bezprawne. Operator może usunąć opinię naruszającą Regulamin.",
    ],
  },
  {
    heading: "§ 7. Odpowiedzialność",
    paragraphs: [
      "Operator dokłada starań, aby Serwis działał nieprzerwanie i poprawnie, zastrzega jednak możliwość przerw technicznych niezbędnych do konserwacji lub rozwoju Serwisu.",
      "Operator nie ponosi odpowiedzialności za jakość, bezpieczeństwo ani rezultaty Sesji świadczonych przez Trenerów, ani za prawdziwość informacji publikowanych przez Użytkowników — z zastrzeżeniem obowiązków wynikających z powszechnie obowiązujących przepisów.",
      "Przed rozpoczęciem treningów Klient powinien skonsultować swój stan zdrowia z lekarzem, jeżeli istnieją ku temu wskazania.",
    ],
  },
  {
    heading: "§ 8. Reklamacje",
    paragraphs: [
      "Reklamacje dotyczące działania Serwisu można składać na adres kontakt@nazdrow.pl. Operator rozpatruje reklamację w terminie 14 dni od jej otrzymania.",
      "Reklamacje dotyczące Sesji należy kierować bezpośrednio do Trenera, jako strony umowy o świadczenie usługi treningowej.",
    ],
  },
  {
    heading: "§ 9. Odstąpienie od umowy",
    paragraphs: [
      "Użytkownik będący konsumentem może odstąpić od umowy o świadczenie usług drogą elektroniczną zawartej z Operatorem w terminie 14 dni od jej zawarcia, bez podania przyczyny, składając oświadczenie na adres kontakt@nazdrow.pl.",
      "Prawo odstąpienia nie przysługuje w odniesieniu do usług w pełni wykonanych za wyraźną zgodą konsumenta przed upływem terminu odstąpienia.",
    ],
  },
  {
    heading: "§ 10. Dane osobowe",
    paragraphs: [
      "Zasady przetwarzania danych osobowych Użytkowników opisuje Polityka prywatności dostępna pod adresem nazdrow.pl/prywatnosc.",
    ],
  },
  {
    heading: "§ 11. Postanowienia końcowe",
    paragraphs: [
      "Operator może zmienić Regulamin z ważnych przyczyn (zmiana przepisów, zmiana zakresu usług, względy bezpieczeństwa). O zmianie Użytkownicy zostaną poinformowani z co najmniej 14-dniowym wyprzedzeniem; dalsze korzystanie z Serwisu po wejściu zmian w życie oznacza ich akceptację.",
      "W sprawach nieuregulowanych Regulaminem stosuje się prawo polskie, w szczególności Kodeks cywilny, ustawę o świadczeniu usług drogą elektroniczną oraz ustawę o prawach konsumenta.",
      "Regulamin obowiązuje od dnia [DATA WEJŚCIA W ŻYCIE — DO UZUPEŁNIENIA].",
    ],
  },
];

export default function RegulaminPage() {
  return (
    <div className="bg-slate-100 min-h-screen">
      <section className="text-white pt-10 pb-12" style={{ background: "#002f34" }}>
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <h1 className="m-0 text-[30px] sm:text-[40px] leading-[1.1] tracking-[-0.025em] font-bold">
            Regulamin serwisu NaZdrow!
          </h1>
          <p className="text-[14px] sm:text-[15px] text-white/75 mt-3 mb-0 max-w-[640px]">
            Zasady korzystania z platformy łączącej trenerów personalnych z klientami.
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
            <Link href="/prywatnosc" className="text-emerald-700 font-semibold hover:underline">
              Polityka prywatności
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

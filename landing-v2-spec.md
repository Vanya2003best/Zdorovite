# Landing v2 — Allegro-style search-first

Single source of truth for the homepage rebuild. Decisions captured here are
authoritative; the HTML mockup (`43-landing-v2-desktop.html`) and the eventual
Next.js implementation both consume this doc.

Old marketing-style homepage stays at `01-landing-desktop.html` as reference
until v2 is live in production. After v2 ships → archive.

---

## 1 · Information architecture (10 sections, in order)

### 1.1 Sticky top-bar — 60 px
- Logo `NaZdrow!` (left)
- Nav: **Trenerzy** · **Specjalizacje** · **Jak to działa** · **Cennik** · **Blog**
- Right cluster: 🔍 search-icon (opens search modal) · `Zaloguj` · **`Zostań trenerem →`** (primary teal CTA)
- On scroll past hero: search collapses into compact form inside the top-bar
  (specialization + city + szukaj button only, no budget slider)

### 1.2 Hero compact — ~480 px
- H1: **"Znajdź trenera personalnego w Polsce"** — max 56 px, single line
- Sub: `240 zweryfikowanych trenerów · 12 400 opinii · 38 000 sesji`
- Big search panel — white bg, `shadow-lg`, `rounded-2xl`:
  - Field 1: **Specjalizacja** (dropdown — see §5 for list)
  - Field 2: **Miasto** (autocomplete: Warszawa, Kraków, Wrocław, …, Online)
  - Field 3: **Budżet/sesja** (slider 50–300 PLN, default 100–150)
  - Button: **SZUKAJ** — teal, large, magnifier icon
- Background: subtle gradient + foto-collage trainer-avatars on right (3-4 with
  light blur, decorative only — clicking does nothing)

### 1.3 Quick-chips — 60 px strip below hero
6 rounded-full chips, click → `/trainers?filter=X`:
1. 🏆 **Top tygodnia**
2. 🔥 **Promocje**
3. 💰 **<100 zł/sesja**
4. ✨ **Nowi trenerzy**
5. 💻 **Online**
6. 🌅 **Poranny grafik**

### 1.4 Trener tygodnia — banner card, full-width
- Horizontal card, 380 px height: 50% trainer photo / 50% content
- Content: `TRENER TYGODNIA` badge → Name + specialization → client quote ("Schudłem 18 kg w 6 mies." — Tomek) → CTA `Zobacz profil →`
- **Accent: gold (#f59e0b)** instead of teal — visually separates from the
  rest of the grid, mirrors Allegro's "Hit dnia" pattern (see §6.2)
- Rotates weekly; static mock in v1

### 1.5 Polecani trenerzy — 4×2 grid (8 cards)
- Section header: `Polecani trenerzy` + filter chips (Wszyscy / Warszawa / Online / Promocja) + `Pokaż wszystkie 240 →`
- **Card spec** (locked — same shape on /trainers listing page):
  - Photo 4:5 (280×350) cropped, lazy-loaded
  - Photo overlay badges: ✓ **Zweryfikowany** / 🔥 **Promocja −20%** / ⚡ **Online**
  - Below photo: **Name** · ★ 4.9 · 87 opinii
  - 2–3 tag chips (Siła / Redukcja / 8 lat dośw.)
  - **Price**: `od 120 zł/sesja` · `Pakiet 4× od 440 zł` (smaller, grey)
  - Location: 📍 Warszawa · Mokotów
  - Hover: subtle shadow + revealed `Umów konsultację` button

### 1.6 Specjalizacje — horizontal scroll-row
- Header: `Przeglądaj po specjalizacji`
- Horizontal scroll, 10 tiles 200×260:
  - Photo bg + name + count (`Siłownia · 87 trenerów`)
  - Hover: zoom 1.04 + dark overlay
- Tiles: Siłownia / Bieganie / Joga / Fizjo / Crossfit / Boks / Pilates / Dietetyka / Pływanie / Funkcjonalny

### 1.7 Jak to działa — 3 steps
3 columns, icon + headline + 1 sentence each, no illustrations:
1. **Znajdź trenera** — filtruj po specjalizacji, mieście, budżecie
2. **Bezpłatna konsultacja** — 15 min wideo, sprawdź chemię
3. **Zacznij trenować** — pakiet od 4 sesji, anulowanie do 24h przed

### 1.8 Trust pasek — 60 px dark bg
Four metrics on one line, separated by subtle vertical lines:
- `240+` zweryfikowanych trenerów
- `12 400` opinii
- `38 000` odbytych sesji
- `96%` klientów wraca

### 1.9 Dla trenerów — full-width recruiting CTA
- 2 columns: text + mock dashboard illustration
- Header: **"Jesteś trenerem? Zarabiaj więcej dzięki NaZdrow!"**
- 3 bullets:
  - ✓ 0% prowizji przez 3 mies.
  - ✓ Średnio +12 klientów/mies.
  - ✓ Pełen system zarządzania (kalendarz, czat, faktury)
- CTAs: **`Zostań trenerem →`** (large, teal) + `Zobacz cennik dla trenerów` (text-link)
- Background: pale teal gradient

### 1.10 Footer — 4 columns + bottom bar
- **Dla klientów**: Trenerzy / Specjalizacje / Cennik / FAQ / Blog
- **Dla trenerów**: Zostań trenerem / Cennik trenerów / Pomoc / API
- **Firma**: O nas / Kariera / Kontakt / Prasa
- **Miasta**: Warszawa (87) · Kraków (42) · Wrocław (28) · Poznań (21) · Gdańsk (18) · Łódź (15) · `pokaż wszystkie 23 →`
- Bottom bar: logo · © 2026 NaZdrow! · Polityka / Regulamin / Dostępność · social icons

---

## 2 · Search parameter contract

The hero search submits to `/trainers?spec=X&city=Y&budget=Z` where:
- `spec` — slug from `data/specializations.ts` (e.g. `silownia`, `joga`, `bieganie`)
- `city` — Polish city slug or `online`
- `budget` — single integer = **max** PLN per session (slider returns end value)

The `/trainers` results page MUST respect all three params on first paint
(no client-side filter only — SEO + shareable links).

---

## 3 · Budget model — DECIDED

**Per-session price.** Range 50–300 PLN.

- Slider returns a max-PLN integer; results filter is `services.price <= budget`
- For trainers selling only packages (no per-session), compute equivalent:
  `pkg.price / pkg.sessions_total` and display with tooltip
  `"wyliczone z pakietu 4 sesje/mies."`
- Card copy on /trainers listing: `od 120 zł/sesja · Pakiet 4× od 440 zł`
- Reasons:
  - Single comparable unit (vs per-package / monthly which are non-comparable)
  - Mental model = "ile zapłacę za to, czego dziś chcę spróbować"
  - Pakiety/abonamenty stay as upsell on the trainer profile, NOT as filter

---

## 4 · Quick-chips contract

Each chip is a deep-link to `/trainers` with a preset filter:

| Chip                  | Query string                                 | Logic                                              |
|-----------------------|----------------------------------------------|----------------------------------------------------|
| 🏆 Top tygodnia       | `?sort=top-week`                             | Highest-rated trainers with ≥3 sessions last 7d   |
| 🔥 Promocje           | `?promo=1`                                   | Any active discount (services.promo OR pkg.promo) |
| 💰 <100 zł/sesja      | `?budget=100`                                | Same slider semantics                              |
| ✨ Nowi trenerzy      | `?sort=newest`                               | `trainers.created_at >= now() - 30 days`           |
| 💻 Online             | `?format=online`                             | Has any service with `delivery = 'online'`         |
| 🌅 Poranny grafik     | `?availability=morning`                      | Has rule with `start_time <= 09:00`                |

Each chip on the results page = active-state pill at top of filter sidebar
(can be removed without leaving the page).

---

## 5 · Specjalizacje list (canonical 10)

Source of truth: `src/data/specializations.ts`. Order matters (drives display
both in hero dropdown and §6 scroll-row):

1. Siłownia
2. Bieganie
3. Joga
4. Fizjoterapia
5. Crossfit
6. Boks
7. Pilates
8. Dietetyka
9. Pływanie
10. Funkcjonalny

Each has a thumbnail (already mapped in `specializations.ts` — Unsplash IDs).

---

## 6 · Visual decisions

### 6.1 Photos
**Default: Unsplash sport portraits** (already used in `mock-trainers.ts` for
seed data). Falls back to gradient + initials when no photo. The whole point
of marketplace = visual product cards; gradient placeholders read as empty.

### 6.2 Trener tygodnia — gold accent (`#f59e0b`)
Differentiates from main teal grid. Mirrors Allegro's "Hit dnia" mechanic
where the featured item stands out chromatically, not just by size.

### 6.3 Promocje content
Mockup shows **3-4 real-looking promo trainers** (badge `−20%`, strike-through
old price). Pure-UI-no-content reads as "feature not implemented yet" and
deflates the marketplace vibe.

---

## 7 · Tech constraints

- Min-width: 1440 px (matches rest of repo)
- Tokens: `tokens.css` (already in place)
- No JS beyond:
  - Tweaks panel (existing tooling)
  - Quick-chips hover state
  - Search-form basic field validation
- Hero variants in Tweaks panel:
  - **Compact** (default) — tall search, short headline
  - **Classic** — bigger h1, search below
  - **Aggressive** — search as full-width toolbar, no h1

---

## 8 · Out of scope for v1 (parked → v3)

- **Ostatnio oglądane / Polecane dla Ciebie** — needs session/history; revisit
  after we have logged-in user behavior tracking
- **Seasonal sections** — needs CMS-driven content; add as banner slot later
- **City heatmap** — folded into footer city-list for v1
- **Mobile landing** — separate file `44-landing-v2-mobile.html` after desktop ships
- **A/B test of hero variants** — Tweaks panel has them, production picks one

---

## 9 · Acceptance criteria — when can we flip the recruiting CTA on?

Recruiting CTA in §1.1 + §1.9 = the "Zostań trenerem" button. Flipping it
exposes the trainer-side to incoming supply traffic. The trainer-side MUST
satisfy the following before we expose it to real recruiting:

### 9.1 Studio · Dostępność — ✅ DONE
- [x] Multi-shift recurring weekly pattern
- [x] Per-date exceptions (overrides table + migration 030)
- [x] Holiday-presets (Urlop / Weekend / Konferencja)
- [x] Booking-flow respects overrides (`getEffectiveAvailability`)
- [ ] Migration 030 applied in prod

### 9.2 Studio · Klienci — REQUIRED, NOT YET STARTED
- [ ] Clients list + filters (active / paused / lost)
- [ ] Per-client side panel: bookings history, notes, goals, package state
- [ ] Embedded chat per client (reuse `/studio/messages` components, no
  separate Wiadomości entry needed — already folded under Klienci in nav)
- [ ] Session-level notes (after each completed session)

### 9.3 Studio · Profil OLX-style — REQUIRED, NOT YET STARTED
- [ ] Single profile editor (basics + design merged, no two-page flow)
- [ ] Inline-edit on photo, name, tagline, location, services prices
- [ ] Photo gallery upload (min 3 photos to allow publish)
- [ ] Public preview matches listing-card data model from §1.5 above
  - `od 120 zł/sesja` price line populated from services
  - Pakiet 4× line populated from packages
  - Badge logic (Zweryfikowany / Promocja / Online) wired

### 9.4 Klient-side — DESIRABLE, soft gate
- [x] Pulpit, Treningi, Trener (chat), Profil (4-section sidebar)
- [ ] Mobile responsive — can wait until after desktop landing v2

### 9.5 Backlog v2 features (consciously deferred)
| Feature                      | Why deferred                                       |
|------------------------------|----------------------------------------------------|
| Google Calendar sync         | Needs OAuth flow + 2-way sync; expensive           |
| Masowa wiadomość             | Bulk chat = compliance question (consent)          |
| A/B test of trainer templates| Have 7 templates, 3 are enough for v1              |
| Tagi/segmenty klientów       | After we have ≥20 trainers using clients-list      |
| Faktury (auto-VAT)           | Needs accounting integration (KSeF post-2026)      |
| Custom holiday presets       | 3 hardcoded covers 90% of cases; revisit if asked  |

---

## 10 · Open questions

None at this point. All three designer questions answered:
- Photos → Unsplash (§6.1)
- Trener tygodnia → gold (§6.2)
- Promocje → show real mock content (§6.3)

Next step: designer produces `43-landing-v2-desktop.html`. Implementation in
Next.js happens after sections 9.2 + 9.3 are checked off (= after Studio
Klienci and Profil OLX-style are done).

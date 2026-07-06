# Launch-аудит связности — реестр дефектов (2026-07-06)

Read-only аудит кода по мандату Вани: «все кнопки ведут куда надо, регистрация/
авторизация без проблем, клиент↔тренер связаны, ничего лишнего». Чинить слайсами,
вычёркивать по мере фиксов. Реальная навигация = StudioTopBar/AccountTopBar
(StudioSidebar/nav-items/StudioMobileTabs/AccountSidebar — размонтированный dead code).

## P1 — блокеры запуска

- [x] ~~Мёртвый гамбургер на публичных страницах (Header.tsx)~~ — **починено 99c4404**
      (MobileMenu.tsx: гость и залогинен, 48px ряды).
- [ ] **«Napisz wiadomość» → 404** на Luxury (`LuxuryProfile.tsx:356`) и Signature
      (`SignatureProfile.tsx:421,1131`): `/trainers/[id]/messages` ловится catch-all
      `[pageSlug]` → notFound(). Заменить на `/account/messages?with=<trainerDbId>`
      (как Premium/Cinematic).
- [ ] **Потеря данных регистрации тренера при включённом «Confirm email»**
      (`register/trainer/actions.ts:76-80`): без сессии профиль (slug/tagline/
      specializations/price) НЕ сохраняется, дозаполнения в /auth/callback нет →
      тренер после подтверждения попадает в пустой /studio/start. Фикс: сохранять
      onboarding-данные (user_metadata или staging-таблица) + дозаполнение в callback.
      Сверить фактическую настройку Confirm email в Supabase (Ваня/консоль).

## P2 — заметные дефекты

- [ ] **Меню клиента ведёт в Studio** (`AccountMenu.tsx:45-66` из `AccountTopBar.tsx:221`):
      «Moje konto»/«Mój profil»/«Finanse» → /studio/* → requireTrainer выбрасывает.
      Клиентское меню должно вести в /account/settings и т.п.
- [ ] **Нет создания отзыва вообще**: reviews INSERT отсутствует в src; «Wystaw opinię»
      → `#reviews` (только показ), «Wystaw opinie zaległe (N)» — мёртвый span
      (`MojeTreningi.tsx:773-775`). Петля отзыв→ответ→профиль не запускается, хотя
      pendingReviews уже считается. Нужен полный слайс: форма (после completed-сессии)
      → INSERT с RLS → /studio/reviews → публичный профиль.
- [ ] **Ошибки auth по-английски**: login/register/trainer/reset отдают голый
      `error.message` Supabase. Нужен польский маппинг типовых ошибок.
- [ ] **Логин молчит после сбоя**: `?error=auth_failed|oauth_failed` и `?reset=1`
      не читаются LoginForm/login/page.tsx, а callback/oauth туда редиректят.
- [ ] **Юр. ссылки мёртвые**: чекбокс согласия при регистрации → `href="#"`
      (`register/page.tsx:211,215`); `/regulamin`,`/prywatnosc` в StudioProfile:1196 →
      404. Связано с 6.3 (создать страницы Regulamin/Polityka + провести ссылки).
- [ ] **`?branch=` теряется при регистрации тренера** с лендинга филиала
      (`sieci/[chain]/[branch]/page.tsx:184,214` → TrainerSignupForm не читает) —
      воронка Zdrofit молча рвётся.
- [ ] **Фейковые статы в hero главной** («240 zweryfikowanych trenerów · 12 400 opinii ·
      38 000 sesji») — заменить честным COUNT или убрать (правило honest-numbers).
- [ ] `/trainers/[id]/reviews` → 404 (`LuxuryProfile.tsx:835`) — должно быть `#reviews`.
- [ ] `/jak-to-dziala` → 404 (`StudioPulpitEmptyMode.tsx:112`) — создать или убрать CTA.
- [ ] Footer «Cennik» = `#` при живом /cennik (`Footer.tsx:53`).

## P3 — косметика/мелочи

- [ ] Footer: кластер `href="#"` (Specjalizacje/Pakiety/Opinie/Szablony/Kalendarz/
      O nas/Kontakt/Regulamin×2/Polityka×2) — `Footer.tsx:42-82`.
- [ ] LuxuryProfile:876-878 — Regulamin/Prywatność/Kontakt = `#`.
- [ ] Header 🔔 — placeholder, ведёт на /account вместо уведомлений (`Header.tsx:84-92`).
- [ ] LoginForm:23 — лейбл «Email lub telefon», а входа по телефону нет.
- [ ] Регистрация обещает «krótki quiz po rejestracji» — квиза нет (`register/page.tsx:139`);
      тренерская панель: «7 szablonów» vs «6 szablonów» (`register/trainer/page.tsx:40,46`);
      «Płatności… Przelewy24» противоречит модели (стр.47).
- [ ] Сальдо пакета: деривация «использовано» РАЗНАЯ (студия = completed only,
      `lib/db/clients.ts:208`; клиент = completed+прошедшие confirmed,
      `account/package/page.tsx:87`) — свести к одной функции.
- [ ] `book-package/actions.ts:64,90` — в SELECT нет sessions_total → pricePerSession=0
      у первой сессии пакета (искажает Finanse/LTV).
- [ ] studio/messages markThreadRead без UUID-валидации (в клиентском есть).
- [ ] account/progress: всегда пустая секция «заметки тренера» (session_notes приватны —
      корректно; секцию скрыть).
- [ ] Dead code: StudioSidebar/nav-items/StudioMobileTabs/AccountSidebar — удалить.
- [ ] /studio/kupony — заглушка «Wkrótce» вне nav; удалить или оставить вне nav.
- [ ] finanse: dev-текст «wymaga migracji 024» (проверить 024 на проде) + рудимент
      `platform: "NaZdrow!"` в METHOD_LABEL.

## Проверено и работает (не трогать)

Бронь→календарь/bookings/klienci (триггер 031 + уведомления); чат симметричен (общая
messages); reschedule двусторонний с анти-пересечением; next= проносится через весь auth;
forgot-password с анти-энумерацией; GoogleAuthButton за флагом; session_notes не текут
клиенту; /studio/finanse|uslugi, /account/plan|payments — реальные страницы.

## Не проверено из кода (нужен Ваня/консоль)
- Включён ли «Confirm email» в Supabase Auth (влияет на P1 №3).
- Применена ли миграция 024 к живой БД.
- ⚠️ 2026-07-06: Supabase-проект `cnrgttflzxwcahlbhnsc` не резолвится (DNS NXDOMAIN) —
  вероятно, запаузен free-tier. Без него всё, что читает БД, отдаёт 500.

# Тотальный рефакторинг Server Actions NaZdrow

Дата проверки: 2026-06-04. Проект: `C:\Users\vanya\zdorovite-trainers`.

## Статус сохранения и отправки

- Obsidian MCP: не найден. Через `tool_search` не найдено ни одного инструмента Obsidian.
- Локальная папка Obsidian `0. Inbox`: не нашёл поиском по `C:\Users\vanya`.
- Поэтому отчёт сохранён как fallback-файл в рабочей папке проекта: `C:\Users\vanya\zdorovite-trainers\Тотальный рефакторинг Server Actions NaZdrow.md`.
- Telegram/Hermes: callable-инструмента `hermes: messages_send` нет. В списке доступных/устанавливаемых плагинов Hermes/Telegram не найден, поэтому отправка в Telegram в этой сессии невозможна.

## Источники

- `rg --files -g actions.ts`
- AST-проверка экспортируемых `export async function` через TypeScript compiler API.
- `git status --porcelain --untracked-files=all`
- `git show HEAD:<path>` для сравнения функций с `HEAD`.
- `rg -n "zod|safeParse|z\." ...`: Zod не найден; отдельной зависимости `zod` в `package.json` также нет.
- Next.js 16 docs были проверены локально: `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` и `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md`. Ключевой риск: `redirect()` в Server Actions является control-flow exception и не должен проглатываться `catch`.

## Итог

- Проверено файлов `actions.ts`: 22.
- Найдено экспортируемых server actions: 45.
- Исправлено/изменено относительно `HEAD`: 45 функций в 22 файлах.
- Новые/untracked action-файлы: `src/app/account/settings/actions.ts`, `src/app/trainers/[id]/book-package/[pkgId]/actions.ts`.
- Zod-валидации нет. Применены ручные guards: `FormData`, `typeof`, regex, whitelists, numeric bounds, ownership/auth checks.
- Финальный `npx tsc --noEmit`: pass.
- Финальный `npm run build`: pass, Next.js 16.2.4, 42 static pages generated.

Критерии в таблице:

- `TC`: `try/catch`.
- `V`: Zod/guards; в этом проекте фактически только guards, Zod не найден.
- `SR`: структурированный возврат `{ ok: true, data? } | { error: string }`.
- `LP`: логирование через `console.error` плюс польское user-facing сообщение.

## По файлам

| Файл | Статус | Исправленные функции и критерии | Риски / примечания |
|---|---:|---|---|
| `src/app/register/actions.ts` | modified | `register` [TC, V, LP; SR нет: `RegisterState` с `error/info`, success через `redirect`] | Redirect-flow: `redirect("/account")` внутри `try`, добавлен `unstable_rethrow`. Контракт `useActionState` сохраняет state-формат. |
| `src/app/login/actions.ts` | modified | `login` [TC, V, LP; SR нет: `AuthState`, success через `redirect`] | Redirect-flow: role-aware `next` и `roleHome`, `unstable_rethrow` нужен для `NEXT_REDIRECT`. Контракт `useActionState` сохраняет state-формат. |
| `src/app/studio/messages/actions.ts` | modified | `sendMessage` [TC, V, SR, LP]; `markThreadRead` [TC, V, SR, LP] | Form action контракт: теперь action возвращает результат; вызывающие места должны читать `{error}`. |
| `src/app/studio/design/actions.ts` | modified | `updateDesign` [TC, V, SR, LP] | Риск form action/imperative call: ошибка теперь возвращается структурированно, UI должен её показать. |
| `src/app/studio/pages/actions.ts` | modified | `createTrainerPage` [TC, V, SR, LP]; `setPrimaryPage` [TC, V, SR, LP]; `setPageStatus` [TC, V, SR, LP]; `deleteTrainerPage` [TC, V, SR, LP]; `createTrainerPageAndOpenEditor` [TC, V, LP; SR нет: redirect adapter] | Redirect-flow: `createTrainerPageAndOpenEditor` завершает через `redirect`. Form action контракт был рискованным для `<form action={...}>`; финальная сборка проходит. |
| `src/app/studio/klienci/actions.ts` | modified | `addManualClient` [TC, V, SR, LP]; `updateClient` [TC, V, SR, LP]; `deleteClient` [TC, V, SR, LP] | Redirect-flow: `deleteClient` может делать `redirect("/studio/klienci")`; важно не оборачивать redirect в catch без rethrow. |
| `src/app/studio/finanse/actions.ts` | modified | `markBookingPaid` [TC, V, SR, LP]; `unmarkBookingPaid` [TC, V, SR, LP] | Form action контракт: callers должны не игнорировать `{error}`. |
| `src/app/studio/sesja/actions.ts` | modified | `saveSessionNotes` [TC, V, SR, LP]; `markSessionCompleted` [TC, V, SR, LP] | Риск миграции: код явно возвращает польскую ошибку для отсутствующей migration 025. |
| `src/app/studio/reviews/actions.ts` | modified | `setReviewReply` [TC, V, SR, LP]; `togglePinReview` [TC, V, SR, LP] | Риск схемы: `togglePinReview` tolerates missing `pinned` column (`42703`) as `{ok:true}`. |
| `src/app/studio/services/actions.ts` | modified | `createService` [TC, V, SR, LP]; `updateService` [TC, V, SR, LP]; `deleteService` [TC, V, SR, LP] | Form action контракт: service forms must surface returned errors. Deletion cancels linked bookings before delete. |
| `src/app/studio/packages/actions.ts` | modified | `createPackage` [TC, V, SR, LP]; `updatePackage` [TC, V, SR, LP]; `deletePackage` [TC, V, SR, LP] | Form action контракт: package forms must surface returned errors. Deletion cancels linked bookings before delete. |
| `src/app/studio/availability/actions.ts` | modified | `saveAvailabilityRules` [TC, V, SR, LP]; `saveAvailabilityOverride` [TC, V, SR, LP]; `updateAvailability` [TC, V, SR via delegate, LP] | Form action контракт: legacy form adapter returns `AvailabilityActionResult`; callers must handle errors. |
| `src/app/studio/bookings/actions.ts` | modified | `cancelAsTrainer` [TC, V, SR via `BookingActionResult`, LP]; `markCompleted` [TC, V, SR via `BookingActionResult`, LP]; `markNoShow` [TC, V, SR via `BookingActionResult`, LP]; `confirmBooking` [TC, V, SR via `BookingActionResult`, LP] | Form action контракт: `studio/bookings/page.tsx` and calendar wrappers may ignore returned `{error}` unless explicitly handled. Notification failures are non-fatal and logged. |
| `src/app/dodaj-klub/actions.ts` | modified | `submitClub` [TC, V, SR, LP] | Form action/imperative contract: input is object-like, не `FormData`; callers must pass expected shape. |
| `src/app/register/trainer/actions.ts` | modified | `registerTrainer` [TC, V, LP; SR нет: `TrainerSignupState` with `error/info`, success via `redirect`] | Redirect-flow: `redirect("/studio/start?welcome=1")` inside `try`, protected by `unstable_rethrow`. Email-confirmation branch returns `info`. |
| `src/app/admin/certs/actions.ts` | modified | `approveCert` [TC, V, SR, LP]; `rejectCert` [TC, V, SR, LP]; `reopenCert` [TC, V, SR, LP] | Admin/ownership guard remains critical; errors now structured. |
| `src/app/account/settings/actions.ts` | untracked | `updateProfile` [TC, V, SR, LP]; `signOut` [TC, V, SR, LP] | Новый файл относительно `HEAD`. Form action callers должны учитывать `{error}`. |
| `src/app/account/messages/actions.ts` | modified | `sendMessage` [TC, V, SR, LP]; `markThreadRead` [TC, V, SR, LP] | `markThreadRead` больше не вызывает `revalidatePath` в render-context; риск был связан с server-component render. |
| `src/app/account/bookings/actions.ts` | modified | `cancelMyBooking` [TC, V, SR, LP] | Form action contract: отмена теперь возвращает `{ok/error}`. Notification failures are non-fatal and logged. |
| `src/app/account/become-trainer/actions.ts` | modified | `becomeTrainer` [TC, V, LP; SR нет: `BecomeTrainerState`, success via `redirect`] | Redirect-flow: login redirect и финальный onboarding redirect внутри `try`, `unstable_rethrow` добавлен. |
| `src/app/trainers/[id]/book/actions.ts` | modified | `createBooking` [TC, V, LP; SR нет: `BookingState`, success via `redirect`] | Redirect-flow: login/success redirects; `unstable_rethrow` сохраняет Next control-flow. Package-aware booking добавляет риск корректности `next` URL и snapshot price. |
| `src/app/trainers/[id]/book-package/[pkgId]/actions.ts` | untracked | `createPackageBooking` [TC, V, LP; SR нет: `PackageBookingState`, success via `redirect`] | Новый файл относительно `HEAD`. Redirect-flow: login/success redirects; `unstable_rethrow` сохраняет Next control-flow. |

## Отмеченные риски

1. Redirect-flow. Все actions с `redirect()` должны либо вызывать его вне `try/catch`, либо делать `unstable_rethrow(err)` в `catch`. В текущем финальном снимке это учтено в `register`, `login`, `registerTrainer`, `becomeTrainer`, `createBooking`, `createPackageBooking`; `createTrainerPageAndOpenEditor` и `deleteClient` требуют внимательного сохранения redirect-контракта при дальнейших правках.

2. Form action контракт. После перехода с `void` на `{ok/error}` кнопки и формы, которые вызывают server action напрямую и не читают результат, могут технически проходить сборку, но терять пользовательскую ошибку. Особое внимание: studio bookings/calendar wrappers, service/package forms, finance/session/reviews clients.

3. Zod отсутствует. Требование "Zod/guards" закрыто guards-подходом, но единой схемы Zod в проекте нет. Если нужен именно Zod, это отдельная задача с добавлением зависимости и схем.

4. Два файла untracked. `account/settings/actions.ts` и `trainers/[id]/book-package/[pkgId]/actions.ts` ещё не в `HEAD`; перед релизом их нужно добавить в git вместе с вызывающими компонентами.

5. Конкурентные изменения. Во время подготовки отчёта рабочее дерево менялось; финальные выводы основаны на последнем снимке после успешных `npx tsc --noEmit` и `npm run build`.

## Проверки

```text
npx tsc --noEmit
Результат: pass
```

```text
npm run build
Результат: pass
Next.js 16.2.4 (Turbopack)
Compiled successfully
Finished TypeScript
Generated static pages: 42/42
```


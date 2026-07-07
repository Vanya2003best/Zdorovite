# Мост NaZdrow → TrainerApp (Стратегия витрины, п.2)

Реализован 2026-07-07. NaZdrow = витрина + запись; CRM = TrainerApp
(отдельный Supabase `pcmolcbgabznpqregcsp`). Мост односторонний.

## Схема

```
bookings (INSERT / UPDATE)
  └─ trigger bookings_bridge_outbox            — только если тренер есть в trainerapp_links
       └─ bridge_outbox (created|cancelled|rescheduled + payload jsonb)
            └─ pg_cron 'nazdrow-bridge-deliver-ping' (*/2 мин, только если есть недоставленные)
                 └─ pg_net POST → Edge Function bridge-deliver (x-bridge-secret)
                      ├─ NaZdrow REST: читает outbox, пишет delivered_at/attempts/last_error
                      └─ TrainerApp REST (service key):
                           created     → upsert clients (phone → точный full_name → INSERT)
                                         + INSERT appointments (status planned)
                           cancelled   → appointment → status cancelled
                           rescheduled → appointment → новые starts_at/ends_at
                                         (нет записи → создаёт как created)
```

- Связь хранится маркером `[nz:<booking_id>]` в `appointments.comment` —
  колонок в схему TrainerApp НЕ добавляли; поиск через `ilike`.
- Ретраи: до 5 попыток на событие (`attempts`), ошибка в `last_error`.
- Авто-completed: pg_cron `nazdrow-auto-complete-bookings` (раз в час):
  `confirmed|paid` брони, закончившиеся >24ч назад → `completed`
  (открывает клиенту форму отзыва). Обратного потока из TrainerApp нет.

## Файлы

- `supabase/migrations/033_trainerapp_bridge.sql` — таблицы `trainerapp_links`
  (RLS, только service role), `bridge_outbox`, триггер, оба pg_cron job.
- `supabase/functions/bridge-deliver/index.ts` — доставка (Deno, без зависимостей).
  Деплой: `supabase functions deploy bridge-deliver --project-ref cnrgttflzxwcahlbhnsc
  --no-verify-jwt --use-api` (JWT off — функция проверяет свой заголовок).
- `tsconfig.json` — `supabase/functions` исключены из Next-компиляции (Deno-глобалы).

## Секреты (значения НЕ в репо)

| Где | Имя | Что |
| --- | --- | --- |
| Edge Function secrets | `TRAINERAPP_URL`, `TRAINERAPP_SERVICE_KEY` | REST приёмника |
| Edge Function secrets | `BRIDGE_SECRET` | значение заголовка `x-bridge-secret` |
| NaZdrow Vault | `bridge_secret` | то же значение — его читает pg_cron-ping |
| WSL `~/.hermes/bridge_secret` | — | локальная копия для ручного curl |

Ручной прогон доставки:
`curl -X POST https://cnrgttflzxwcahlbhnsc.supabase.co/functions/v1/bridge-deliver -H "x-bridge-secret: $(cat ~/.hermes/bridge_secret)" -d '{}'`

## Включение моста для тренера

Мост активен ТОЛЬКО для тренеров из `trainerapp_links` (сейчас таблица пуста).
Для Вани (NaZdrow `ivan-zhigalin` → TrainerApp «Иван») — одна строка SQL:

```sql
insert into public.trainerapp_links (nazdrow_trainer_id, trainerapp_trainer_id)
values ('6cf35060-be4f-4199-a037-0fe9e3d279db', '6989047c-5cb6-4de8-a324-0d83a7a16b32')
on conflict (nazdrow_trainer_id) do nothing;
```

⚠️ Включать, когда NaZdrow-проект перестанет быть dev-песочницей (или Ваня
готов видеть тестовые брони в проде TrainerApp).

## Ограничения (сознательно не покрыто)

- Поток только NaZdrow → TrainerApp; правки/отмены в TrainerApp в NaZdrow не идут.
- Матчинг клиента: телефон → точное имя; тёзка без телефона склеится с
  существующим клиентом TrainerApp.
- `no_show` и прочие статусы не мостятся (только created/cancelled/rescheduled).
- После 5 неудачных попыток событие остаётся в outbox с `last_error` — алёртинга нет
  (смотреть `select * from bridge_outbox where delivered_at is null and attempts >= 5`).
- Секрет-ротация ручная: Vault + `supabase secrets set` + `~/.hermes/bridge_secret`.

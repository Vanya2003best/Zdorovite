// ===================================================================
// bridge-deliver — доставка событий bridge_outbox в TrainerApp.
//
// Часть моста NaZdrow → TrainerApp (миграция 033_trainerapp_bridge).
// Вызывается pg_cron'ом (pg_net POST каждые 2 мин, если есть
// недоставленные) либо вручную curl'ом. Аутентификация — заголовок
// x-bridge-secret (секрет BRIDGE_SECRET), деплой с --no-verify-jwt.
//
// Логика на событие:
//   created     → upsert клиента в TrainerApp (поиск по trainer_id+phone,
//                 затем по точному full_name, иначе INSERT) + INSERT
//                 appointments со status 'planned'.
//   cancelled   → найти appointment по маркеру [nz:<booking_id>] в
//                 comment → status 'cancelled' (не найден = noop).
//   rescheduled → найти по маркеру → новые starts_at/ends_at;
//                 не найден → создать (как created).
//
// Связь хранится строкой-маркером `[nz:<uuid>]` в appointments.comment —
// в схему TrainerApp колонок НЕ добавляем.
//
// Секреты функции (supabase secrets set):
//   TRAINERAPP_URL, TRAINERAPP_SERVICE_KEY, BRIDGE_SECRET.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY инжектятся платформой.
// ===================================================================

type BridgeEvent = "created" | "cancelled" | "rescheduled";

interface OutboxPayload {
  booking_id: string;
  event: BridgeEvent;
  nazdrow_trainer_id: string;
  client_name: string;
  client_phone: string | null;
  starts_at: string;
  ends_at: string;
  service_name: string | null;
  price: number;
  status: string;
  note: string | null;
}

interface OutboxRow {
  id: number;
  booking_id: string;
  event: BridgeEvent;
  payload: OutboxPayload;
  attempts: number;
}

const NZ_URL = Deno.env.get("SUPABASE_URL") ?? "";
const NZ_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TA_URL = (Deno.env.get("TRAINERAPP_URL") ?? "").replace(/\/$/, "");
const TA_KEY = Deno.env.get("TRAINERAPP_SERVICE_KEY") ?? "";
const BRIDGE_SECRET = Deno.env.get("BRIDGE_SECRET") ?? "";

/** Минимальный PostgREST-клиент поверх fetch. */
async function rest<T>(
  base: string,
  key: string,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

const nzRest = <T>(m: "GET" | "POST" | "PATCH", p: string, b?: unknown) =>
  rest<T>(NZ_URL, NZ_KEY, m, p, b);
const taRest = <T>(m: "GET" | "POST" | "PATCH", p: string, b?: unknown) =>
  rest<T>(TA_URL, TA_KEY, m, p, b);

const marker = (bookingId: string) => `[nz:${bookingId}]`;

/** Найти appointment по маркеру [nz:<uuid>] в comment. */
async function findAppointment(
  taTrainerId: string,
  bookingId: string,
): Promise<{ id: string } | null> {
  const pattern = encodeURIComponent(`*${marker(bookingId)}*`);
  const rows = await taRest<{ id: string }[]>(
    "GET",
    `/rest/v1/appointments?trainer_id=eq.${taTrainerId}&comment=ilike.${pattern}&select=id&limit=1`,
  );
  return rows[0] ?? null;
}

/** Upsert клиента: phone → точный full_name → INSERT. Возвращает id. */
async function upsertClient(
  taTrainerId: string,
  p: OutboxPayload,
): Promise<string> {
  if (p.client_phone) {
    const byPhone = await taRest<{ id: string }[]>(
      "GET",
      `/rest/v1/clients?trainer_id=eq.${taTrainerId}&phone=eq.${
        encodeURIComponent(p.client_phone)
      }&select=id&limit=1`,
    );
    if (byPhone[0]) return byPhone[0].id;
  }
  if (p.client_name) {
    const byName = await taRest<{ id: string }[]>(
      "GET",
      `/rest/v1/clients?trainer_id=eq.${taTrainerId}&full_name=eq.${
        encodeURIComponent(p.client_name)
      }&select=id&limit=1`,
    );
    if (byName[0]) return byName[0].id;
  }
  const inserted = await taRest<{ id: string }[]>("POST", "/rest/v1/clients", {
    trainer_id: taTrainerId,
    full_name: p.client_name || "Klient NaZdrow",
    phone: p.client_phone,
    goal: "Rezerwacja przez NaZdrow!",
  });
  return inserted[0].id;
}

/** created / rescheduled-без-существующей-записи → создать appointment. */
async function createAppointment(taTrainerId: string, p: OutboxPayload) {
  const existing = await findAppointment(taTrainerId, p.booking_id);
  if (existing) return; // уже доставлено ранее — идемпотентность
  const clientId = await upsertClient(taTrainerId, p);
  const commentParts = [
    `Rezerwacja NaZdrow!${p.price ? ` (${p.price} zł)` : ""}`,
    p.note ? `Notatka klienta: ${p.note}` : null,
    marker(p.booking_id),
  ].filter(Boolean);
  await taRest("POST", "/rest/v1/appointments", {
    trainer_id: taTrainerId,
    client_id: clientId,
    title: p.service_name || "Trening (NaZdrow!)",
    starts_at: p.starts_at,
    ends_at: p.ends_at,
    status: "planned",
    comment: commentParts.join("\n"),
  });
}

/** Обработка одного события. Возвращает note для last_error (или null). */
async function deliverOne(row: OutboxRow): Promise<string | null> {
  const links = await nzRest<{ trainerapp_trainer_id: string }[]>(
    "GET",
    `/rest/v1/trainerapp_links?nazdrow_trainer_id=eq.${row.payload.nazdrow_trainer_id}&select=trainerapp_trainer_id&limit=1`,
  );
  const link = links[0];
  if (!link) throw new Error("no trainerapp_links mapping for trainer");
  const taTrainerId = link.trainerapp_trainer_id;

  switch (row.event) {
    case "created":
      await createAppointment(taTrainerId, row.payload);
      return null;
    case "cancelled": {
      const appt = await findAppointment(taTrainerId, row.booking_id);
      if (!appt) return "noop: appointment not found in TrainerApp";
      await taRest("PATCH", `/rest/v1/appointments?id=eq.${appt.id}`, {
        status: "cancelled",
      });
      return null;
    }
    case "rescheduled": {
      const appt = await findAppointment(taTrainerId, row.booking_id);
      if (!appt) {
        await createAppointment(taTrainerId, row.payload);
        return "created (no prior appointment to reschedule)";
      }
      await taRest("PATCH", `/rest/v1/appointments?id=eq.${appt.id}`, {
        starts_at: row.payload.starts_at,
        ends_at: row.payload.ends_at,
      });
      return null;
    }
  }
}

Deno.serve(async (req) => {
  if (!BRIDGE_SECRET || req.headers.get("x-bridge-secret") !== BRIDGE_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!TA_URL || !TA_KEY) {
    return new Response(
      JSON.stringify({ error: "TRAINERAPP_URL / TRAINERAPP_SERVICE_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const rows = await nzRest<OutboxRow[]>(
    "GET",
    "/rest/v1/bridge_outbox?delivered_at=is.null&attempts=lt.5&order=id.asc&limit=20&select=id,booking_id,event,payload,attempts",
  );

  let delivered = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const note = await deliverOne(row);
      await nzRest("PATCH", `/rest/v1/bridge_outbox?id=eq.${row.id}`, {
        delivered_at: new Date().toISOString(),
        attempts: row.attempts + 1,
        last_error: note,
      });
      delivered++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      await nzRest("PATCH", `/rest/v1/bridge_outbox?id=eq.${row.id}`, {
        attempts: row.attempts + 1,
        last_error: msg.slice(0, 500),
      }).catch(() => {/* не роняем батч из-за ошибки бухгалтерии */});
    }
  }

  return new Response(
    JSON.stringify({ picked: rows.length, delivered, failed }),
    { headers: { "Content-Type": "application/json" } },
  );
});

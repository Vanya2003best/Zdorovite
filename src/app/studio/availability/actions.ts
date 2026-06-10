"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const HHMM = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const GENERIC_ERROR = "Coś poszło nie tak. Spróbuj ponownie.";

export type AvailabilityRule = { dow: number; start: string; end: string };
export type AvailabilityActionResult = { ok: true } | { error: string };

function isFormData(value: unknown): value is FormData {
  return value instanceof FormData;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateShift(
  value: unknown,
  label: string,
): { data: { start: string; end: string } } | { error: string } {
  if (!isRecord(value)) return { error: `${label}: nieprawidłowe dane godzin.` };

  const start = value.start;
  const end = value.end;
  if (typeof start !== "string" || typeof end !== "string") {
    return { error: `${label}: godziny muszą być tekstem w formacie HH:MM.` };
  }

  const normalized = { start: start.trim(), end: end.trim() };
  if (!HHMM.test(normalized.start) || !HHMM.test(normalized.end)) {
    return { error: `${label}: użyj formatu HH:MM.` };
  }
  if (normalized.start >= normalized.end) {
    return { error: `${label}: godzina końca musi być późniejsza niż początek.` };
  }

  return { data: normalized };
}

function validateRules(rules: unknown): { data: AvailabilityRule[] } | { error: string } {
  if (!Array.isArray(rules)) return { error: "Reguły dostępności muszą być listą." };
  if (rules.length > 100) return { error: "Za dużo reguł dostępności." };

  const data: AvailabilityRule[] = [];
  for (const [index, rule] of rules.entries()) {
    if (!isRecord(rule)) return { error: `Reguła ${index + 1}: nieprawidłowe dane.` };

    const dow = rule.dow;
    if (typeof dow !== "number" || !Number.isInteger(dow) || dow < 0 || dow > 6) {
      return { error: `Reguła ${index + 1}: dzień tygodnia musi być od 0 do 6.` };
    }

    const shift = validateShift(rule, `Reguła ${index + 1}`);
    if ("error" in shift) return shift;

    data.push({ dow, ...shift.data });
  }

  return { data };
}

function validateOverrideInput(
  date: unknown,
  shifts: unknown,
): { data: { date: string; shifts: { start: string; end: string }[] | null } } | { error: string } {
  if (typeof date !== "string") return { error: "Nieprawidłowy format daty." };
  const normalizedDate = date.trim();
  if (!isValidDateOnly(normalizedDate)) return { error: "Nieprawidłowy format daty." };

  if (shifts === null) return { data: { date: normalizedDate, shifts: null } };
  if (!Array.isArray(shifts)) return { error: "Zmiany dostępności muszą być listą albo wartością null." };
  if (shifts.length > 20) return { error: "Za dużo zmian dostępności dla jednego dnia." };

  const normalizedShifts: { start: string; end: string }[] = [];
  for (const [index, shift] of shifts.entries()) {
    const parsed = validateShift(shift, `Zmiana ${index + 1}`);
    if ("error" in parsed) return parsed;
    normalizedShifts.push(parsed.data);
  }

  return { data: { date: normalizedDate, shifts: normalizedShifts } };
}

/**
 * Replace the trainer's full set of weekly availability rules.
 * - dow: 0 (Sunday) ... 6 (Saturday)
 * - start/end: "HH:MM" 24-hour
 *
 * Used by the visual timeline editor in /studio/design (auto-saved on edit)
 * and the legacy form in /studio/availability (form submit).
 */
export async function saveAvailabilityRules(
  rules: AvailabilityRule[]
): Promise<AvailabilityActionResult> {
  try {
    const parsedRules = validateRules(rules);
    if ("error" in parsedRules) return { error: parsedRules.error };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Niezalogowany." };

    const valid = parsedRules.data.map((rule) => ({
      trainer_id: user.id,
      day_of_week: rule.dow,
      start_time: rule.start,
      end_time: rule.end,
    }));

    const { error: delErr } = await supabase.from("availability_rules").delete().eq("trainer_id", user.id);
    if (delErr) return { error: delErr.message };

    if (valid.length > 0) {
      const { error: insertErr } = await supabase.from("availability_rules").insert(valid);
      if (insertErr) return { error: insertErr.message };
    }

    revalidatePath("/studio/availability");
    revalidatePath("/studio/design");
    return { ok: true };
  } catch (err) {
    console.error("[studio/availability] saveAvailabilityRules failed:", err);
    return { error: GENERIC_ERROR };
  }
}

/**
 * Replace the override entries for a single date with the given shifts.
 * - shifts === null  -> store an `is_closed` row (trainer is closed that
 *                       day even though the recurring rule says otherwise)
 * - shifts === []    -> CLEAR the override (revert to the recurring rule)
 * - shifts.length>0  -> store one row per shift (open hours for that date)
 *
 * Date is YYYY-MM-DD in Warsaw-local. Idempotent: any prior overrides for
 * the same (trainer, date) are wiped first.
 */
export async function saveAvailabilityOverride(
  date: string,
  shifts: { start: string; end: string }[] | null
): Promise<AvailabilityActionResult> {
  try {
    const parsed = validateOverrideInput(date, shifts);
    if ("error" in parsed) return { error: parsed.error };
    const { date: normalizedDate, shifts: normalizedShifts } = parsed.data;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Niezalogowany." };

    // Wipe existing overrides for this date.
    const { error: delErr } = await supabase
      .from("availability_overrides")
      .delete()
      .eq("trainer_id", user.id)
      .eq("date", normalizedDate);

    if (delErr) return { error: delErr.message };

    if (normalizedShifts === null) {
      // Closed-day marker. Sentinel start_time '00:00' keeps the composite
      // PK working alongside open-shift rows.
      const { error: insertErr } = await supabase.from("availability_overrides").insert({
        trainer_id: user.id,
        date: normalizedDate,
        start_time: "00:00",
        end_time: null,
        is_closed: true,
      });
      if (insertErr) return { error: insertErr.message };
    } else if (normalizedShifts.length > 0) {
      const rows = normalizedShifts.map((shift) => ({
        trainer_id: user.id,
        date: normalizedDate,
        start_time: shift.start,
        end_time: shift.end,
        is_closed: false,
      }));

      const { error: insertErr } = await supabase.from("availability_overrides").insert(rows);
      if (insertErr) return { error: insertErr.message };
    }
    // normalizedShifts === [] -> just the wipe; recurring rule comes back into effect.

    revalidatePath("/studio/calendar");
    revalidatePath("/studio/availability");
    return { ok: true };
  } catch (err) {
    console.error("[studio/availability] saveAvailabilityOverride failed:", err);
    return { error: GENERIC_ERROR };
  }
}

/** Legacy form-data adapter for /studio/availability/page.tsx form submit. */
export async function updateAvailability(formData: FormData): Promise<AvailabilityActionResult> {
  try {
    if (!isFormData(formData)) return { error: "Nieprawidłowe dane formularza." };

    const rules: AvailabilityRule[] = [];
    for (let dow = 0; dow <= 6; dow++) {
      const enabled = formData.get(`d${dow}_enabled`);
      if (enabled === null) continue;
      if (typeof enabled !== "string" || enabled !== "on") {
        return { error: `Dzień ${dow}: nieprawidłowa wartość włączenia.` };
      }

      const startRaw = formData.get(`d${dow}_start`);
      const endRaw = formData.get(`d${dow}_end`);
      if (typeof startRaw !== "string" || typeof endRaw !== "string") {
        return { error: `Dzień ${dow}: niepełny czas pracy.` };
      }

      const start = startRaw.trim();
      const end = endRaw.trim();
      const parsed = validateShift({ start, end }, `Dzień ${dow}`);
      if ("error" in parsed) return { error: parsed.error };

      rules.push({ dow, ...parsed.data });
    }

    return await saveAvailabilityRules(rules);
  } catch (err) {
    console.error("[studio/availability] updateAvailability failed:", err);
    return { error: GENERIC_ERROR };
  }
}

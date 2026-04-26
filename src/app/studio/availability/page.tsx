import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AvailabilityEditor from "./AvailabilityEditor";

export type DayRule = { start: string; end: string };

export default async function AvailabilityDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/availability");

  const { data: rules } = await supabase
    .from("availability_rules")
    .select("day_of_week, start_time, end_time")
    .eq("trainer_id", user.id);

  // Map dow → first rule. If trainer wants multiple rules per day we'd need a different UI.
  const byDow: Record<number, DayRule | null> = {
    0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
  };
  (rules ?? []).forEach((r) => {
    byDow[r.day_of_week] = { start: String(r.start_time).slice(0, 5), end: String(r.end_time).slice(0, 5) };
  });

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Godziny pracy</h2>
        <p className="text-sm text-slate-600 mt-1">
          Ustaw swoje godziny pracy dla każdego dnia tygodnia. Klienci zobaczą tylko te dni i godziny podczas rezerwacji.
        </p>
      </header>

      <AvailabilityEditor initialByDow={byDow} />
    </div>
  );
}

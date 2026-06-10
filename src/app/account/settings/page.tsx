import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Ustawienia, { type UstawieniaData } from "./Ustawienia";

/**
 * /account/settings — Ustawienia.
 *
 * Server orchestrator. Pulls profile (display_name, avatar, phone) and
 * the auth user's email; passes everything to <Ustawienia/> for the
 * client-side form.
 */
export default async function SettingsPage() {
  const { user } = await requireClient("/account/settings");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, avatar_focal, phone")
    .eq("id", user.id)
    .maybeSingle();

  const data: UstawieniaData = {
    email: user.email ?? "",
    displayName: profile?.display_name ?? "",
    phone: profile?.phone ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    avatarFocal: (profile as { avatar_focal?: string | null } | null)?.avatar_focal ?? null,
  };

  return <Ustawienia data={data} />;
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  completeTrainerOnboarding,
  parseTrainerOnboarding,
} from "@/app/register/trainer/onboarding";

// Handles the ?code= param that Supabase appends to:
// - email confirmation links
// - password-reset links
// - OAuth callbacks (Google, Apple, etc)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/account";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Deferred trainer onboarding: when "Confirm email" is ON in Supabase,
      // the signup action has no session and parks the wizard data in
      // user_metadata (trainer_onboarding). The first authenticated visit —
      // this code exchange — completes the profile. RLS is satisfied: the
      // exchanged session IS the trainer's own.
      const user = data.user ?? data.session?.user ?? null;
      const onboarding = parseTrainerOnboarding(user?.user_metadata);
      if (user && onboarding) {
        const { data: existing } = await supabase
          .from("trainers")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();
        if (!existing) {
          const result = await completeTrainerOnboarding(supabase, user.id, onboarding);
          if (result.error) {
            console.error(
              "[auth/callback] deferred trainer onboarding failed:",
              result.error,
            );
            // Session is live — let the trainer finish manually in Studio.
            // Metadata is kept so the data isn't lost.
            return NextResponse.redirect(`${origin}/studio/start`);
          }
        }
        // Profile exists (created now or earlier) — metadata copy no longer
        // needed; clear it so onboarding never re-runs from stale data.
        await supabase.auth.updateUser({ data: { trainer_onboarding: null } });
        return NextResponse.redirect(`${origin}/studio/start?welcome=1`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}

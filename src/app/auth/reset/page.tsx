import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ResetForm from "./ResetForm";

// Landing page of the password-recovery email link. /auth/callback has
// already exchanged the recovery code for a session — if there is none,
// the link is stale and the user needs a fresh one.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password");

  return (
    <div className="min-h-[100dvh] bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-[0_10px_40px_rgba(2,6,23,0.08)] p-8">
        <h1 className="text-[24px] tracking-[-0.025em] font-semibold mt-0 mb-2">
          Ustaw nowe hasło
        </h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Konto: <b>{user.email}</b>. Po zapisaniu od razu wrócisz do aplikacji.
        </p>
        <ResetForm />
      </div>
    </div>
  );
}

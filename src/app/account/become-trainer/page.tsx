import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { specializations } from "@/data/specializations";
import { requireUser, isTrainer } from "@/lib/auth";
import BecomeTrainerForm from "./BecomeTrainerForm";

export default async function BecomeTrainerPage() {
  const { user, profile } = await requireUser("/account/become-trainer");
  const trainer = isTrainer(profile);
  // Existing trainers edit their profile in /studio/profile, not here.
  if (trainer) redirect("/studio/profile");

  const supabase = await createClient();
  const { data: existingTrainer } = await supabase
    .from("trainers")
    .select("slug, tagline, about, experience, price_from, location, languages")
    .eq("id", user.id)
    .maybeSingle();

  const { data: existingSpecs } = await supabase
    .from("trainer_specializations")
    .select("specialization_id")
    .eq("trainer_id", user.id);

  return (
    <div className="mx-auto max-w-[720px] px-5 sm:px-6 py-8 sm:py-12">
      <nav className="text-[13px] text-slate-500 mb-5">
        <Link href={trainer ? "/studio" : "/account"} className="hover:text-slate-900 transition">
          ← Wróć
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          {trainer ? "Edytuj profil trenera" : "Zostań trenerem"}
        </h1>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-[560px]">
          {trainer
            ? "Zaktualizuj dane swojego publicznego profilu. Zmiany pojawią się od razu w katalogu."
            : "Wypełnij poniższy formularz, żeby pojawić się w katalogu NaZdrow!. Później będziesz mógł dodać usługi, pakiety i swoje godziny pracy."}
        </p>
      </header>

      <BecomeTrainerForm
        displayName={profile.display_name}
        isTrainer={trainer}
        existing={existingTrainer ?? null}
        existingSpecs={existingSpecs?.map((s) => s.specialization_id) ?? []}
        specializations={specializations}
      />
    </div>
  );
}

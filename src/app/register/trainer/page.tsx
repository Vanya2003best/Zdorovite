import Link from "next/link";
import { redirect } from "next/navigation";
import { specializations } from "@/data/specializations";
import { getCurrentUser, isTrainer } from "@/lib/auth";
import TrainerSignupForm from "./TrainerSignupForm";

export default async function TrainerRegisterPage() {
  // Already a trainer? Skip the signup, send them straight to Studio.
  const cu = await getCurrentUser();
  if (cu && isTrainer(cu.profile)) redirect("/studio");

  return (
    <div className="mx-auto max-w-[720px] px-5 sm:px-6 py-8 sm:py-12 pb-24">
      <header className="mb-8">
        <p className="text-[13px] uppercase tracking-[0.08em] text-emerald-700 font-medium">
          NaZdrow! Studio
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-1">
          Stań się trenerem
        </h1>
        <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-[560px]">
          Załóż konto, wypełnij podstawy profilu i od razu pojawisz się w katalogu klientów.
          Później dodasz usługi, pakiety, zdjęcia i poustawiasz wygląd swojego profilu.
        </p>
        <p className="text-[13px] text-slate-500 mt-3">
          Masz już konto?{" "}
          <Link href="/login" className="text-emerald-700 font-medium hover:underline">
            Zaloguj się
          </Link>
        </p>
      </header>

      <TrainerSignupForm specializations={specializations} />
    </div>
  );
}

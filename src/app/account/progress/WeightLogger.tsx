"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logWeight } from "@/lib/actions/weight";

type Props = {
  /** Latest reading, used for the "ostatnio: ..." hint and as the default value. */
  latest: { recordedAt: string; weightKg: number } | null;
};

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

export default function WeightLogger({ latest }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(latest ? String(latest.weightKg).replace(".", ",") : "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const n = parseFloat(value.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setError("Niepoprawna waga.");
      return;
    }
    startTransition(async () => {
      const res = await logWeight({ weightKg: n });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11.5px] text-emerald-300 font-medium hover:text-emerald-200 transition"
      >
        {latest ? "Zapisz nowy pomiar" : "Zapisz pierwszy pomiar"}
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2 items-center mt-2">
      <input
        type="text"
        inputMode="decimal"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="np. 77,6"
        className="w-24 px-2.5 py-1.5 bg-white/10 border border-white/20 rounded-[8px] text-[13px] text-white placeholder:text-white/40 outline-none focus:border-emerald-300"
      />
      <span className="text-[12px] text-white/60">kg · {fmtDate(new Date().toISOString().slice(0, 10))}</span>
      <button
        type="submit"
        disabled={pending}
        className="px-3 py-1.5 rounded-[8px] bg-emerald-500 text-white text-[12px] font-semibold hover:bg-emerald-400 transition disabled:opacity-50"
      >
        {pending ? "..." : "Zapisz"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={pending}
        className="text-[11.5px] text-white/60 hover:text-white/80"
      >
        Anuluj
      </button>
      {error && <span className="text-[11.5px] text-rose-300 ml-2">{error}</span>}
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitClub, type SubmitClubInput } from "./actions";

type ChainOption = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Public-facing club registration form. Two paths:
 *  - "Mój klub należy do istniejącej sieci" → pick from `chains` dropdown
 *  - "Nowa sieć" → fill chain name/website/colour inline alongside branch fields
 *
 * On success redirects to the (still pending) branch's URL so the registrar
 * sees their submission rendered. status='pending' means the branch is
 * visible only to its registrant until NaZdrow! verifies — RLS handles
 * that via auth.uid() = registered_by.
 */
export default function AddClubForm({ chains }: { chains: ChainOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [chainMode, setChainMode] = useState<"existing" | "new">(
    chains.length > 0 ? "existing" : "new",
  );
  const [chainId, setChainId] = useState<string>(chains[0]?.id ?? "");
  const [newChainName, setNewChainName] = useState("");
  const [newChainWebsite, setNewChainWebsite] = useState("");
  const [newChainColor, setNewChainColor] = useState("#10b981");

  const [branchName, setBranchName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [recruitingOpen, setRecruitingOpen] = useState(false);
  const [recruitingMessage, setRecruitingMessage] = useState("");

  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [nip, setNip] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input: SubmitClubInput = {
      chainId: chainMode === "existing" ? chainId : undefined,
      newChainName: chainMode === "new" ? newChainName : undefined,
      newChainWebsite: chainMode === "new" ? newChainWebsite : undefined,
      newChainColor: chainMode === "new" ? newChainColor : undefined,
      branchName,
      city,
      address,
      recruitingOpen,
      recruitingMessage: recruitingOpen ? recruitingMessage : undefined,
      contactEmail,
      contactPhone,
      nip: nip || undefined,
    };
    startTransition(async () => {
      const res = await submitClub(input);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push(`/sieci/${res.chainSlug}/${res.branchSlug}?nowy=1`);
    });
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      {/* Chain section */}
      <fieldset className="grid gap-3 p-5 rounded-2xl border border-slate-200 bg-white">
        <legend className="text-[12px] font-semibold tracking-[0.08em] uppercase text-slate-500 px-1">
          Sieć
        </legend>

        {chains.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {(["existing", "new"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setChainMode(mode)}
                className={`px-3 py-1.5 rounded-full text-[12.5px] transition border ${
                  chainMode === mode
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                }`}
              >
                {mode === "existing" ? "Istniejąca sieć" : "Nowa sieć"}
              </button>
            ))}
          </div>
        )}

        {chainMode === "existing" ? (
          <select
            value={chainId}
            onChange={(e) => setChainId(e.target.value)}
            className="text-[14px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
            required
          >
            {chains.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              type="text"
              placeholder="Nazwa sieci (np. Calypso Fitness)"
              value={newChainName}
              onChange={(e) => setNewChainName(e.target.value)}
              maxLength={60}
              required
              className="text-[14px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
            />
            <input
              type="url"
              placeholder="Strona www (opcjonalnie)"
              value={newChainWebsite}
              onChange={(e) => setNewChainWebsite(e.target.value)}
              className="text-[14px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
            />
            <label className="flex items-center gap-3 text-[13px] text-slate-700">
              <span>Kolor brand</span>
              <input
                type="color"
                value={newChainColor}
                onChange={(e) => setNewChainColor(e.target.value)}
                className="w-10 h-8 rounded border border-slate-200 cursor-pointer"
              />
              <code className="text-[11px] text-slate-500">{newChainColor}</code>
            </label>
          </>
        )}
      </fieldset>

      {/* Branch section */}
      <fieldset className="grid gap-3 p-5 rounded-2xl border border-slate-200 bg-white">
        <legend className="text-[12px] font-semibold tracking-[0.08em] uppercase text-slate-500 px-1">
          Klub
        </legend>
        <input
          type="text"
          placeholder="Nazwa klubu (np. Wrocław Aleja Pokoju)"
          value={branchName}
          onChange={(e) => setBranchName(e.target.value)}
          maxLength={80}
          required
          className="text-[14px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Miasto"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={40}
            required
            className="text-[14px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 sm:col-span-1"
          />
          <input
            type="text"
            placeholder="Pełny adres (ulica, kod, miasto)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={200}
            required
            className="text-[14px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 sm:col-span-2"
          />
        </div>
        <label className="flex items-start gap-2 text-[13px] text-slate-700 mt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={recruitingOpen}
            onChange={(e) => setRecruitingOpen(e.target.checked)}
            className="mt-1"
          />
          <div>
            <span className="font-medium">Aktywnie rekrutujemy trenerów</span>
            <div className="text-[11.5px] text-slate-500 mt-0.5">
              Klub pojawia się z plakietką „Rekrutuje” i w filtrze trenerów szukających klubu.
            </div>
          </div>
        </label>
        {recruitingOpen && (
          <textarea
            placeholder="Wiadomość do trenerów (opcjonalnie, max 200 znaków)"
            value={recruitingMessage}
            onChange={(e) => setRecruitingMessage(e.target.value)}
            maxLength={200}
            rows={2}
            className="text-[13px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 resize-vertical"
          />
        )}
      </fieldset>

      {/* Contact section */}
      <fieldset className="grid gap-3 p-5 rounded-2xl border border-slate-200 bg-white">
        <legend className="text-[12px] font-semibold tracking-[0.08em] uppercase text-slate-500 px-1">
          Kontakt menedżera (do weryfikacji)
        </legend>
        <p className="text-[12px] text-slate-500 -mt-1">
          NaZdrow! zadzwoni lub wyśle email w ciągu 48h żeby potwierdzić zgłoszenie.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="email"
            placeholder="email@klub.pl"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
            className="text-[14px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
          />
          <input
            type="tel"
            placeholder="+48 600 000 000"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            required
            className="text-[14px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
          />
        </div>
        <input
          type="text"
          placeholder="NIP (opcjonalnie — przyspiesza weryfikację)"
          value={nip}
          onChange={(e) => setNip(e.target.value)}
          maxLength={15}
          className="text-[14px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
        />
      </fieldset>

      {error && (
        <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 px-6 rounded-xl bg-slate-900 text-white text-[14px] font-semibold hover:bg-black transition disabled:opacity-60"
      >
        {pending ? "Wysyłam..." : "Zgłoś klub do weryfikacji"}
      </button>
      <p className="text-[12px] text-slate-500 text-center -mt-2">
        Zgłoszenie jest darmowe. NaZdrow! nigdy nie pobiera prowizji od umów trener-klient.
      </p>
    </form>
  );
}

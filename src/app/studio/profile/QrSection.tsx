"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

type BranchOption = {
  id: string;
  chainSlug: string;
  branchSlug: string;
  chainName: string;
  branchName: string;
  status: "self_claimed" | "verified" | "rejected";
};

/**
 * QR-code generator block on /studio/profile. Outputs a print-ready QR
 * pointing directly to /trainers/[slug] with an optional ?source=… tag
 * for analytics — so when a flyer at Zdrofit Aleja Pokoju gets scanned
 * we know which placement drove the visit.
 *
 * Two modes (radio toggle):
 *   - "Ogólny" — just /trainers/[slug] without source. For business cards,
 *     Insta bio, generic flyers.
 *   - "Dla klubu" — appends ?source=[chain]-[branch]. Dropdown filtered
 *     to the trainer's confirmed branch affiliations, so a trainer
 *     can't print a Zdrofit-tagged QR if they aren't actually at Zdrofit.
 *     Works without affiliations — falls back to "Ogólny".
 *
 * Generation runs in the browser via the `qrcode` package — no
 * round-trip per regeneration, instant preview as the trainer flips
 * between sources. Download emits a 768×768 PNG with a 32px white
 * border (so it scans cleanly from a printed page even with shadows).
 */
export default function QrSection({
  trainerSlug,
  trainerName,
  origin,
  branches,
}: {
  trainerSlug: string;
  trainerName: string;
  /** Resolved at SSR time (needed because window.location isn't available on
   *  first render and we want the QR URL ready immediately). */
  origin: string;
  branches: BranchOption[];
}) {
  const [mode, setMode] = useState<"general" | "branch">(
    branches.length > 0 ? "branch" : "general",
  );
  const [branchId, setBranchId] = useState<string>(branches[0]?.id ?? "");
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const url = useMemo(() => {
    const base = `${origin}/trainers/${trainerSlug}`;
    if (mode === "branch" && branchId) {
      const b = branches.find((x) => x.id === branchId);
      if (b) return `${base}?source=${b.chainSlug}-${b.branchSlug}`;
    }
    return base;
  }, [origin, trainerSlug, mode, branchId, branches]);

  // Render the SVG preview (sharper than canvas at any size, scales
  // freely in the page) AND keep a hidden 768×768 canvas around for the
  // PNG download path.
  useEffect(() => {
    QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((svg) => setPreviewSvg(svg))
      .catch(() => setPreviewSvg(null));
    const canvas = canvasRef.current;
    if (canvas) {
      QRCode.toCanvas(canvas, url, {
        errorCorrectionLevel: "M",
        margin: 4,
        width: 768,
        color: { dark: "#0f172a", light: "#ffffff" },
      }).catch(() => {});
    }
  }, [url]);

  const onDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    const sourceTag =
      mode === "branch" && branchId
        ? "-" + (branches.find((x) => x.id === branchId)?.branchSlug ?? "klub")
        : "";
    a.download = `nazdrow-${trainerSlug}${sourceTag}.png`;
    a.href = dataUrl;
    a.click();
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older browsers / blocked clipboard → no-op. Fallback would
      // be a hidden <input> + execCommand("copy") but that's CSP-iffy
      // and clipboard API has been universal for years.
    }
  };

  return (
    <div className="grid gap-4">
      <div>
        <h3 className="text-[16px] font-semibold tracking-tight text-slate-900 m-0">
          QR-kody do druku
        </h3>
        <p className="text-[13px] text-slate-600 mt-1 m-0">
          Wydrukuj kod, naklej w klubie / na wizytówce / w Insta-bio. Klient
          skanuje → trafia bezpośrednio na Twój profil. Z parametrem klubu
          widzimy skąd przyszedł.
        </p>
      </div>

      {/* Mode toggle */}
      {branches.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {(["branch", "general"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-full text-[12.5px] transition border ${
                mode === m
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
              }`}
            >
              {m === "branch" ? "Dla klubu" : "Ogólny"}
            </button>
          ))}
        </div>
      )}

      {mode === "branch" && branches.length > 0 && (
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="text-[13px] py-2 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 max-w-[480px]"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.chainName} · {b.branchName}
              {b.status !== "verified" ? " (oczekuje na weryfikację)" : ""}
            </option>
          ))}
        </select>
      )}

      {/* Preview + actions */}
      <div className="grid gap-4 sm:grid-cols-[200px_1fr] items-start">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 inline-block">
          {previewSvg ? (
            <div
              className="w-[168px] h-[168px]"
              // SVG is generated by `qrcode` lib; safe to inject.
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
          ) : (
            <div className="w-[168px] h-[168px] bg-slate-100 rounded animate-pulse" />
          )}
        </div>
        <div className="grid gap-3">
          <div className="text-[13px] text-slate-700 break-all bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono">
            {url}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold hover:bg-black transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Pobierz PNG (768×768)
            </button>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white border border-slate-200 text-slate-700 text-[13px] font-medium hover:border-slate-400 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Skopiuj URL
            </button>
          </div>
          <p className="text-[11.5px] text-slate-500 -mt-1">
            Tip: drukuj na A6 (10×15 cm) albo A7 (7×10 cm) z białym marginesem
            wokół kodu — skanuje się dokładniej niż naklejka edge-to-edge.
            Plik {trainerName ? `"nazdrow-${trainerSlug}.png"` : "PNG"} pasuje
            do każdego programu do druku.
          </p>
        </div>
      </div>

      {/* Hidden — used as the canvas for the PNG download. Kept off-DOM
          (display:none) so it doesn't reflow but still rasterises. */}
      <canvas ref={canvasRef} width={768} height={768} className="hidden" />
    </div>
  );
}

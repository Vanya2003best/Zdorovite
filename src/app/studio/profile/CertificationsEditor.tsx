"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addCertification,
  removeCertification,
  updateCertificationField,
  uploadCertAttachment,
  removeCertAttachment,
} from "./cert-actions";
import type { Certification } from "@/types";

/**
 * Client-side editor for the trainer's certifications list. Each row has:
 *   - text (the cert name) — editable input
 *   - verification URL (optional) — link to issuer's registry; click "Sprawdź"
 *     button on public profile to verify
 *   - attachment (optional PDF/image) — uploaded to cert-attachments bucket
 *
 * Saves are debounced-on-blur via the standard input pattern (no custom debounce
 * timer needed — server actions de-dup by replacing the row's text/url verbatim).
 */
export default function CertificationsEditor({ certs }: { certs: Certification[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onAdd = () => {
    startTransition(async () => {
      await addCertification();
      router.refresh();
    });
  };

  return (
    <div className="grid gap-3">
      {certs.length === 0 && (
        <div className="text-[13px] text-slate-500 italic py-2">
          Brak certyfikatów. Dodaj swój pierwszy poniżej.
        </div>
      )}

      {certs.map((c, i) => (
        <CertRow key={c.id} cert={c} index={i} />
      ))}

      <button
        type="button"
        onClick={onAdd}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border-2 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 transition text-[13px] font-medium disabled:opacity-60"
      >
        <span className="text-lg leading-none">+</span>
        {pending ? "Dodaję..." : "Dodaj certyfikat"}
      </button>

      <div className="text-[12px] text-slate-500 leading-[1.55] mt-1">
        <strong className="text-slate-700">Wskazówka:</strong> link weryfikacyjny prowadzi do publicznego rejestru wystawcy
        (np. <a href="https://www.ereps.eu/" target="_blank" rel="noopener" className="text-emerald-700 underline">ereps.eu</a>,
        AWF, FMS), gdzie odwiedzający może sam potwierdzić Twój certyfikat. Plik PDF/zdjęcie jest pomocnicze i widoczne
        publicznie.
      </div>
    </div>
  );
}

function CertRow({ cert, index }: { cert: Certification; index: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(cert.text);
  const [url, setUrl] = useState(cert.verificationUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onTextBlur = () => {
    if (text.trim() === cert.text) return;
    setError(null);
    startTransition(async () => {
      const res = await updateCertificationField(cert.id, "text", text);
      if ("error" in res) {
        setError(res.error);
        setText(cert.text);
      } else {
        router.refresh();
      }
    });
  };

  const onUrlBlur = () => {
    if (url.trim() === (cert.verificationUrl ?? "")) return;
    setError(null);
    startTransition(async () => {
      const res = await updateCertificationField(cert.id, "verification_url", url);
      if ("error" in res) {
        setError(res.error);
        setUrl(cert.verificationUrl ?? "");
      } else {
        router.refresh();
      }
    });
  };

  const onDelete = () => {
    if (!confirm(`Usunąć certyfikat "${cert.text}"?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await removeCertification(cert.id);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("certId", cert.id);
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadCertAttachment(fd);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
    e.target.value = "";
  };

  const onRemoveAttachment = () => {
    if (!cert.attachmentUrl) return;
    if (!confirm("Usunąć załącznik?")) return;
    setError(null);
    startTransition(async () => {
      const res = await removeCertAttachment(cert.id);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white grid gap-3">
      <div className="flex items-start gap-3">
        <div className="font-mono text-[11px] text-slate-400 tracking-[0.1em] mt-3 shrink-0 w-6">
          {String(index + 1).padStart(2, "0")}
        </div>
        <div className="flex-1 grid gap-2 min-w-0">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={onTextBlur}
            placeholder="Nazwa certyfikatu (np. EREPS Personal Trainer Level 4)"
            maxLength={200}
            className="w-full text-[14px] text-slate-900 border border-slate-200 rounded-lg px-3 py-2 hover:border-slate-300 focus:border-emerald-500 focus:outline-none"
          />
          <div className="flex gap-2 items-center">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={onUrlBlur}
              placeholder="Link weryfikacyjny (https://…)"
              maxLength={2000}
              className="flex-1 text-[12px] text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-slate-300 focus:border-emerald-500 focus:outline-none font-mono"
            />
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-emerald-700 hover:underline shrink-0"
              >
                ↗ Sprawdź
              </a>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          title="Usuń certyfikat"
          className="text-slate-400 hover:text-red-600 transition w-8 h-8 inline-flex items-center justify-center shrink-0"
        >
          🗑
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap pl-9">
        {cert.attachmentUrl ? (
          <>
            <a
              href={cert.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-emerald-700 hover:underline"
            >
              📎 {cert.attachmentFilename ?? "Załącznik"}
            </a>
            <button
              type="button"
              onClick={onRemoveAttachment}
              disabled={pending}
              className="text-[11px] text-slate-500 hover:text-red-600 transition"
            >
              Usuń
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending}
              className="text-[11px] text-slate-500 hover:text-emerald-700 transition"
            >
              Zmień
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-emerald-700 transition border border-dashed border-slate-300 rounded-lg px-2.5 py-1 hover:border-emerald-400"
          >
            📎 Wgraj PDF / zdjęcie
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={onPickFile}
          className="sr-only"
        />
        {pending && <span className="text-[11px] text-slate-400">Zapisuję…</span>}
      </div>

      {error && <div className="text-[11px] text-red-600 pl-9">{error}</div>}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addCertification,
  removeCertification,
  updateCertificationField,
  uploadCertAttachment,
  removeCertAttachment,
} from "./cert-actions";
import type { Certification, CertVerificationStatus } from "@/types";

/**
 * Cert manager rebuilt to match design 28: compact horizontal row
 * (file-type chip · name + meta · status pill · ⋯ expand · trash),
 * "+ Dodaj" inline with the section title, and a drag-drop area at
 * the bottom that creates a new cert seeded from the dropped file.
 *
 * Inline state pattern:
 *   - text + url save on blur (existing server actions)
 *   - delete + remove-attachment use 2-click confirm (no modal)
 *   - per-row "expanded" state reveals the URL input + file picker
 */
export default function CertificationsEditor({ certs }: { certs: Certification[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const dropRef = useRef<HTMLLabelElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  const onAdd = () => {
    startTransition(async () => {
      await addCertification();
      router.refresh();
    });
  };

  // Drag-drop a file → create new cert with filename as initial
  // text → upload the file. Two server-action calls; if upload
  // fails, the cert still exists empty so the trainer can retry
  // via the row's file picker.
  const handleFile = (file: File) => {
    if (!file) return;
    setDropError(null);
    startTransition(async () => {
      const created = await addCertification();
      if ("error" in created || !created.id) {
        setDropError("error" in created ? created.error : "Nie udało się dodać certyfikatu.");
        return;
      }
      const seedName = file.name.replace(/\.(pdf|jpe?g|png|webp)$/i, "");
      // Best-effort: rename text to the file name so the row isn't
      // titled "Nowa certyfikacja…". If it fails, no harm done.
      await updateCertificationField(created.id, "text", seedName);

      const fd = new FormData();
      fd.set("certId", created.id);
      fd.set("file", file);
      const upRes = await uploadCertAttachment(fd);
      if ("error" in upRes) {
        setDropError(upRes.error);
      }
      router.refresh();
    });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-[-0.005em] text-slate-900 m-0">
            Certyfikaty i dokumenty
          </h3>
          <p className="text-[12px] text-slate-500 mt-1 max-w-[640px] leading-[1.55]">
            Przesłane PDF/JPG widoczne tylko po weryfikacji. Klienci widzą tylko nazwę i rok.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={pending}
          className="text-[12.5px] font-semibold text-emerald-700 hover:bg-emerald-50 px-2.5 py-1.5 rounded-[7px] disabled:opacity-50 shrink-0"
        >
          + Dodaj
        </button>
      </div>

      <div className="grid gap-2">
        {certs.length === 0 && (
          <div className="text-[13px] text-slate-500 italic py-2">
            Brak certyfikatów. Dodaj pierwszy używając przycisku wyżej lub przeciągnij plik niżej.
          </div>
        )}
        {certs.map((c, i) => (
          <CertRow key={c.id} cert={c} index={i} />
        ))}
      </div>

      {/* Drop zone — same drag-drop UI from design 28; clicking opens
          the file picker so users without drag-drop habits aren't
          stuck. */}
      <label
        ref={dropRef}
        htmlFor="cert-drop-input"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={
          "mt-3 block rounded-[12px] border-[1.5px] border-dashed text-center px-5 py-5 cursor-pointer transition " +
          (isDragging
            ? "border-emerald-400 bg-emerald-50"
            : "border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/40")
        }
      >
        <div className="text-[12.5px] text-slate-600">
          Przeciągnij PDF/JPG tutaj lub <b className="text-emerald-700">wybierz z dysku</b>. Max 5 MB.
        </div>
        <input
          id="cert-drop-input"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </label>
      {dropError && <div className="text-[11px] text-rose-600 mt-2">{dropError}</div>}
      {pending && <div className="text-[11px] text-slate-400 mt-2">Zapisuję…</div>}

      <div className="text-[12px] text-slate-500 leading-[1.55] mt-3">
        <strong className="text-slate-700">Wskazówka:</strong> link weryfikacyjny prowadzi do publicznego rejestru
        wystawcy (np.{" "}
        <a href="https://www.ereps.eu/" target="_blank" rel="noopener" className="text-emerald-700 underline">
          ereps.eu
        </a>
        , AWF, FMS), gdzie odwiedzający może sam potwierdzić Twój certyfikat.
      </div>
    </div>
  );
}

function CertRow({ cert, index: _index }: { cert: Certification; index: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(cert.text);
  const [url, setUrl] = useState(cert.verificationUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemoveAttachment, setConfirmRemoveAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!confirmDelete) return;
    const id = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(id);
  }, [confirmDelete]);

  useEffect(() => {
    if (!confirmRemoveAttachment) return;
    const id = setTimeout(() => setConfirmRemoveAttachment(false), 3000);
    return () => clearTimeout(id);
  }, [confirmRemoveAttachment]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  const onTextBlur = () => {
    setEditingName(false);
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
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setConfirmDelete(false);
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
    if (!confirmRemoveAttachment) {
      setConfirmRemoveAttachment(true);
      return;
    }
    setConfirmRemoveAttachment(false);
    setError(null);
    startTransition(async () => {
      const res = await removeCertAttachment(cert.id);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  };

  const fileTypeLabel = guessFileType(cert.attachmentFilename, cert.attachmentUrl);
  const meta = buildMetaLine(cert);
  const status = cert.verificationStatus ?? "unverified";

  return (
    <div className="border border-slate-200 rounded-[12px] bg-white overflow-hidden">
      <div className="grid grid-cols-[44px_1fr_auto] gap-3 items-center px-3.5 py-3">
        {/* File-type chip */}
        <div
          className={
            "w-11 h-11 rounded-[10px] flex items-center justify-center text-[11px] font-bold tracking-[0.05em] shrink-0 " +
            chipColor(fileTypeLabel)
          }
        >
          {fileTypeLabel}
        </div>

        {/* Name + meta */}
        <div className="min-w-0">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={onTextBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setText(cert.text);
                  setEditingName(false);
                }
              }}
              maxLength={200}
              className="w-full text-[14px] font-semibold text-slate-900 bg-transparent border-b border-emerald-500 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="block w-full text-left text-[14px] font-semibold text-slate-900 hover:text-emerald-700 truncate"
              title="Kliknij, aby edytować nazwę"
            >
              {text}
            </button>
          )}
          <div className="text-[11.5px] text-slate-500 mt-0.5 truncate">{meta}</div>
        </div>

        {/* Status + actions cluster */}
        <div className="flex items-center gap-2 shrink-0">
          <CompactStatusBadge status={status} />
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            disabled={pending}
            title={expanded ? "Zwiń" : "Edytuj link / plik"}
            className="w-7 h-7 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 inline-flex items-center justify-center"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              className={"transition-transform " + (expanded ? "rotate-90" : "")}
            >
              <circle cx="6" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="18" cy="12" r="1.6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            title={confirmDelete ? "Kliknij ponownie, aby potwierdzić" : "Usuń certyfikat"}
            className={
              "transition shrink-0 inline-flex items-center justify-center rounded-md text-[12px] font-semibold " +
              (confirmDelete
                ? "h-7 px-2.5 bg-rose-600 text-white hover:bg-rose-700 animate-pulse"
                : "w-7 h-7 text-slate-400 hover:text-rose-600")
            }
          >
            {confirmDelete ? (
              "Potwierdź"
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Reject reason banner — always visible (not gated by expansion) */}
      {status === "rejected" && cert.rejectReason && (
        <div className="border-t border-rose-100 bg-rose-50/60 px-3.5 py-2 text-[11.5px] text-rose-700">
          <strong className="font-semibold">Powód odrzucenia:</strong> {cert.rejectReason}
        </div>
      )}

      {/* Expanded — URL field + file controls */}
      {expanded && (
        <div className="border-t border-slate-100 px-3.5 py-3 grid gap-3">
          <div className="grid gap-1.5">
            <label className="text-[11px] font-semibold text-slate-700">Link weryfikacyjny</label>
            <div className="flex gap-2 items-center">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={onUrlBlur}
                placeholder="https://www.ereps.eu/profile/…"
                maxLength={2000}
                className="flex-1 text-[12.5px] text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-slate-300 focus:border-emerald-500 focus:outline-none font-mono"
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

          <div className="flex items-center gap-3 flex-wrap">
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
                  className={
                    "text-[11px] font-medium transition px-2 py-0.5 rounded " +
                    (confirmRemoveAttachment
                      ? "bg-rose-600 text-white animate-pulse"
                      : "text-slate-500 hover:text-rose-600")
                  }
                >
                  {confirmRemoveAttachment ? "Potwierdź" : "Usuń plik"}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pending}
                  className="text-[11px] text-slate-500 hover:text-emerald-700 transition"
                >
                  Zmień plik
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

          {error && <div className="text-[11px] text-rose-600">{error}</div>}
        </div>
      )}
    </div>
  );
}

/** "PDF" / "JPG" / "CERT" — based on attachment filename or URL ext. */
function guessFileType(filename?: string, url?: string): "PDF" | "JPG" | "PNG" | "CERT" {
  const src = (filename ?? url ?? "").toLowerCase();
  if (src.endsWith(".pdf")) return "PDF";
  if (src.endsWith(".jpg") || src.endsWith(".jpeg")) return "JPG";
  if (src.endsWith(".png")) return "PNG";
  if (src.endsWith(".webp")) return "JPG";
  return "CERT";
}

function chipColor(t: "PDF" | "JPG" | "PNG" | "CERT"): string {
  if (t === "PDF") return "bg-amber-100 text-amber-800";
  if (t === "JPG" || t === "PNG") return "bg-sky-100 text-sky-800";
  return "bg-slate-100 text-slate-500";
}

/**
 * Meta line under the cert name. Tries year (parsed from cert text)
 * + filename or URL host. Pre-028 / no-evidence → nudge to attach.
 */
function buildMetaLine(cert: Certification): string {
  const year = (cert.text.match(/(?:^|[\s—·,(\-])(20\d{2})(?:[\s,)\-]|$)/) ?? [])[1];
  const parts: string[] = [];
  if (year) parts.push(year);
  if (cert.attachmentFilename) {
    parts.push(cert.attachmentFilename);
  } else if (cert.verificationUrl) {
    try {
      const h = new URL(cert.verificationUrl).hostname.replace(/^www\./, "");
      parts.push(h);
    } catch {
      parts.push("Link weryfikacyjny");
    }
  } else {
    parts.push("brak dowodu — dodaj link lub plik");
  }
  return parts.join(" · ");
}

function CompactStatusBadge({ status }: { status: CertVerificationStatus | undefined }) {
  const map = {
    unverified: { label: "Brak dowodów", classes: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400", pulse: false },
    pending: { label: "Oczekuje weryfikacji", classes: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500", pulse: true },
    verified: { label: "Zweryfikowany", classes: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", pulse: false },
    rejected: { label: "Odrzucony", classes: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500", pulse: false },
  } as const;
  const v = map[status ?? "unverified"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border whitespace-nowrap ${v.classes}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${v.dot} ${v.pulse ? "animate-pulse" : ""}`} />
      {v.label}
    </span>
  );
}

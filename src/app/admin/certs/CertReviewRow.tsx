"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { approveCert, rejectCert, reopenCert } from "./actions";

type Cert = {
  id: string;
  text: string;
  verificationUrl: string | null;
  attachmentUrl: string | null;
  attachmentFilename: string | null;
  status: "unverified" | "pending" | "verified" | "rejected";
  rejectReason: string | null;
  createdAt: string;
  trainerName: string;
  trainerSlug: string;
  trainerAvatar: string | null;
};

export default function CertReviewRow({ cert }: { cert: Cert }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  const onApprove = () => {
    setError(null);
    startTransition(async () => {
      const res = await approveCert(cert.id);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  };

  const onReject = () => {
    if (!reason.trim()) {
      setError("Podaj powód odrzucenia.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await rejectCert(cert.id, reason);
      if ("error" in res) {
        setError(res.error);
      } else {
        setShowReject(false);
        setReason("");
        router.refresh();
      }
    });
  };

  const onReopen = () => {
    if (!confirm("Przywrócić do kolejki oczekujących?")) return;
    setError(null);
    startTransition(async () => {
      const res = await reopenCert(cert.id);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  };

  const evidence = cert.verificationUrl || cert.attachmentUrl;
  const dateStr = new Date(cert.createdAt).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      {/* Trainer header */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
        <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden shrink-0">
          {cert.trainerAvatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cert.trainerAvatar} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-slate-900 truncate">{cert.trainerName}</div>
          <div className="text-[11.5px] text-slate-500">
            {cert.trainerSlug && (
              <>
                <Link
                  href={`/trainers/${cert.trainerSlug}`}
                  target="_blank"
                  className="text-emerald-700 hover:underline"
                >
                  /trainers/{cert.trainerSlug}
                </Link>
                {" · "}
              </>
            )}
            dodano {dateStr}
          </div>
        </div>
        <StatusPill status={cert.status} />
      </div>

      {/* Cert text */}
      <div className="text-[15px] text-slate-900 font-medium mb-3 leading-[1.5]">{cert.text}</div>

      {/* Evidence */}
      <div className="space-y-1.5 mb-4">
        {cert.verificationUrl ? (
          <a
            href={cert.verificationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] text-emerald-700 hover:underline font-mono break-all"
          >
            ↗ {cert.verificationUrl}
          </a>
        ) : (
          <div className="text-[12px] text-slate-400 italic">Brak linku weryfikacyjnego</div>
        )}
        {cert.attachmentUrl ? (
          <a
            href={cert.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] text-emerald-700 hover:underline"
          >
            📎 {cert.attachmentFilename ?? "Załącznik"}
          </a>
        ) : (
          <div className="text-[12px] text-slate-400 italic">Brak załącznika</div>
        )}
      </div>

      {cert.status === "rejected" && cert.rejectReason && (
        <div className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-4">
          <strong className="font-semibold">Powód odrzucenia:</strong> {cert.rejectReason}
        </div>
      )}

      {/* Actions */}
      {!evidence ? (
        <div className="text-[12px] text-slate-500 italic">
          Trener nie dodał jeszcze żadnych dowodów — nie ma czego weryfikować.
        </div>
      ) : cert.status === "pending" ? (
        showReject ? (
          <div className="space-y-2">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Powód odrzucenia (zobaczy go trener)…"
              className="w-full text-[13px] border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/15"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onReject}
                disabled={pending || !reason.trim()}
                className="text-[13px] font-semibold px-3.5 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Potwierdź odrzucenie
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReject(false);
                  setReason("");
                  setError(null);
                }}
                disabled={pending}
                className="text-[13px] font-medium px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                Anuluj
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onApprove}
              disabled={pending}
              className="text-[13px] font-semibold px-3.5 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Zatwierdź
            </button>
            <button
              type="button"
              onClick={() => setShowReject(true)}
              disabled={pending}
              className="text-[13px] font-medium px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              Odrzuć z powodem
            </button>
          </div>
        )
      ) : (
        <button
          type="button"
          onClick={onReopen}
          disabled={pending}
          className="text-[12.5px] font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
        >
          ↻ Przywróć do kolejki
        </button>
      )}

      {error && <div className="text-[12px] text-rose-600 mt-2">{error}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: Cert["status"] }) {
  const map = {
    unverified: { label: "Bez dowodów", classes: "bg-slate-50 text-slate-500 border-slate-200" },
    pending: { label: "Oczekuje", classes: "bg-amber-50 text-amber-700 border-amber-200" },
    verified: { label: "Zatwierdzony", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { label: "Odrzucony", classes: "bg-rose-50 text-rose-700 border-rose-200" },
  } as const;
  const v = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border whitespace-nowrap ${v.classes}`}
    >
      {v.label}
    </span>
  );
}

"use client";

import { useState, useTransition } from "react";
import {
  acceptReschedule,
  declineReschedule,
  cancelReschedule,
} from "@/lib/actions/reschedule";

const PL_DAY_SHORT = ["Nie", "Pn", "Wt", "Śr", "Cz", "Pt", "Sob"];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

export type RescheduleCardProps = {
  request: {
    id: string;
    status: "pending" | "accepted" | "declined" | "cancelled";
    proposedStart: string;
    proposedEnd: string;
    previousStart: string;
    serviceName: string | null;
    packageName: string | null;
    reason: string | null;
    requestedBy: string;
  };
  /** True if the current user is the one who PROPOSED this reschedule. */
  isRequester: boolean;
  /** Visual side: requester's card aligns right (own message), other party's aligns left. */
  side: "me" | "them";
};

const STATUS_LABEL = {
  accepted: "Zaakceptowano",
  declined: "Odrzucono",
  cancelled: "Anulowano",
} as const;

export default function RescheduleCard({ request, isRequester, side }: RescheduleCardProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const d = new Date(request.proposedStart);
  const what = request.serviceName ?? request.packageName ?? "Sesja";
  const previousLabel = `było ${fmtTime(request.previousStart)}`;
  const durationMin = Math.round(
    (new Date(request.proposedEnd).getTime() - new Date(request.proposedStart).getTime()) / 60_000,
  );

  const isPending = request.status === "pending";
  const accentColor =
    request.status === "accepted"
      ? "from-emerald-50 border-emerald-300"
      : request.status === "declined"
        ? "from-rose-50 border-rose-200"
        : request.status === "cancelled"
          ? "from-slate-50 border-slate-200"
          : "from-emerald-50 border-emerald-200";

  const onAccept = () => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await acceptReschedule(request.id);
      if ("error" in res) setError(res.error);
    });
  };
  const onDecline = () => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await declineReschedule(request.id);
      if ("error" in res) setError(res.error);
    });
  };
  const onCancel = () => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await cancelReschedule(request.id);
      if ("error" in res) setError(res.error);
    });
  };

  return (
    <div className={`flex ${side === "me" ? "justify-end" : "justify-start"} mt-2`}>
      <div
        className={`max-w-[86%] rounded-[18px] border p-3.5 bg-gradient-to-br to-white ${accentColor}`}
      >
        <div className="grid grid-cols-[56px_1fr] gap-3 items-center">
          {/* Date tile */}
          <div className="bg-white border border-emerald-200 rounded-[10px] text-center py-1.5">
            <div className="text-[9px] uppercase font-bold tracking-wider text-emerald-700">
              {PL_DAY_SHORT[d.getDay()]} {d.getDate()}
            </div>
            <div className="text-[22px] font-bold tracking-[-0.02em] leading-tight my-0.5 text-slate-900">
              {d.getDate()}
            </div>
            <div className="text-[10px] text-slate-700 font-semibold">{fmtTime(request.proposedStart)}</div>
          </div>
          {/* Info */}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">
              Zmiana terminu
            </div>
            <div className="text-[13px] font-semibold mt-0.5 truncate">{what}</div>
            <div className="text-[11.5px] text-slate-600 mt-0.5 truncate">
              {durationMin} min · {previousLabel}
            </div>
            {request.reason && (
              <div className="text-[11.5px] text-slate-600 italic mt-1 line-clamp-2">
                &ldquo;{request.reason}&rdquo;
              </div>
            )}
          </div>
        </div>

        {/* CTAs / status row */}
        {isPending ? (
          isRequester ? (
            <div className="mt-2.5 flex justify-between items-center gap-2">
              <span className="text-[11.5px] text-slate-600">Czeka na decyzję drugiej strony</span>
              <button
                type="button"
                onClick={onCancel}
                disabled={pending}
                className="text-[11.5px] font-medium text-slate-600 hover:text-slate-900 transition disabled:opacity-50"
              >
                Wycofaj
              </button>
            </div>
          ) : (
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={onDecline}
                disabled={pending}
                className="px-2 py-2 rounded-[8px] text-[12px] font-medium bg-white border border-slate-200 text-slate-700 hover:border-slate-400 transition disabled:opacity-50"
              >
                Odrzuć
              </button>
              <button
                type="button"
                onClick={onAccept}
                disabled={pending}
                className="px-2 py-2 rounded-[8px] text-[12px] font-semibold bg-slate-900 text-white hover:bg-black transition disabled:opacity-50"
              >
                Akceptuję ✓
              </button>
            </div>
          )
        ) : (
          <div
            className={`mt-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-semibold ${
              request.status === "accepted"
                ? "text-emerald-700"
                : request.status === "declined"
                  ? "text-rose-700"
                  : "text-slate-600"
            }`}
          >
            {request.status === "accepted" && "✓ "}
            {request.status === "declined" && "✗ "}
            {request.status !== "pending" ? STATUS_LABEL[request.status] : null}
          </div>
        )}

        {error && <p className="mt-2 text-[11.5px] text-red-600">{error}</p>}
      </div>
    </div>
  );
}

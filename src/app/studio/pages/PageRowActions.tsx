"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPrimaryPage, setPageStatus, deleteTrainerPage } from "./actions";

/**
 * Per-row dropdown of actions on a trainer page: promote to primary,
 * publish/unpublish, delete (non-primary only). Three small buttons that
 * dispatch server actions and refresh the list on success.
 */
export default function PageRowActions({
  pageId,
  isPrimary,
  isPublished,
}: {
  pageId: string;
  isPrimary: boolean;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onPromote = () => {
    if (isPrimary) return;
    if (!confirm("Ustawić tę stronę jako główną? Klienci pod nazdrow.pl/trainers/twoj-slug zobaczą tę wersję.")) return;
    startTransition(async () => {
      const res = await setPrimaryPage(pageId);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  };

  const onTogglePublish = () => {
    startTransition(async () => {
      const res = await setPageStatus(pageId, isPublished ? "draft" : "published");
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  };

  const onDelete = () => {
    if (isPrimary) {
      alert("Nie można usunąć głównej strony. Najpierw promuj inną stronę jako główną.");
      return;
    }
    if (!confirm("Usunąć tę stronę? Tej akcji nie można cofnąć.")) return;
    startTransition(async () => {
      const res = await deleteTrainerPage(pageId);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      {!isPrimary && (
        <button
          type="button"
          onClick={onPromote}
          disabled={pending}
          title="Ustaw jako główną"
          className="inline-flex items-center justify-center h-9 px-3 rounded-full text-[12px] font-medium text-emerald-700 border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400 transition disabled:opacity-60"
        >
          ★ Główna
        </button>
      )}
      <button
        type="button"
        onClick={onTogglePublish}
        disabled={pending}
        className={`inline-flex items-center justify-center h-9 px-3 rounded-full text-[12px] font-medium border transition disabled:opacity-60 ${
          isPublished
            ? "text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
            : "text-white bg-slate-900 border-slate-900 hover:bg-black"
        }`}
      >
        {isPublished ? "Cofnij publikację" : "Publikuj"}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending || isPrimary}
        title={isPrimary ? "Nie można usunąć głównej strony" : "Usuń stronę"}
        className="inline-flex items-center justify-center h-9 w-9 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:cursor-not-allowed"
      >
        🗑
      </button>
    </div>
  );
}

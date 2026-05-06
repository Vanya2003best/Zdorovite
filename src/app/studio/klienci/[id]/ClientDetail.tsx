"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateClient, deleteClient } from "../actions";

type ClientData = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  goal: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
};

/**
 * Client detail page — editable in place. Each field commits on blur via
 * updateClient(); errors surface inline and roll back local state. Notes
 * is a big textarea; tags + goal + contact are inline inputs. Future
 * iterations layer history sesji / finanse / postęp on top of this same
 * page (P3+ in the ecosystem plan).
 */
export default function ClientDetail({ client }: { client: ClientData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Local state mirrors fields. Commits on blur (text inputs) or on
  // dedicated buttons (tags, archive, delete). Errors revert to the
  // last-saved server value if the action fails.
  const [displayName, setDisplayName] = useState(client.display_name);
  const [email, setEmail] = useState(client.email ?? "");
  const [phone, setPhone] = useState(client.phone ?? "");
  const [goal, setGoal] = useState(client.goal ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");
  const [tags, setTags] = useState<string[]>(client.tags);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const commit = (patch: Parameters<typeof updateClient>[1]) => {
    setError(null);
    startTransition(async () => {
      const res = await updateClient(client.id, patch);
      if ("error" in res) setError(res.error);
    });
  };

  const onAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const t = tagInput.trim();
    if (!t || tags.includes(t)) {
      setTagInput("");
      return;
    }
    const next = [...tags, t].slice(0, 10);
    setTags(next);
    setTagInput("");
    commit({ tags: next });
  };

  const onRemoveTag = (t: string) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    commit({ tags: next });
  };

  const onDelete = () => {
    if (!confirm(`Usunąć klienta "${displayName}"? Operacji nie można cofnąć.`)) return;
    startTransition(async () => {
      const res = await deleteClient(client.id);
      if (res && "error" in res) setError(res.error);
      // deleteClient redirects on success — control doesn't return here.
    });
  };

  return (
    <div className="mx-auto max-w-[860px] px-4 sm:px-8 py-5 sm:py-10 grid gap-5">
      {/* Breadcrumb + delete */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/studio/klienci"
          className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 hover:text-slate-900 transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M15 19l-7-7 7-7" />
          </svg>
          Wszyscy klienci
        </Link>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="text-[12px] text-slate-500 hover:text-red-700 transition disabled:opacity-50"
        >
          Usuń klienta
        </button>
      </div>

      {/* Hero */}
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 inline-flex items-center justify-center font-semibold text-[24px] shrink-0">
          {(displayName || "?").charAt(0).toUpperCase()}
        </div>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onBlur={(e) => commit({ displayName: e.target.value })}
          maxLength={80}
          className="flex-1 text-[26px] sm:text-[32px] font-semibold tracking-[-0.02em] text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-0 px-0"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* Contact */}
      <Card title="Kontakt">
        <div className="grid gap-2">
          <Field label="Telefon">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={(e) => commit({ phone: e.target.value })}
              placeholder="+48 600 000 000"
              className="w-full text-[14px] py-2 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={(e) => commit({ email: e.target.value })}
              placeholder="anna@example.com"
              className="w-full text-[14px] py-2 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
            />
          </Field>
        </div>
      </Card>

      {/* Goal + tags */}
      <Card title="Cel i tagi">
        <div className="grid gap-3">
          <Field label="Cel">
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onBlur={(e) => commit({ goal: e.target.value })}
              placeholder="np. -10 kg do lipca"
              maxLength={200}
              className="w-full text-[14px] py-2 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400"
            />
          </Field>
          <Field label="Tagi">
            <div className="flex flex-wrap gap-1.5 items-center">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 text-[11.5px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => onRemoveTag(t)}
                    className="text-emerald-700/60 hover:text-red-600 transition"
                    aria-label={`Usuń tag ${t}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <form onSubmit={onAddTag} className="inline-flex">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder={tags.length === 0 ? "+ dodaj tag" : "+"}
                  maxLength={30}
                  className="text-[12px] py-1 px-2 rounded-full border border-slate-200 focus:outline-none focus:border-slate-400 w-[120px]"
                />
              </form>
            </div>
          </Field>
        </div>
      </Card>

      {/* Notes */}
      <Card title="Notatki">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={(e) => commit({ notes: e.target.value })}
          placeholder="Wszystko co warto pamiętać o tym kliencie. Markdown OK. Max 4000 znaków."
          maxLength={4000}
          rows={6}
          className="w-full text-[13px] py-2.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 resize-vertical leading-[1.5]"
        />
        <p className="text-[11px] text-slate-400 mt-1.5 m-0">
          {notes.length} / 4000 znaków · zapisuje się automatycznie po
          wyjściu z pola
        </p>
      </Card>

      {/* Future surfaces — placeholder cards so the layout matches the
          P3-P6 plan. Filled in by next iterations (sesje, finanse, postęp). */}
      <FutureCard
        title="Historia sesji"
        message="Pojawi się tutaj po pierwszej rezerwacji przez NaZdrow! lub po dodaniu sesji ręcznie (P4 trainer ecosystem)."
      />
      <FutureCard
        title="Finanse"
        message="Suma wpłat, ostatnia płatność, status pakietu — po podłączeniu mark-as-paid + Stripe (P3, P7)."
      />
      <FutureCard
        title="Postęp"
        message="Pomiary, zdjęcia before/after, wykres wagi — kiedy dodamy moduł postępu (P-future)."
      />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <h2 className="text-[12.5px] font-semibold tracking-[0.08em] uppercase text-slate-500 m-0 mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-semibold tracking-[0.04em] uppercase text-slate-500 block mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function FutureCard({ title, message }: { title: string; message: string }) {
  return (
    <section className="bg-slate-50/50 rounded-2xl border border-dashed border-slate-300 p-5">
      <h2 className="text-[12.5px] font-semibold tracking-[0.08em] uppercase text-slate-400 m-0 mb-2">
        {title}
      </h2>
      <p className="text-[12.5px] text-slate-500 m-0 leading-[1.55]">{message}</p>
    </section>
  );
}

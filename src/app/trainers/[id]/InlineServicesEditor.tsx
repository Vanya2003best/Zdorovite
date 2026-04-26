"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addService, removeService, updateServiceField } from "./service-actions";

type Service = {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
};

export default function InlineServicesEditor({ services }: { services: Service[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onAdd = () => {
    startTransition(async () => {
      await addService();
      router.refresh();
    });
  };

  return (
    <div className="grid sm:grid-cols-2 gap-3.5">
      {services.map((svc) => (
        <ServiceCard key={svc.id} service={svc} />
      ))}

      {/* Add button card */}
      <button
        type="button"
        onClick={onAdd}
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-emerald-300 bg-emerald-50/30 p-5 text-emerald-700 font-medium hover:border-emerald-500 hover:bg-emerald-50/60 transition disabled:opacity-60 min-h-[180px]"
      >
        <span className="text-2xl">+</span>
        {pending ? "Dodaję..." : "Dodaj usługę"}
      </button>
    </div>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onDelete = () => {
    if (!confirm(`Usunąć usługę "${service.name}"?`)) return;
    startTransition(async () => {
      await removeService(service.id);
      router.refresh();
    });
  };

  return (
    <div className="group relative bg-white/80 backdrop-blur-sm border border-white/70 rounded-[18px] p-5 sm:p-5.5 shadow-sm flex flex-col gap-2.5">
      {/* Delete button — visible on hover */}
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        title="Usuń usługę"
        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 inline-flex items-center justify-center opacity-0 group-hover:opacity-100 hover:text-red-600 hover:border-red-300 transition disabled:opacity-60"
      >
        🗑
      </button>

      <div className="flex justify-between items-baseline gap-3 pr-8">
        <div className="text-[17px] font-semibold tracking-tight flex-1">
          <EditableServiceField
            serviceId={service.id}
            field="name"
            initial={service.name}
          />
        </div>
        <div className="text-base font-semibold text-emerald-700 whitespace-nowrap">
          <EditableServiceField
            serviceId={service.id}
            field="price"
            initial={String(service.price)}
            type="number"
            suffix=" zł"
            className="w-16 text-right"
          />
        </div>
      </div>
      <div className="text-sm text-slate-600 leading-snug min-h-[40px]">
        <EditableServiceField
          serviceId={service.id}
          field="description"
          initial={service.description}
          multiline
          placeholder="Dodaj opis..."
        />
      </div>
      <div className="flex gap-3.5 text-xs text-slate-500 mt-auto pt-2.5 border-t border-slate-200">
        <span className="inline-flex items-center gap-1">
          ⏱{" "}
          <EditableServiceField
            serviceId={service.id}
            field="duration"
            initial={String(service.duration)}
            type="number"
            suffix=" min"
            className="w-12 text-right"
          />
        </span>
        <span className="inline-flex items-center gap-1">📍 Sala</span>
      </div>
    </div>
  );
}

function EditableServiceField({
  serviceId,
  field,
  initial,
  multiline = false,
  type = "text",
  placeholder,
  className = "",
  suffix,
}: {
  serviceId: string;
  field: "name" | "description" | "duration" | "price";
  initial: string;
  multiline?: boolean;
  type?: "text" | "number";
  placeholder?: string;
  className?: string;
  suffix?: string;
}) {
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const commit = () => {
    if (value.trim() === initial.trim()) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await updateServiceField(serviceId, field, value);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setError(null);
      setEditing(false);
      router.refresh();
    });
  };

  const cancel = () => {
    setValue(initial);
    setEditing(false);
    setError(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") cancel();
    else if (!multiline && e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (multiline && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commit();
    }
  };

  if (editing) {
    const commonProps = {
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(e.target.value),
      onBlur: commit,
      onKeyDown,
      autoFocus: true,
      disabled: pending,
    };
    return (
      <span className="relative inline-block">
        {multiline ? (
          <textarea
            {...commonProps}
            rows={Math.max(2, value.split("\n").length)}
            className={`${className} bg-emerald-50/40 border-2 border-emerald-400 rounded-lg p-1.5 outline-none block w-full text-inherit font-inherit resize-vertical`}
          />
        ) : (
          <input
            type={type}
            {...commonProps}
            className={`${className} bg-emerald-50/40 border-2 border-emerald-400 rounded px-1.5 py-0.5 outline-none text-inherit font-inherit`}
          />
        )}
        {error && (
          <div className="absolute left-0 -bottom-5 text-[11px] text-red-600 whitespace-nowrap">{error}</div>
        )}
      </span>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`${className} cursor-text rounded hover:bg-emerald-50/50 hover:outline hover:outline-2 hover:outline-emerald-300 transition inline-block`}
      title="Kliknij, aby edytować"
    >
      {value || <span className="text-slate-400 italic text-[13px]">{placeholder ?? "—"}</span>}
      {suffix}
    </span>
  );
}

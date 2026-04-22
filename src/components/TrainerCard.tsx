"use client";

import Link from "next/link";
import { Trainer } from "@/types";
import { getSpecLabel } from "@/data/specializations";

const coverImages: Record<string, string> = {
  "anna-kowalska": "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=800&h=600&fit=crop",
  "marek-nowak": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&h=600&fit=crop",
  "katarzyna-zielinska": "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&h=600&fit=crop",
  "jakub-wisniewski": "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&h=600&fit=crop",
  "ewa-dabrowska": "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?w=800&h=600&fit=crop",
  "tomasz-kaczmarek": "https://images.unsplash.com/photo-1579758629938-03607ccdbaba?w=800&h=600&fit=crop",
};

export default function TrainerCard({ trainer }: { trainer: Trainer }) {
  const cover = coverImages[trainer.id] ?? "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop";

  return (
    <Link
      href={`/trainers/${trainer.id}`}
      className="group block bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-12px_rgba(16,185,129,0.25)] hover:border-emerald-400"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={cover}
          alt={trainer.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {/* Rating badge */}
        <span className="absolute top-3 left-3 bg-white/94 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
          {trainer.rating} · {trainer.reviewCount}
        </span>
        {/* Favorite */}
        <button
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/94 backdrop-blur-md inline-flex items-center justify-center text-slate-700 hover:text-red-500 transition"
          onClick={(e) => e.preventDefault()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" /></svg>
        </button>
        {/* Verified */}
        <span className="absolute bottom-3 left-3 bg-white border border-slate-200 px-2.5 py-1 rounded-full text-[11px] font-medium text-emerald-700 inline-flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
          Zweryfikowany
        </span>
      </div>

      {/* Body */}
      <div className="p-4.5 sm:p-5 grid gap-2.5">
        <div className="flex justify-between items-baseline">
          <div className="text-base font-semibold text-slate-900 tracking-tight">{trainer.name}</div>
          <div className="text-xs text-slate-500">{trainer.experience} lat</div>
        </div>
        <div className="text-[13px] text-slate-500 inline-flex items-center gap-1">
          📍 {trainer.location}
        </div>
        <div className="text-sm text-slate-700 leading-relaxed line-clamp-2">
          {trainer.tagline}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {trainer.specializations.slice(0, 3).map((spec) => (
            <span key={spec} className="text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
              {getSpecLabel(spec)}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-3.5 mt-1">
          <div className="text-[15px] font-semibold text-slate-900">
            od {trainer.priceFrom} zł <span className="text-xs text-slate-500 font-normal">/ sesja</span>
          </div>
          <span className="px-3.5 py-2 rounded-lg text-[13px] font-medium bg-slate-900 text-white group-hover:bg-emerald-500 transition-colors">
            Zobacz profil
          </span>
        </div>
      </div>
    </Link>
  );
}

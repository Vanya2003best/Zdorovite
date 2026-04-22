import Link from "next/link";
import Image from "next/image";
import { Trainer } from "@/types";
import { getSpecLabel, getSpecIcon } from "@/data/specializations";
import StarRating from "./StarRating";

export default function TrainerCard({ trainer }: { trainer: Trainer }) {
  return (
    <Link
      href={`/trainers/${trainer.id}`}
      className="group block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-lg hover:border-emerald-300"
    >
      <div className="flex gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          <Image
            src={trainer.avatar}
            alt={trainer.name}
            fill
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
            {trainer.name}
          </h3>
          <p className="mt-0.5 text-sm text-gray-500">
            {trainer.location} &middot; {trainer.experience} lat doświadczenia
          </p>
          <div className="mt-1 flex items-center gap-2">
            <StarRating rating={trainer.rating} size="sm" />
            <span className="text-sm font-medium text-gray-700">
              {trainer.rating}
            </span>
            <span className="text-sm text-gray-400">
              ({trainer.reviewCount} opinii)
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm text-gray-600 line-clamp-2">
        {trainer.tagline}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {trainer.specializations.map((spec) => (
          <span
            key={spec}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
          >
            <span>{getSpecIcon(spec)}</span>
            {getSpecLabel(spec)}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-gray-500">
          od{" "}
          <span className="text-lg font-bold text-gray-900">
            {trainer.priceFrom} zł
          </span>{" "}
          / sesja
        </span>
        <span className="text-sm font-medium text-emerald-600 group-hover:text-emerald-700">
          Zobacz profil &rarr;
        </span>
      </div>
    </Link>
  );
}

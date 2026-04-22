import { Review } from "@/types";
import StarRating from "./StarRating";

export default function ReviewCard({ review }: { review: Review }) {
  const dateFormatted = new Date(review.date).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
            {review.authorName.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-gray-900">{review.authorName}</p>
            <p className="text-xs text-gray-500">{dateFormatted}</p>
          </div>
        </div>
        <StarRating rating={review.rating} size="sm" />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        {review.text}
      </p>
    </div>
  );
}

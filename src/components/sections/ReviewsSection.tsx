import { Review } from "@/types";
import { TemplateStyles } from "@/data/templates";
import StarRating from "@/components/StarRating";

interface Props {
  reviews: Review[];
  styles: TemplateStyles;
  accentColor: string;
}

export default function ReviewsSection({ reviews, styles: s, accentColor }: Props) {
  return (
    <section>
      <h2 className={`text-xl font-bold ${s.headingColor}`}>
        Opinie ({reviews.length})
      </h2>
      <div className="mt-4 space-y-4">
        {reviews.map((review) => {
          const dateFormatted = new Date(review.date).toLocaleDateString(
            "pl-PL",
            { year: "numeric", month: "long", day: "numeric" }
          );
          return (
            <div
              key={review.id}
              className={`${s.rounded} ${s.cardBg} ${s.cardBorder} ${s.cardShadow} p-5`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    {review.authorName.charAt(0)}
                  </div>
                  <div>
                    <p className={`font-medium ${s.headingColor}`}>
                      {review.authorName}
                    </p>
                    <p className={`text-xs ${s.mutedColor}`}>{dateFormatted}</p>
                  </div>
                </div>
                <StarRating rating={review.rating} size="sm" />
              </div>
              <p className={`mt-3 text-sm leading-relaxed ${s.textColor}`}>
                {review.text}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

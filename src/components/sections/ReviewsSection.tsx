import { Review } from "@/types";
import { TemplateStyles } from "@/data/templates";

interface Props {
  reviews: Review[];
  styles: TemplateStyles;
}

export default function ReviewsSection({ reviews, styles: s }: Props) {
  return (
    <section className={`${s.sectionPadding} ${s.sectionBorder}`}>
      <div className={s.sectionTitleStyle}>
        {s.name === "cozy" ? "Co mówią klienci" : "Opinie"}
      </div>
      <div>
        {reviews.map((review) => {
          const dateFormatted =
            s.name === "sport"
              ? new Date(review.date).toLocaleDateString("pl-PL", {
                  day: "2-digit",
                  month: "2-digit",
                })
              : new Date(review.date).toLocaleDateString("pl-PL", {
                  day: "numeric",
                  month: "long",
                });
          return (
            <div key={review.id} className={s.revCardStyle}>
              <div className="flex justify-between items-center">
                <span className={s.revNameStyle}>{review.authorName}</span>
                <span className={s.revDateStyle}>{dateFormatted}</span>
              </div>
              <div className={s.revStarsStyle}>★★★★★</div>
              <p className={`mt-1 ${s.revTextStyle}`}>{review.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function StarRating({
  rating,
  size = "md",
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = { sm: "text-sm", md: "text-lg", lg: "text-2xl" }[size];
  const stars = [];

  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      stars.push(<span key={i} className="text-amber-400">&#9733;</span>);
    } else if (i - rating < 1) {
      stars.push(<span key={i} className="text-amber-400">&#9733;</span>);
    } else {
      stars.push(<span key={i} className="text-gray-300">&#9733;</span>);
    }
  }

  return <span className={`inline-flex gap-0.5 ${sizeClass}`}>{stars}</span>;
}

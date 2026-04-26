export default function SuccessRing({ size = 72 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 shadow-[0_0_0_12px_rgba(16,185,129,0.06)]"
      style={{ width: size, height: size }}
    >
      {/* Concentric soft rings */}
      <span className="absolute -inset-4 rounded-full border border-emerald-300/35" />
      <span className="absolute -inset-7 rounded-full border border-emerald-300/15" />
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </span>
  );
}

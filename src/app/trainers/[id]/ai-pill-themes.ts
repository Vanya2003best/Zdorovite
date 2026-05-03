// Per-template Tailwind class presets for the collapsed "✨ AI" trigger
// pill that sits above each section. The expanded panel itself stays
// violet across all templates — that's an editor-mode UI affordance, not
// part of the public design language. Only the collapsed pill bleeds onto
// the trainer's page surface, so it gets template-themed.
//
// Each value is a single string of Tailwind utilities suitable for the
// `pillClassName` prop on SectionAITextButton / Services / Packages.

export const AI_PILL_THEMES = {
  // Premium — emerald/glass to match the template's accent.
  premium:
    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition text-[12.5px] font-medium",

  // Cozy — peach/orange to fit the warm-cream backdrop.
  cozy:
    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 hover:border-orange-300 transition text-[12.5px] font-medium",

  // Studio — orange accent on white, sharp.
  studio:
    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#ffeadb] border border-[#ff5722]/30 text-[#ff5722] hover:border-[#ff5722] hover:bg-[#ffd6bd] transition text-[12.5px] font-medium",

  // Cinematic — dark page bg, lime accent.
  cinematic:
    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#d4ff00]/10 border border-[#d4ff00]/30 text-[#d4ff00] hover:bg-[#d4ff00]/20 hover:border-[#d4ff00]/50 transition text-[12px] font-mono uppercase tracking-[0.12em]",

  // Luxury — cream + bronze, editorial.
  luxury:
    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#fbf8f1] border border-[#d9cfb8] text-[#8a7346] hover:bg-[#efe7d7] hover:border-[#8a7346] transition text-[12px] font-serif italic tracking-[0.02em]",

  // Signature — burgundy on cream, fashion-mag look.
  signature:
    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#f1e3e3] border border-[#7d1f1f]/20 text-[#7d1f1f] hover:bg-[#7d1f1f] hover:text-white hover:border-[#7d1f1f] transition text-[12px] font-mono uppercase tracking-[0.15em]",
} as const;

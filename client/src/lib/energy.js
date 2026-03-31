export const ENERGY_MODE_OPTIONS = [
  {
    id: "auto",
    label: "Auto Balance",
    hint: "Route by difficulty",
    activeClass: "border-[#e7cf97] bg-[linear-gradient(180deg,#fbf0d3_0%,#efddab_100%)] text-[#6f5821] shadow-[0_22px_44px_-34px_rgba(111,88,33,0.28)]",
    idleClass: "border-[#d6ddd0] bg-white/76 text-[#7f6630] hover:bg-[#fff9ef]",
    chipClass: "border-[#e7d4a2] bg-[#fbf1d8] text-[#7b6228]"
  },
  {
    id: "fast",
    label: "Low Energy",
    hint: "Fast and efficient",
    activeClass: "border-[#c7dfcd] bg-[linear-gradient(180deg,#eff9f1_0%,#ddefe1_100%)] text-[#2e6d4d] shadow-[0_22px_44px_-34px_rgba(46,109,77,0.24)]",
    idleClass: "border-[#d6ddd0] bg-white/76 text-[#3f7258] hover:bg-[#f5fbf6]",
    chipClass: "border-[#cfe5d4] bg-[#eef8f0] text-[#2f6d4d]"
  },
  {
    id: "deep",
    label: "High Energy",
    hint: "Deep reasoning",
    activeClass: "border-[#edd0c7] bg-[linear-gradient(180deg,#fff2ed_0%,#f6ddd5_100%)] text-[#96503f] shadow-[0_22px_44px_-34px_rgba(150,80,63,0.24)]",
    idleClass: "border-[#d6ddd0] bg-white/76 text-[#9a5d4c] hover:bg-[#fff3ef]",
    chipClass: "border-[#edd7d0] bg-[#fff2ee] text-[#995949]"
  }
];

const ENERGY_BY_KEY = Object.fromEntries(ENERGY_MODE_OPTIONS.map((option) => [option.id, option]));

function titleCase(value) {
  return String(value || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function energyKeyFromMeta(meta = {}) {
  if (meta.energyMode === "auto" || meta.role === "router") {
    return "auto";
  }
  if (meta.energyMode === "high" || meta.role === "deep") {
    return "deep";
  }
  if (meta.energyMode === "low" || meta.role === "fast") {
    return "fast";
  }

  const model = String(meta.model || "").toLowerCase();
  if (model.includes("high") || model.includes("deep")) {
    return "deep";
  }
  if (model.includes("low") || model.includes("fast")) {
    return "fast";
  }
  return "auto";
}

export function energyLabelFromMeta(meta = {}) {
  return ENERGY_BY_KEY[energyKeyFromMeta(meta)]?.label || "Auto Balance";
}

export function energyOptionById(id) {
  return ENERGY_BY_KEY[id] || ENERGY_BY_KEY.auto;
}

export function modelDisplayName(model) {
  const cleaned = String(model || "")
    .replace(/-(mock|own)$/i, "")
    .trim();

  if (!cleaned) {
    return "Unknown Model";
  }
  if (/router/i.test(cleaned)) {
    return "Energy Router";
  }
  if (/(high|deep)/i.test(cleaned)) {
    return "Energy AI High-Energy";
  }
  if (/(low|fast)/i.test(cleaned)) {
    return "Energy AI Low-Energy";
  }
  return titleCase(cleaned);
}

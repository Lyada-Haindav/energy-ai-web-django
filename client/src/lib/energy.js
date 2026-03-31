export const ENERGY_MODE_OPTIONS = [
  {
    id: "auto",
    label: "Auto Balance",
    hint: "Route by difficulty",
    activeClass: "border-[#f0deb0] bg-[linear-gradient(135deg,#403116_0%,#6c5320_100%)] text-white shadow-[0_24px_54px_-30px_rgba(108,83,32,0.8)]",
    idleClass: "border-white/10 bg-white/[0.05] text-[#f3dc9a] hover:bg-white/[0.08]",
    chipClass: "border-[#e8d299]/18 bg-[#2a2112]/84 text-[#f4dda1]"
  },
  {
    id: "fast",
    label: "Low Energy",
    hint: "Fast and efficient",
    activeClass: "border-[#95e0bb] bg-[linear-gradient(135deg,#163825_0%,#1f6f48_58%,#2daa72_100%)] text-white shadow-[0_24px_54px_-30px_rgba(29,109,71,0.86)]",
    idleClass: "border-white/10 bg-white/[0.05] text-[#9be7c0] hover:bg-[#113022]/72",
    chipClass: "border-[#74d4a3]/18 bg-[#10251a]/84 text-[#a6f0ca]"
  },
  {
    id: "deep",
    label: "High Energy",
    hint: "Deep reasoning",
    activeClass: "border-[#f1c3b7] bg-[linear-gradient(135deg,#51291f_0%,#944431_100%)] text-white shadow-[0_24px_54px_-30px_rgba(148,68,49,0.82)]",
    idleClass: "border-white/10 bg-white/[0.05] text-[#f3bbcd] hover:bg-[#311620]/72",
    chipClass: "border-[#d68ea8]/18 bg-[#26111a]/84 text-[#f8c7d5]"
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

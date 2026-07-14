import type { TemplateDefinition } from "@/types/studio";

export const W = 1080;
export const H = 1920;

export const TEMPLATES: TemplateDefinition[] = [
  { id: "midnight", name: "Midnight Geometric", kind: "radial", colors: ["#1a3350", "#0a1420"], pattern: true, accent: "#c9a24b", eyebrow: "#e6cd8a", arabic: "#e6cd8a", english: "#eae2cc", source: "#9fb3c8" },
  { id: "manuscript", name: "Desert Manuscript", kind: "linear", colors: ["#efe6cd", "#ddc99a"], pattern: false, accent: "#5c1f2e", eyebrow: "#5c1f2e", arabic: "#5c1f2e", english: "#3a2418", source: "#7a5a44" },
  { id: "emerald", name: "Emerald Minimal", kind: "linear", colors: ["#0f2e28", "#0a1f1b"], pattern: false, accent: "#c9d8b8", eyebrow: "#c9d8b8", arabic: "#c9d8b8", english: "#e9f0e0", source: "#8fae9a" },
  { id: "andalusian", name: "Andalusian Tile", kind: "linear", colors: ["#0b3d3a", "#062523"], pattern: true, accent: "#e0b84a", eyebrow: "#e0b84a", arabic: "#f2d888", english: "#dcefe8", source: "#8fc4b8" },
  { id: "ottoman", name: "Ottoman Tulip", kind: "radial", colors: ["#5c1224", "#2c0912"], pattern: true, accent: "#d9a441", eyebrow: "#e8c37a", arabic: "#f0d9a0", english: "#f0dede", source: "#c98a95" },
  { id: "persianturq", name: "Persian Turquoise", kind: "linear", colors: ["#0d4a4f", "#062b2f"], pattern: true, accent: "#e3b23c", eyebrow: "#8fe0d8", arabic: "#e3b23c", english: "#d6f0ec", source: "#7fc4bc" },
  { id: "kufic", name: "Kufic Ink", kind: "linear", colors: ["#1a1a1a", "#050505"], pattern: false, accent: "#d4d4d4", eyebrow: "#d4d4d4", arabic: "#f2f2f2", english: "#cfcfcf", source: "#8a8a8a" },
  { id: "marrakech", name: "Marrakech Sunset", kind: "radial", colors: ["#9a3d1f", "#3a1409"], pattern: false, accent: "#f2b544", eyebrow: "#f7cd7a", arabic: "#fbe2ae", english: "#fbe8d2", source: "#e0a878" },
  { id: "damascus", name: "Damascus Rose", kind: "linear", colors: ["#4a1420", "#210810"], pattern: true, accent: "#e6a4b0", eyebrow: "#e6a4b0", arabic: "#f2c9d1", english: "#f2dde1", source: "#c98a95" },
  { id: "alhambra", name: "Alhambra Jade", kind: "linear", colors: ["#0e3b32", "#082420"], pattern: true, accent: "#c9a24b", eyebrow: "#a9d3bf", arabic: "#c9a24b", english: "#dcefe4", source: "#8fb8a4" },
  { id: "istanbul", name: "Istanbul Blue Hour", kind: "radial", colors: ["#122a4a", "#050d1c"], pattern: false, accent: "#dcb45a", eyebrow: "#9db8e0", arabic: "#e8d09a", english: "#dbe6f5", source: "#7d94b8" },
  { id: "fes", name: "Fes Copper", kind: "linear", colors: ["#5a2e12", "#2b1508"], pattern: true, accent: "#e8935a", eyebrow: "#eab07e", arabic: "#f2c99a", english: "#f2e0cf", source: "#c98f5f" },
  { id: "samarkand", name: "Samarkand Gold", kind: "radial", colors: ["#2f2409", "#151004"], pattern: true, accent: "#e8c25a", eyebrow: "#f0d488", arabic: "#f5dea0", english: "#f2e8cf", source: "#c9ac6f" },
  { id: "cordoba", name: "Cordoba Ivory", kind: "linear", colors: ["#f2ede0", "#e2d6ba"], pattern: false, accent: "#7a3b2e", eyebrow: "#7a3b2e", arabic: "#5c2a20", english: "#4a3527", source: "#8a6a52" },
  { id: "zellige", name: "Zellige Cobalt", kind: "linear", colors: ["#0c2148", "#050f28"], pattern: true, accent: "#e0b23a", eyebrow: "#8fa8e0", arabic: "#e0b23a", english: "#dbe4f5", source: "#7d8fbe" },
  { id: "nur", name: "Nur Silver", kind: "radial", colors: ["#2b2f33", "#111315"], pattern: false, accent: "#d8dde2", eyebrow: "#d8dde2", arabic: "#f0f2f4", english: "#c5cbd1", source: "#8b939b" },
  { id: "qamar", name: "Qamar Night", kind: "radial", colors: ["#0a1030", "#020412"], pattern: true, accent: "#c9d8ff", eyebrow: "#a9bdf0", arabic: "#dbe4ff", english: "#c9d3ee", source: "#7d88b8" },
  { id: "sahara", name: "Sahara Amber", kind: "linear", colors: ["#7a4a1a", "#3a220c"], pattern: false, accent: "#f2c877", eyebrow: "#f2c877", arabic: "#f7dca0", english: "#f2e2c7", source: "#cba066" },
  { id: "bosphorus", name: "Bosphorus Teal", kind: "linear", colors: ["#0a3a3f", "#041d20"], pattern: true, accent: "#e8d17a", eyebrow: "#8fd4cc", arabic: "#e8d17a", english: "#d6f0ec", source: "#7fbcb2" },
  { id: "jasmine", name: "Jasmine Cream", kind: "linear", colors: ["#f7f2e4", "#ece0c2"], pattern: false, accent: "#4a6b4a", eyebrow: "#4a6b4a", arabic: "#3a4a2e", english: "#4a4030", source: "#7a8560" },
  { id: "indigo", name: "Indigo Minaret", kind: "radial", colors: ["#1a1d4a", "#0a0c24"], pattern: true, accent: "#e0c46a", eyebrow: "#a8aee0", arabic: "#e0c46a", english: "#d6d9f2", source: "#8288b8" },
  { id: "ruby", name: "Ruby Mihrab", kind: "radial", colors: ["#5c0e1e", "#240409"], pattern: true, accent: "#e8b04a", eyebrow: "#e8a4ae", arabic: "#e8b04a", english: "#f2d9de", source: "#c9808c" },
  { id: "saffron", name: "Saffron Dawn", kind: "linear", colors: ["#a85a1a", "#5c2e0c"], pattern: false, accent: "#fbe090", eyebrow: "#fbe090", arabic: "#fef0c0", english: "#f7e4c7", source: "#d9a866" },
  { id: "onyx", name: "Onyx Calligraphy", kind: "linear", colors: ["#141414", "#000000"], pattern: false, accent: "#c9a24b", eyebrow: "#c9a24b", arabic: "#e6cd8a", english: "#d8d8d8", source: "#7a7a7a" },
  { id: "custom", name: "Your Photo", kind: "image" }
];

export const TPL_BY_ID = Object.fromEntries(TEMPLATES.map((template) => [template.id, template]));

export const ARABIC_FONTS = {
  amiri: { family: "Amiri", weight: 700, fallback: "serif" },
  scheherazade: { family: "Scheherazade New", weight: 700, fallback: "serif" },
  arefruqaa: { family: "Aref Ruqaa", weight: 700, fallback: "serif" },
  reemkufi: { family: "Reem Kufi", weight: 600, fallback: "sans-serif" },
  lateef: { family: "Lateef", weight: 700, fallback: "serif" },
  cairo: { family: "Cairo", weight: 600, fallback: "sans-serif" }
} as const;

export const ENGLISH_FONTS = {
  cormorant: { family: "Cormorant Garamond", weight: 400, italic: true, fallback: "serif" },
  playfair: { family: "Playfair Display", weight: 400, italic: true, fallback: "serif" },
  ebgaramond: { family: "EB Garamond", weight: 400, italic: true, fallback: "serif" },
  lora: { family: "Lora", weight: 400, italic: true, fallback: "serif" },
  libre: { family: "Libre Baskerville", weight: 400, italic: true, fallback: "serif" },
  crimson: { family: "Crimson Text", weight: 400, italic: true, fallback: "serif" }
} as const;

export function fontCss(def: { family: string; weight: number; italic?: boolean; fallback: string }, sizePx: number, style?: { italic?: boolean; bold?: boolean }) {
  const italic = style ? style.italic : def.italic;
  const weight = style ? (style.bold ? 700 : 400) : def.weight;
  return `${italic ? "italic " : ""}${weight} ${sizePx}px "${def.family}", ${def.fallback}`;
}

import { format } from "date-fns";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function autoFilename(params: { source?: string; topic?: string; date?: Date; extension: "png" | "mp4" | "webm"; }) {
  const source = slugify(params.source || "hadith");
  const topic = slugify(params.topic || "short");
  const datePart = format(params.date || new Date(), "yyyy-MM-dd");
  return `${source || "hadith"}-${topic || "short"}-${datePart}.${params.extension}`;
}

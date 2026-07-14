import { autoFilename } from "@/utils/filename";
import type { AudioTrack, HadithProject, TextStyle } from "@/types/studio";

export interface EditorState {
  template: string;
  format: "png" | "video";
  duration: number;
  animationsEnabled: boolean;
  animationStyle: string;
  audioTracks: AudioTrack[];
  eyebrow: string;
  arabic: string;
  english: string;
  source: string;
  topic: string;
  caption: string;
  hashtags: string[];
  title: string;
  background?: string | null;
  bgImage?: HTMLImageElement | HTMLVideoElement | null;
  backgroundKind?: "image" | "video" | null;
  backgroundRef?: string | null;
  arabicFont: string;
  englishFont: string;
  styles: Record<"eyebrow" | "arabic" | "english" | "source", TextStyle>;
  watermark: {
    enabled: boolean;
    opacity: number;
    font: string;
    size: number;
    position: HadithProject["exportSettings"]["watermarkPosition"];
    text: string;
  };
}

export function createDefaultEditorState(): EditorState {
  return {
    template: "midnight",
    format: "png",
    duration: 8,
    animationsEnabled: true,
    animationStyle: "revealZoom",
    audioTracks: [],
    eyebrow: "",
    arabic: "قَالَ رَسُولُ اللَّهِ ﷺ: مَنْ لَا يَرْحَمُ لَا يُرْحَمُ",
    english: "The Messenger of Allah ﷺ said: \"He who does not show mercy will not be shown mercy.\"",
    source: "Sahih al-Bukhari 6013",
    topic: "Kindness",
    caption: "",
    hashtags: ["#Islam", "#Hadith", "#Muslim"],
    title: "Kindness",
    background: null,
    bgImage: null,
    backgroundKind: null,
    backgroundRef: null,
    arabicFont: "amiri",
    englishFont: "cormorant",
    styles: {
      eyebrow: { hidden: false, size: 24, bold: true, italic: false, underline: false, align: "center", indent: 0, lineHeight: 1.25, paragraphSpacing: 18, color: "" },
      arabic: { hidden: false, size: 64, bold: true, italic: false, underline: false, align: "center", indent: 0, lineHeight: 1.7, paragraphSpacing: 26, color: "" },
      english: { hidden: false, size: 42, bold: false, italic: true, underline: false, align: "center", indent: 0, lineHeight: 1.5, paragraphSpacing: 18, color: "" },
      source: { hidden: false, size: 24, bold: false, italic: false, underline: false, align: "center", indent: 0, lineHeight: 1.25, paragraphSpacing: 12, color: "" }
    },
    watermark: {
      enabled: true,
      opacity: 0.42,
      font: "Jost",
      size: 28,
      position: "bottom-right",
      text: ""
    }
  };
}

export function createProjectFromEditor(params: {
  state: EditorState;
  existing?: Partial<HadithProject>;
}): HadithProject {
  const now = new Date().toISOString();
  const id = params.existing?.id || `project-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const filename = params.existing?.filename || autoFilename({
    source: params.state.source,
    topic: params.state.title || params.state.topic,
    extension: params.state.format === "video" ? "mp4" : "png"
  });
  return {
    id,
    title: params.state.title || params.state.topic || "Untitled Hadith",
    filename,
    topic: params.state.topic,
    source: params.state.source,
    template: params.state.template,
    format: params.state.format,
    status: (params.existing?.status as HadithProject["status"]) || "Draft",
    favorite: params.existing?.favorite ?? false,
    createdAt: params.existing?.createdAt || now,
    updatedAt: now,
    thumbnail: params.existing?.thumbnail,
    arabicText: params.state.arabic,
    englishText: params.state.english,
    eyebrow: params.state.eyebrow,
    background: undefined,
    backgroundKind: params.state.backgroundKind || undefined,
    backgroundRef: params.state.backgroundRef || undefined,
    caption: params.state.caption,
    hashtags: params.state.hashtags,
    exportSettings: {
      duration: params.state.duration,
      animationsEnabled: params.state.animationsEnabled,
      animationStyle: params.state.animationStyle,
      watermark: params.state.watermark.enabled,
      watermarkOpacity: params.state.watermark.opacity,
      watermarkFont: params.state.watermark.font,
      watermarkSize: params.state.watermark.size,
      watermarkPosition: params.state.watermark.position,
      watermarkText: params.state.watermark.text
    },
    styles: params.state.styles,
    audioTracks: params.state.audioTracks,
    buffer: params.existing?.buffer,
    versions: params.existing?.versions || []
  };
}

export function editorFromProject(project: HadithProject): EditorState {
  return {
    template: project.template,
    format: project.format,
    duration: project.exportSettings.duration,
    animationsEnabled: project.exportSettings.animationsEnabled,
    animationStyle: project.exportSettings.animationStyle,
    audioTracks: project.audioTracks || [],
    eyebrow: project.eyebrow || "",
    arabic: project.arabicText || "",
    english: project.englishText || "",
    source: project.source || "",
    topic: project.topic || "",
    caption: project.caption || "",
    hashtags: project.hashtags || [],
    title: project.title || "",
    background: null,
    bgImage: null,
    backgroundKind: project.backgroundKind || null,
    backgroundRef: project.backgroundRef || null,
    arabicFont: "amiri",
    englishFont: "cormorant",
    styles: project.styles,
    watermark: {
      enabled: project.exportSettings.watermark,
      opacity: project.exportSettings.watermarkOpacity,
      font: project.exportSettings.watermarkFont,
      size: project.exportSettings.watermarkSize,
      position: project.exportSettings.watermarkPosition,
      text: project.exportSettings.watermarkText
    }
  };
}

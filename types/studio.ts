export type ExportFormat = "png" | "video";
export type ProjectStatus = "Draft" | "Exported" | "Scheduled" | "Published" | "Favorites";
export type AssetKind = "background" | "audio" | "template";

export interface TemplateDefinition {
  id: string;
  name: string;
  kind: "radial" | "linear" | "image";
  colors?: [string, string];
  pattern?: boolean;
  accent?: string;
  eyebrow?: string;
  arabic?: string;
  english?: string;
  source?: string;
}

export interface TextStyle {
  hidden: boolean;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: "left" | "center" | "right";
  indent: number;
  lineHeight: number;
  paragraphSpacing: number;
  color: string;
}

export interface AudioTrack {
  id: string;
  name: string;
  duration: number;
  start: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  enabled: boolean;
  sourceUrl?: string;
  storagePath?: string;
  mimeType?: string;
  buffer?: AudioBuffer;
}

export interface ProjectVersionSnapshot {
  id: string;
  createdAt: string;
  label: string;
  data: HadithProject;
}

export interface BufferPostDetails {
  accountIds: string[];
  title?: string;
  caption?: string;
  tags?: string[];
  scheduledAt?: string;
  status?: string;
  error?: string;
  mediaUrl?: string;
  mediaKind?: "image" | "video";
  mediaType?: string;
  fileName?: string;
  category?: string;
}

export interface HadithProject {
  id: string;
  title: string;
  filename: string;
  topic: string;
  source: string;
  template: string;
  format: ExportFormat;
  status: ProjectStatus;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
  arabicText: string;
  englishText: string;
  eyebrow: string;
  background?: string;
  backgroundKind?: "image" | "video";
  backgroundRef?: string;
  caption: string;
  hashtags: string[];
  exportSettings: {
    duration: number;
    animationsEnabled: boolean;
    animationStyle: string;
    watermark: boolean;
    watermarkOpacity: number;
    watermarkFont: string;
    watermarkSize: number;
    watermarkPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
    watermarkText: string;
  };
  styles: Record<"eyebrow" | "arabic" | "english" | "source", TextStyle>;
  audioTracks: AudioTrack[];
  buffer?: BufferPostDetails;
  versions: ProjectVersionSnapshot[];
}

export interface HashtagGroup {
  id: string;
  name: string;
  hashtags: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssetRecord {
  id: string;
  name: string;
  kind: AssetKind;
  sourceUrl: string;
  storagePath?: string;
  fileSize?: number;
  duration?: number;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, string | number | boolean | undefined>;
}

export interface BufferAccount {
  id: string;
  name: string;
  service: string;
  avatar?: string;
  connected: boolean;
}

export interface BufferChannel {
  id: string;
  name: string;
  displayName?: string;
  service: string;
  avatar?: string;
  isQueuePaused?: boolean;
}

export interface BufferPostRecord {
  id: string;
  channelId: string;
  text: string;
  dueAt?: string;
  createdAt?: string;
  status?: string;
  service?: string;
}

export interface BufferQueueItem {
  id: string;
  projectId?: string;
  title: string;
  status: "draft" | "queue" | "scheduled" | "published" | "failed";
  scheduledAt?: string;
  accountIds: string[];
  caption?: string;
  tags?: string[];
  error?: string;
}

export interface CreatorSettings {
  watermarkText: string;
  watermarkOpacity: number;
  watermarkFont: string;
  watermarkSize: number;
  watermarkPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  creatorName: string;
}

export interface AppSettings {
  creator: CreatorSettings;
  bufferEnabled: boolean;
  theme: "dark" | "light";
}

export interface StudioDatabase {
  projects: HadithProject[];
  assets: AssetRecord[];
  hashtags: HashtagGroup[];
  bufferQueue: BufferQueueItem[];
  bufferAccounts: BufferAccount[];
  favorites: {
    projectIds: string[];
    assetIds: string[];
    hashtagIds: string[];
  };
  settings: AppSettings;
}

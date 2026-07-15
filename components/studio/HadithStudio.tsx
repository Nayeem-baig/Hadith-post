"use client";

import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TEMPLATES, TPL_BY_ID, ARABIC_FONTS, ENGLISH_FONTS, fontCss, H, W } from "@/lib/studio-data";
import { createDefaultEditorState, createProjectFromEditor, editorFromProject, type EditorState } from "@/lib/project";
import { getMediaSource, saveMediaSource } from "@/lib/media-store";
import { createInitialDb, fetchStudioDb, readLocalDb, readLocalDbSnapshot, upsertProject, writeLocalDb } from "@/lib/persistence";
import { uploadBlobToCloudinary } from "@/lib/cloudinary-upload";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] || ch));
}

function cleanText(str: string) {
  return str.replace(/[\u200e\u200f]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function HadithStudio() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewShellRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<EditorState>(createDefaultEditorState());
  const activeProjectIdRef = useRef<string | null>(null);

  const templateOptions = useMemo(() => TEMPLATES, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx = canvas.getContext("2d")!;

    let previewDisplayHeight = 0;
    let previewAnimationId: number | null = null;
    let previewPlaying = false;
    let sharedAudioContext: AudioContext | null = null;
    let previewAudioSources: AudioBufferSourceNode[] = [];
    let scrollDebounce: ReturnType<typeof setTimeout> | undefined;
    let autosaveTimer: ReturnType<typeof setInterval> | undefined;

    const state = stateRef.current;
    let studioDbSnapshot = createInitialDb();

    function isDesktopLayout() {
      return window.matchMedia("(min-width: 901px)").matches;
    }

    function previewHeightBounds() {
      if (isDesktopLayout()) {
        return { min: 280, max: Math.max(320, Math.min(window.innerHeight - 120, 760)) };
      }
      const widthLimitedHeight = Math.max(260, ((window.innerWidth - 28) * 16) / 9);
      return { min: 220, max: Math.max(240, Math.min(window.innerHeight * 0.66, widthLimitedHeight, 580)) };
    }

    function clampPreviewHeight(value: number) {
      const bounds = previewHeightBounds();
      return Math.min(Math.max(value, bounds.min), bounds.max);
    }

    function setPreviewHeight(value: number) {
      previewDisplayHeight = clampPreviewHeight(value);
      document.documentElement.style.setProperty("--preview-height", `${previewDisplayHeight}px`);
    }

    function defaultPreviewHeight() {
      if (isDesktopLayout()) return Math.min(Math.max(window.innerHeight * 0.58, 360), 540);
      const widthLimitedHeight = Math.max(320, ((window.innerWidth - 28) * 16) / 9);
      return Math.min(Math.max(window.innerHeight * 0.5, 320), widthLimitedHeight * 0.88, 500);
    }

    function clamp01(value: number) {
      return Math.min(Math.max(value, 0), 1);
    }

    function easeOutCubic(value: number) {
      const t = clamp01(value);
      return 1 - Math.pow(1 - t, 3);
    }

    function easeInOutSine(value: number) {
      const t = clamp01(value);
      return -(Math.cos(Math.PI * t) - 1) / 2;
    }

    function currentProjectId() {
      return activeProjectIdRef.current || "current";
    }

    function persistProject(status: "Draft" | "Exported" | "Scheduled" | "Published" | "Favorites" = "Draft") {
      try {
        const existing = studioDbSnapshot.projects.find((item) => item.id === currentProjectId());
        const project = createProjectFromEditor({ state, existing: existing || undefined });
        project.id = currentProjectId();
        project.status = status;
        project.updatedAt = new Date().toISOString();
        project.versions = [
          {
            id: `version-${Date.now()}`,
            createdAt: project.updatedAt,
            label: `Version ${Math.max(1, (existing?.versions.length || 0) + 1)}`,
            data: existing ? { ...existing, versions: [] } : { ...project, versions: [] }
          },
          ...(existing?.versions || [])
        ].slice(0, 20);
        studioDbSnapshot = upsertProject(studioDbSnapshot, project);
        writeLocalDb(studioDbSnapshot);
        activeProjectIdRef.current = project.id;
      } catch (error) {
        console.error("Project save failed:", error);
      }
    }

    async function hydrateFromLibrary(sourceDb: ReturnType<typeof readLocalDb>) {
      try {
        const activeId = window.localStorage.getItem("hadith-studio-active-project-id");
        if (!activeId) return;
        const project = sourceDb.projects.find((item) => item.id === activeId);
        if (!project) return;
        studioDbSnapshot = sourceDb;
        activeProjectIdRef.current = activeId;
        const editorState = editorFromProject(project);
        Object.assign(state, editorState);
        if (project.backgroundRef && project.backgroundKind) {
          void getMediaSource(project.backgroundRef)
            .then((source) => {
              if (source) return setBackgroundFromSource(source, project.backgroundKind!, project.backgroundRef);
              return null;
            })
            .catch((error) => {
              console.error("Hydrated background failed:", error);
            });
        }
      } catch (error) {
        console.error("Hydration failed:", error);
      }
    }

    function rememberActiveProject() {
      if (activeProjectIdRef.current) {
        window.localStorage.setItem("hadith-studio-active-project-id", activeProjectIdRef.current);
      }
    }

    function getAudioContext() {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error("This browser does not support Web Audio.");
      if (!sharedAudioContext) sharedAudioContext = new AudioContextClass();
      return sharedAudioContext;
    }

    async function resumeAudioContext(audioCtx: AudioContext) {
      if (audioCtx.state === "suspended") await audioCtx.resume();
    }

    function createBackgroundMedia(source: string, kind: "image" | "video") {
      if (kind === "video") {
        const video = document.createElement("video");
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = "auto";
        video.crossOrigin = "anonymous";
        return video;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      return img;
    }

    async function setBackgroundFromSource(source: string, kind: "image" | "video", ref?: string | null) {
      const media = createBackgroundMedia(source, kind);
      await new Promise<void>((resolve, reject) => {
        const onLoad = () => resolve();
        const onError = () => reject(new Error(`Could not load background ${kind}.`));
        if (media instanceof HTMLVideoElement) {
          media.addEventListener("loadeddata", onLoad, { once: true });
          media.addEventListener("error", onError, { once: true });
          media.src = source;
        } else {
          media.onload = onLoad;
          media.onerror = onError;
          media.src = source;
        }
      });
      if (media instanceof HTMLVideoElement) {
        try {
          await media.play();
          media.pause();
          media.currentTime = 0;
        } catch {
          /* best effort decode warmup */
        }
      }
      state.bgImage = media;
      state.background = source;
      state.backgroundKind = kind;
      state.backgroundRef = ref || (await saveMediaSource(source));
    }

    function updateHint() {
      const hint = document.getElementById("hintText");
      const audioText = state.audioTracks.length ? " Audio tracks are mixed into preview and export." : "";
      if (hint) {
        hint.textContent =
          state.format === "video"
            ? `Renders a ${state.duration}s clip at 1080×1920${state.animationsEnabled ? " using the selected animation." : " with animations disabled."}${audioText} Use Play Preview to test the current edits before downloading. Encoded in-browser; format depends on browser support.`
            : "Renders at full 1080×1920. Import the PNG into CapCut/Premiere/InShot to add motion, voiceover, or a slow zoom for the Short.";
      }
    }

    function updatePreviewProgress(t: number) {
      const progress = clamp01(t);
      const bar = document.getElementById("previewProgressBar");
      const time = document.getElementById("previewTime");
      if (bar) (bar as HTMLDivElement).style.width = `${(progress * 100).toFixed(0)}%`;
      if (time) time.textContent = `${(progress * state.duration).toFixed(1)}s / ${state.duration}s`;
    }

    function setPreviewPlaying(isPlaying: boolean) {
      previewPlaying = isPlaying;
      const btn = document.getElementById("previewPlayBtn");
      if (btn) btn.textContent = isPlaying ? "Playing..." : "Play Preview";
    }

    function stopPreviewAudio() {
      previewAudioSources.forEach((source) => {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
      });
      previewAudioSources = [];
    }

    function stopPreviewPlayback(renderStill: boolean) {
      if (previewAnimationId !== null) {
        cancelAnimationFrame(previewAnimationId);
        previewAnimationId = null;
      }
      stopPreviewAudio();
      setPreviewPlaying(false);
      updatePreviewProgress(0);
      if (renderStill) renderFrame(ctx, 1, 1.06, { mode: "none", progress: 1, zoom: 1.06, contentY: 0 }, 0);
    }

    function drawStar8(cx: number, cy: number, r: number, color: string, alpha: number) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a1 = (Math.PI / 4) * i;
        const a2 = (Math.PI / 4) * (i + 1);
        const x1 = Math.cos(a1) * r;
        const y1 = Math.sin(a1) * r;
        const x2 = Math.cos(a2) * r;
        const y2 = Math.sin(a2) * r;
        const mx = Math.cos((a1 + a2) / 2) * r * 0.42;
        const my = Math.sin((a1 + a2) / 2) * r * 0.42;
        if (i === 0) ctx.moveTo(x1, y1);
        ctx.lineTo(mx, my);
        ctx.lineTo(x2, y2);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    function drawGeometricOverlay(color: string) {
      const spacing = 180;
      const r = 78;
      ctx.save();
      for (let y = -spacing; y < H + spacing; y += spacing) {
        for (let x = -spacing; x < W + spacing; x += spacing) {
          drawStar8(x, y, r, color, 0.07);
        }
      }
      for (let y = -spacing + spacing / 2; y < H + spacing; y += spacing) {
        for (let x = -spacing + spacing / 2; x < W + spacing; x += spacing) {
          drawStar8(x, y, r * 0.6, color, 0.05);
        }
      }
      ctx.restore();
    }

    function drawCoverImage(img: HTMLImageElement | HTMLVideoElement, cw: number, ch: number, zoom: number) {
      const iw = img instanceof HTMLVideoElement ? img.videoWidth || img.width : img.naturalWidth || img.width;
      const ih = img instanceof HTMLVideoElement ? img.videoHeight || img.height : img.naturalHeight || img.height;
      const scale = Math.max(cw / iw, ch / ih) * zoom;
      const sw = cw / scale;
      const sh = ch / scale;
      const sx = (iw - sw) / 2;
      const sy = (ih - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    }

    function drawBackground(tplId: string, zoom = 1, time = 0) {
      const tpl = TPL_BY_ID[tplId];
      if (tpl.kind === "radial") {
        const gradient = ctx.createRadialGradient(W * 0.5, H * 0.18, 50, W * 0.5, H * 0.55, H * 0.8);
        gradient.addColorStop(0, tpl.colors?.[0] || "#111");
        gradient.addColorStop(1, tpl.colors?.[1] || "#000");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);
      } else if (tpl.kind === "linear") {
        const gradient = ctx.createLinearGradient(0, 0, W * 0.3, H);
        gradient.addColorStop(0, tpl.colors?.[0] || "#111");
        gradient.addColorStop(1, tpl.colors?.[1] || "#000");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, W, H);
        const bg = state.bgImage as HTMLImageElement | HTMLVideoElement | null;
        if (bg instanceof HTMLVideoElement) {
          const duration = Number.isFinite(bg.duration) && bg.duration > 0 ? bg.duration : state.duration;
          const loopTime = duration > 0 ? time % duration : time;
          if (bg.readyState >= 1 && Math.abs(bg.currentTime - loopTime) > 0.08) {
            try {
              bg.currentTime = loopTime;
            } catch {
              /* ignore seek race */
            }
          }
          if (bg.readyState >= 2) drawCoverImage(bg, W, H, zoom);
        } else if (bg) {
          drawCoverImage(bg, W, H, zoom);
        }
        const overlay = ctx.createLinearGradient(0, 0, 0, H);
        overlay.addColorStop(0, "rgba(0,0,0,.55)");
        overlay.addColorStop(0.4, "rgba(0,0,0,.35)");
        overlay.addColorStop(1, "rgba(0,0,0,.65)");
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, W, H);
      }
      if (tpl.pattern) drawGeometricOverlay(tpl.accent || "#c9a24b");
    }

    function drawCornerMotif(x: number, y: number, size: number, flipX: boolean, flipY: boolean, color: string) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      const s = size / 150;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0 * s, 40 * s);
      ctx.lineTo(40 * s, 40 * s);
      ctx.lineTo(40 * s, 0 * s);
      ctx.moveTo(40 * s, 40 * s);
      ctx.lineTo(75 * s, 75 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 40 * s, -Math.PI / 2, 0, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(40 * s, 40 * s, 8 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawCorners(tplId: string) {
      const tpl = TPL_BY_ID[tplId];
      const color = tpl.accent || "#c9a24b";
      const size = 150;
      const m = 50;
      drawCornerMotif(m, m, size, false, false, color);
      drawCornerMotif(W - m, m, size, true, false, color);
      drawCornerMotif(m, H - m, size, false, true, color);
      drawCornerMotif(W - m, H - m, size, true, true, color);
    }

    function wrapLines(text: string, maxWidth: number, font: string) {
      ctx.font = font;
      const words = text.split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let current = "";
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
          lines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);
      return lines;
    }

    function wrapTextBlocks(text: string, maxWidth: number, font: string) {
      const paragraphs = String(text || "")
        .split(/\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
      return paragraphs.map((paragraph) => wrapLines(paragraph, maxWidth, font));
    }

    function countLines(blocks: string[][]) {
      return blocks.reduce((sum, paragraph) => sum + paragraph.length, 0);
    }

    function effectiveLineHeight(lineHeight: number, paragraphSpacing: number) {
      return lineHeight + paragraphSpacing * 0.08;
    }

    function textBlockHeight(blocks: string[][], lineHeight: number, paragraphSpacing: number) {
      if (!blocks.length) return 0;
      return countLines(blocks) * effectiveLineHeight(lineHeight, paragraphSpacing) + Math.max(0, blocks.length - 1) * paragraphSpacing;
    }

    function fallbackColor(key: "eyebrow" | "arabic" | "english" | "source") {
      return { eyebrow: "#e6cd8a", arabic: "#e6cd8a", english: "#eae2cc", source: "#9fb3c8" }[key];
    }

    function resolveTextColor(key: "eyebrow" | "arabic" | "english" | "source", tpl: (typeof TPL_BY_ID)[string]) {
      return state.styles[key].color || tpl[key] || fallbackColor(key);
    }

    function textAnchorX(style: EditorState["styles"]["eyebrow"]) {
      const left = 110;
      const right = W - 110;
      if (style.align === "left") return left + style.indent;
      if (style.align === "right") return right - style.indent;
      return W / 2 + style.indent;
    }

    function drawUnderline(text: string, x: number, y: number, style: EditorState["styles"]["eyebrow"], lineHeight: number) {
      if (!style.underline || !text) return;
      const width = ctx.measureText(text).width;
      let x1 = x - width / 2;
      if (style.align === "left") x1 = x;
      if (style.align === "right") x1 = x - width;
      const offset = Math.max(7, lineHeight * 0.12);
      ctx.save();
      ctx.globalAlpha *= 0.82;
      ctx.lineWidth = Math.max(2, style.size * 0.04);
      ctx.beginPath();
      ctx.moveTo(x1, y + offset);
      ctx.lineTo(x1 + width, y + offset);
      ctx.stroke();
      ctx.restore();
    }

    function drawTextBlock(blocks: string[][], style: EditorState["styles"]["eyebrow"], font: string, fill: string, startY: number, lineHeight: number, direction: CanvasDirection) {
      ctx.font = font;
      ctx.fillStyle = fill;
      ctx.strokeStyle = fill;
      ctx.direction = direction;
      ctx.textAlign = style.align;
      const x = textAnchorX(style);
      const lineAdvance = effectiveLineHeight(lineHeight, style.paragraphSpacing);
      let y = startY;
      for (let i = 0; i < blocks.length; i++) {
        const paragraph = blocks[i];
        for (const line of paragraph) {
          y += lineAdvance;
          ctx.fillText(line, x, y);
          drawUnderline(line, x, y, style, lineHeight);
          if (line !== paragraph[paragraph.length - 1]) {
            y += style.paragraphSpacing * 0.15;
          }
        }
        if (i < blocks.length - 1) y += style.paragraphSpacing;
      }
      ctx.direction = "ltr";
      return y;
    }

    function animationFrameState(t: number) {
      const time = clamp01(t);
      if (!state.animationsEnabled) return { mode: "none", progress: 1, zoom: 1.06, contentY: 0 };
      if (state.animationStyle === "fade") return { mode: "fade", progress: easeOutCubic(time / 0.38), zoom: 1.02 + 0.04 * time, contentY: 0 };
      if (state.animationStyle === "slideUp") {
        const progress = easeOutCubic(time / 0.45);
        return { mode: "slideUp", progress, zoom: 1.03 + 0.05 * time, contentY: (1 - progress) * 76 };
      }
      if (state.animationStyle === "slowZoom") return { mode: "slowZoom", progress: 1, zoom: 1.0 + 0.1 * time, contentY: 0 };
      if (state.animationStyle === "cinematic") return { mode: "cinematic", progress: clamp01(time / 0.68), zoom: 1.0 + 0.12 * easeInOutSine(time), contentY: (1 - easeOutCubic(time / 0.6)) * 36 };
      return { mode: "revealZoom", progress: clamp01(time / 0.55), zoom: 1.0 + 0.08 * time, contentY: 0 };
    }

    function buildLayout() {
      const maxTextWidth = W - 220;
      const s = state.styles;
      const eyebrowFont = `${s.eyebrow.italic ? "italic " : ""}${s.eyebrow.bold ? "700 " : "500 "}${s.eyebrow.size}px "Jost", sans-serif`;
      const arabicFont = fontCss(ARABIC_FONTS[state.arabicFont as keyof typeof ARABIC_FONTS], s.arabic.size, s.arabic);
      const englishFont = fontCss(ENGLISH_FONTS[state.englishFont as keyof typeof ENGLISH_FONTS], s.english.size, s.english);
      const sourceFont = `${s.source.italic ? "italic " : ""}${s.source.bold ? "700 " : "400 "}${s.source.size}px "Jost", sans-serif`;
      const eyebrowWidth = Math.max(220, maxTextWidth - Math.abs(s.eyebrow.indent));
      const arabicWidth = Math.max(220, maxTextWidth - Math.abs(s.arabic.indent));
      const englishWidth = Math.max(220, maxTextWidth - Math.abs(s.english.indent));
      const sourceWidth = Math.max(220, maxTextWidth - Math.abs(s.source.indent));
      const eyebrowBlocks = !s.eyebrow.hidden && state.eyebrow ? wrapTextBlocks(state.eyebrow.toUpperCase(), eyebrowWidth, eyebrowFont) : [];
      const arabicBlocks = !s.arabic.hidden && state.arabic ? wrapTextBlocks(state.arabic, arabicWidth, arabicFont) : [];
      const englishBlocks = !s.english.hidden && state.english ? wrapTextBlocks(state.english, englishWidth, englishFont) : [];
      const sourceBlocks = !s.source.hidden && state.source ? wrapTextBlocks(state.source.toUpperCase(), sourceWidth, sourceFont) : [];
      const eyebrowLH = s.eyebrow.size * s.eyebrow.lineHeight;
      const arabicLH = s.arabic.size * s.arabic.lineHeight;
      const englishLH = s.english.size * s.english.lineHeight;
      const sourceLH = s.source.size * s.source.lineHeight;
      const hasEyebrow = !!eyebrowBlocks.length;
      const hasArabic = !!arabicBlocks.length;
      const hasEnglish = !!englishBlocks.length;
      const hasSource = !!sourceBlocks.length;
      const showDivider = hasArabic && hasEnglish;
      let h = 0;
      if (hasEyebrow) {
        h += textBlockHeight(eyebrowBlocks, eyebrowLH, s.eyebrow.paragraphSpacing);
        if (hasArabic || hasEnglish || hasSource) h += 50;
      }
      if (hasArabic) {
        h += textBlockHeight(arabicBlocks, arabicLH, s.arabic.paragraphSpacing);
        if (showDivider) h += 56;
        else if (hasEnglish || hasSource) h += 34;
      }
      if (showDivider) h += 2 + 56;
      if (hasEnglish) {
        h += textBlockHeight(englishBlocks, englishLH, s.english.paragraphSpacing);
        if (hasSource) h += 60;
      }
      if (hasSource) h += textBlockHeight(sourceBlocks, sourceLH, s.source.paragraphSpacing);
      return {
        eyebrowBlocks,
        arabicBlocks,
        englishBlocks,
        sourceBlocks,
        eyebrowLH,
        arabicLH,
        englishLH,
        sourceLH,
        totalHeight: h,
        showDivider,
        hasEyebrow,
        hasArabic,
        hasEnglish,
        hasSource,
        fonts: { eyebrowFont, arabicFont, englishFont, sourceFont }
      };
    }

    function drawContent(layout: ReturnType<typeof buildLayout>, progress: number, animation?: ReturnType<typeof animationFrameState>) {
      const tpl = TPL_BY_ID[state.template];
      const cx = W / 2;
      const anim = animation || { mode: "none", progress: 1, contentY: 0 };
      let y = (H - layout.totalHeight) / 2 + (anim.contentY || 0);
      const stages: Record<string, [number, number]> = { eyebrow: [0, 0.12], arabic: [0.08, 0.4], divider: [0.38, 0.46], english: [0.42, 0.7], source: [0.68, 0.82] };
      const reveal = (stage: keyof typeof stages) => {
        if (anim.mode === "none" || anim.mode === "slowZoom") return 1;
        if (anim.mode === "fade" || anim.mode === "slideUp") return anim.progress;
        const [s, e] = stages[stage];
        const eased = anim.mode === "cinematic" ? easeOutCubic(progress) : progress;
        if (eased >= e) return 1;
        if (eased <= s) return 0;
        return easeOutCubic((eased - s) / (e - s));
      };

      if (layout.eyebrowBlocks.length) {
        ctx.globalAlpha = reveal("eyebrow");
        y = drawTextBlock(layout.eyebrowBlocks, state.styles.eyebrow, layout.fonts.eyebrowFont, resolveTextColor("eyebrow", tpl), y, layout.eyebrowLH, "ltr");
        if (layout.hasArabic || layout.hasEnglish || layout.hasSource) y += 50;
      }
      if (layout.arabicBlocks.length) {
        ctx.globalAlpha = reveal("arabic");
        y = drawTextBlock(layout.arabicBlocks, state.styles.arabic, layout.fonts.arabicFont, resolveTextColor("arabic", tpl), y, layout.arabicLH, "rtl");
        if (layout.showDivider) y += 56;
        else if (layout.hasEnglish || layout.hasSource) y += 34;
      }
      if (layout.showDivider) {
        const dividerReveal = reveal("divider");
        const actualDividerW = 180 * dividerReveal;
        ctx.globalAlpha = dividerReveal > 0 ? 1 : 0;
        ctx.fillStyle = resolveTextColor("arabic", tpl);
        ctx.fillRect(cx - actualDividerW / 2, y, actualDividerW, 2);
        y += 2 + 56;
      }
      if (layout.englishBlocks.length) {
        ctx.globalAlpha = reveal("english");
        y = drawTextBlock(layout.englishBlocks, state.styles.english, layout.fonts.englishFont, resolveTextColor("english", tpl), y, layout.englishLH, "ltr");
        if (layout.hasSource) y += 60;
      }
      if (layout.sourceBlocks.length) {
        ctx.globalAlpha = reveal("source");
        y = drawTextBlock(layout.sourceBlocks, state.styles.source, layout.fonts.sourceFont, resolveTextColor("source", tpl), y, layout.sourceLH, "ltr");
      }
      ctx.globalAlpha = 1;
    }

    function renderFrame(targetCtx: CanvasRenderingContext2D, progress: number, zoom: number, animation?: ReturnType<typeof animationFrameState>, time = 0) {
      const previousCtx = ctx;
      ctx = targetCtx;
      targetCtx.clearRect(0, 0, W, H);
      drawBackground(state.template, zoom, time);
      drawCorners(state.template);
      const layout = buildLayout();
      drawContent(layout, progress, animation);
      if (state.watermark.enabled && state.watermark.text.trim()) {
        const tpl = TPL_BY_ID[state.template];
        const alpha = state.watermark.opacity;
        targetCtx.save();
        targetCtx.globalAlpha = alpha;
        targetCtx.fillStyle = tpl.accent || "#c9a24b";
        targetCtx.font = `${state.watermark.opacity > 0.5 ? "600" : "500"} ${state.watermark.size}px "${state.watermark.font}", Jost, sans-serif`;
        targetCtx.textAlign = state.watermark.position.includes("left") ? "left" : state.watermark.position.includes("right") ? "right" : "center";
        targetCtx.textBaseline = "middle";
        const x = state.watermark.position.includes("left") ? 60 : state.watermark.position.includes("right") ? W - 60 : W / 2;
        const y = state.watermark.position.includes("top") ? 70 : state.watermark.position.includes("bottom") ? H - 70 : H / 2;
        targetCtx.fillText(state.watermark.text, x, y);
        targetCtx.restore();
      }
      ctx = previousCtx;
    }

    function renderAnimatedFrame(targetCtx: CanvasRenderingContext2D, time: number) {
      const animation = animationFrameState(time);
      renderFrame(targetCtx, animation.progress, animation.zoom, animation, time);
    }

    function renderPreview() {
      stopPreviewPlayback(false);
      renderFrame(ctx, 1, 1.06, { mode: "none", progress: 1, zoom: 1.06, contentY: 0 }, 0);
      updateHint();
      rememberActiveProject();
    }

    function currentAudioTracks() {
      return state.audioTracks;
    }

    function normalizeAudioTrack(track: EditorState["audioTracks"][number]) {
      const minGap = 0.05;
      track.start = Math.min(Math.max(track.start, 0), Math.max(0, state.duration));
      track.trimStart = Math.min(Math.max(track.trimStart, 0), Math.max(0, track.duration - minGap));
      track.trimEnd = Math.min(Math.max(track.trimEnd, track.trimStart + minGap), track.duration);
      const segmentLength = Math.max(minGap, track.trimEnd - track.trimStart);
      track.volume = Math.min(Math.max(track.volume, 0), 2);
      track.fadeIn = Math.min(Math.max(track.fadeIn, 0), segmentLength);
      track.fadeOut = Math.min(Math.max(track.fadeOut, 0), segmentLength);
    }

    function formatSeconds(value: number) {
      return `${Number(value || 0).toFixed(1)}s`;
    }

    function renderAudioTracks() {
      const list = document.getElementById("audioTrackList");
      if (!list) return;
      if (!state.audioTracks.length) {
        list.innerHTML = '<div class="audio-empty">Add music, voiceover, or sound effects. Each track can be trimmed and positioned on the video timeline.</div>';
        return;
      }
      list.innerHTML = state.audioTracks
        .map((track) => {
          normalizeAudioTrack(track);
          return `
            <div class="audio-track" data-audio-id="${track.id}">
              <div class="audio-track-top">
                <label class="hide-toggle"><input type="checkbox" data-audio-prop="enabled" ${track.enabled ? "checked" : ""}> On</label>
                <div class="audio-track-name" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</div>
                <div class="audio-duration">${formatSeconds(track.duration)}</div>
                <button type="button" class="audio-remove" data-audio-remove>Remove</button>
              </div>
              <div class="audio-grid">
                <div class="audio-field"><label>Start</label><input type="number" min="0" max="${state.duration}" step="0.1" data-audio-prop="start" value="${track.start.toFixed(1)}"></div>
                <div class="audio-field"><label>Trim in</label><input type="number" min="0" max="${track.duration.toFixed(1)}" step="0.1" data-audio-prop="trimStart" value="${track.trimStart.toFixed(1)}"></div>
                <div class="audio-field"><label>Trim out</label><input type="number" min="0.1" max="${track.duration.toFixed(1)}" step="0.1" data-audio-prop="trimEnd" value="${track.trimEnd.toFixed(1)}"></div>
                <div class="audio-field"><label>Volume</label><input type="number" min="0" max="200" step="5" data-audio-prop="volumePct" value="${Math.round(track.volume * 100)}"></div>
                <div class="audio-field"><label>Fade in</label><input type="number" min="0" max="${track.duration.toFixed(1)}" step="0.1" data-audio-prop="fadeIn" value="${track.fadeIn.toFixed(1)}"></div>
                <div class="audio-field"><label>Fade out</label><input type="number" min="0" max="${track.duration.toFixed(1)}" step="0.1" data-audio-prop="fadeOut" value="${track.fadeOut.toFixed(1)}"></div>
              </div>
            </div>`;
        })
        .join("");

      list.querySelectorAll("[data-audio-remove]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = (btn.closest("[data-audio-id]") as HTMLElement | null)?.dataset.audioId;
          state.audioTracks = state.audioTracks.filter((track) => track.id !== id);
          stopPreviewPlayback(true);
          renderAudioTracks();
          renderPreview();
        });
      });

      list.querySelectorAll<HTMLInputElement>("[data-audio-prop]").forEach((input) => {
        input.addEventListener("input", () => {
          const row = input.closest("[data-audio-id]") as HTMLElement | null;
          const track = state.audioTracks.find((item) => item.id === row?.dataset.audioId);
          if (!track) return;
          const prop = input.dataset.audioProp;
          if (prop === "enabled") {
            track.enabled = input.checked;
          } else if (prop === "volumePct") {
            track.volume = Math.min(Math.max(Number(input.value), 0), 200) / 100;
          } else {
            (track as unknown as Record<string, number>)[prop || ""] = Number(input.value);
          }
          normalizeAudioTrack(track);
          stopPreviewPlayback(true);
          renderPreview();
        });
        input.addEventListener("change", renderAudioTracks);
      });
    }

    async function scheduleAudioTracks(audioCtx: AudioContext, destination: AudioNode | MediaStreamAudioDestinationNode, startDelay: number) {
      const sources: AudioBufferSourceNode[] = [];
      const baseTime = audioCtx.currentTime + (startDelay || 0);
      for (const track of currentAudioTracks()) {
        normalizeAudioTrack(track);
        if (!track.enabled || !track.buffer) continue;
        const segmentLength = track.trimEnd - track.trimStart;
        const videoStart = track.start;
        const videoEnd = track.start + segmentLength;
        const audibleStart = Math.max(0, videoStart);
        const audibleEnd = Math.min(state.duration, videoEnd);
        if (audibleEnd <= audibleStart) continue;
        const source = audioCtx.createBufferSource();
        const gain = audioCtx.createGain();
        source.buffer = track.buffer;
        source.connect(gain);
        gain.connect(destination);
        const when = baseTime + audibleStart;
        const sourceOffset = track.trimStart + (audibleStart - videoStart);
        const playDuration = audibleEnd - audibleStart;
        const volume = track.volume;
        const fadeIn = Math.min(track.fadeIn, playDuration);
        const fadeOut = Math.min(track.fadeOut, playDuration);
        gain.gain.cancelScheduledValues(when);
        if (fadeIn > 0) {
          gain.gain.setValueAtTime(0, when);
          gain.gain.linearRampToValueAtTime(volume, when + fadeIn);
        } else {
          gain.gain.setValueAtTime(volume, when);
        }
        if (fadeOut > 0) {
          const fadeOutStart = Math.max(when, when + playDuration - fadeOut);
          gain.gain.setValueAtTime(volume, fadeOutStart);
          gain.gain.linearRampToValueAtTime(0, when + playDuration);
        }
        source.start(when, sourceOffset, playDuration);
        sources.push(source);
      }
      return sources;
    }

    async function startPreviewAudio() {
      stopPreviewAudio();
      if (!state.audioTracks.length) return;
      const audioCtx = getAudioContext();
      await resumeAudioContext(audioCtx);
      previewAudioSources = await scheduleAudioTracks(audioCtx, audioCtx.destination, 0.04);
    }

    async function playPreviewAnimation() {
      await ensureFonts();
      stopPreviewPlayback(false);
      setPreviewPlaying(true);
      updatePreviewProgress(0);
      await startPreviewAudio();
      const durationMs = state.duration * 1000;
      const previewDelayMs = 40;
      const startTime = performance.now() + previewDelayMs;
      const tick = (now: number) => {
        const t = clamp01(Math.max(0, now - startTime) / durationMs);
        renderAnimatedFrame(ctx, t);
        updatePreviewProgress(t);
        if (t < 1 && previewPlaying) {
          previewAnimationId = requestAnimationFrame(tick);
        } else {
          previewAnimationId = null;
          setPreviewPlaying(false);
        }
      };
      previewAnimationId = requestAnimationFrame(tick);
    }

    async function ensureFonts() {
      const arabicDef = ARABIC_FONTS[state.arabicFont as keyof typeof ARABIC_FONTS];
      const englishDef = ENGLISH_FONTS[state.englishFont as keyof typeof ENGLISH_FONTS];
      await Promise.all([
        document.fonts.load(fontCss(arabicDef, state.styles.arabic.size, state.styles.arabic)),
        document.fonts.load(fontCss(englishDef, state.styles.english.size, state.styles.english)),
        document.fonts.load(`${state.styles.eyebrow.italic ? "italic " : ""}${state.styles.eyebrow.bold ? "700 " : "500 "}${state.styles.eyebrow.size}px "Jost"`),
        document.fonts.load(`${state.styles.source.italic ? "italic " : ""}${state.styles.source.bold ? "700 " : "400 "}${state.styles.source.size}px "Jost"`)
      ]);
    }

    function parseSunnahHtml(html: string) {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const result = { eyebrow: "", arabic: "", english: "", source: "" };
      const chapterEl = doc.querySelector(".englishchapter");
      if (chapterEl) result.eyebrow = cleanText(chapterEl.textContent || "");
      const arabicEl = doc.querySelector(".arabic_hadith_full");
      if (arabicEl) result.arabic = cleanText(arabicEl.textContent || "");
      const englishEl = doc.querySelector(".text_details");
      if (englishEl) {
        const withBreaks = englishEl.innerHTML.replace(/<br\s*\/?>/gi, "\n");
        const tmp = document.createElement("div");
        tmp.innerHTML = withBreaks;
        result.english = cleanText(tmp.textContent || "");
      }
      const refTable = doc.querySelector("table.hadith_reference");
      if (refTable) {
        let refText = "";
        let inbookText = "";
        refTable.querySelectorAll("tr").forEach((tr) => {
          const cells = tr.querySelectorAll("td");
          if (!cells.length) return;
          const label = cells[0].textContent?.trim() || "";
          if (label.startsWith("Reference")) {
            const a = tr.querySelector("a");
            if (a) refText = cleanText(a.textContent || "");
          } else if (label.startsWith("In-book reference")) {
            if (cells[1]) inbookText = cleanText(cells[1].textContent || "").replace(/^:\s*/, "");
          }
        });
        result.source = refText + (inbookText ? ` (${inbookText})` : "");
      }
      return result;
    }

    function applyExtraction(result: { eyebrow: string; arabic: string; english: string; source: string }) {
      if (result.eyebrow) {
        state.eyebrow = result.eyebrow;
        const input = document.getElementById("eyebrowInput") as HTMLInputElement | null;
        if (input) input.value = result.eyebrow;
      }
      if (result.arabic) {
        state.arabic = result.arabic;
        const input = document.getElementById("arabicInput") as HTMLTextAreaElement | null;
        if (input) input.value = result.arabic;
      }
      if (result.english) {
        state.english = result.english;
        const input = document.getElementById("englishInput") as HTMLTextAreaElement | null;
        if (input) input.value = result.english;
      }
      if (result.source) {
        state.source = result.source;
        const input = document.getElementById("sourceInput") as HTMLInputElement | null;
        if (input) input.value = result.source;
      }
      renderPreview();
    }

    async function fetchViaServerExtractor(targetUrl: string) {
      try {
        const response = await fetch(`/api/extract?url=${encodeURIComponent(targetUrl)}`, { cache: "no-store" });
        if (!response.ok) return null;
        const payload = (await response.json()) as { ok?: boolean; html?: string };
        if (!payload.ok || !payload.html) return null;
        return payload.html;
      } catch (error) {
        console.error("Server extractor failed:", error);
        return null;
      }
    }

    function setExtractStatus(msg: string, kind?: "error" | "success") {
      const el = document.getElementById("extractStatus");
      if (!el) return;
      el.textContent = msg;
      el.className = `extract-status${kind ? ` ${kind}` : ""}`;
    }

    function updateEditorReadouts(key: keyof EditorState["styles"]) {
      const editor = document.querySelector(`[data-style-editor="${key}"]`) as HTMLElement | null;
      if (!editor) return;
      const style = state.styles[key];
      const line = editor.querySelector('[data-readout="lineHeight"]');
      const paragraph = editor.querySelector('[data-readout="paragraphSpacing"]');
      const indent = editor.querySelector('[data-readout="indent"]');
      if (line) line.textContent = style.lineHeight.toFixed(2);
      if (paragraph) paragraph.textContent = `${style.paragraphSpacing}px`;
      if (indent) indent.textContent = `${style.indent}px`;
    }

    function syncEditorButtons(key: keyof EditorState["styles"]) {
      const editor = document.querySelector(`[data-style-editor="${key}"]`) as HTMLElement | null;
      if (!editor) return;
      editor.querySelectorAll<HTMLElement>("[data-toggle-style]").forEach((btn) => {
        btn.classList.toggle("active", !!state.styles[key][btn.dataset.toggleStyle as keyof typeof state.styles[typeof key]]);
      });
      editor.querySelectorAll<HTMLElement>("[data-align]").forEach((btn) => {
        btn.classList.toggle("active", state.styles[key].align === btn.dataset.align);
      });
      updateEditorReadouts(key);
    }

    function currentEditorColor(key: keyof EditorState["styles"]) {
      const tpl = TPL_BY_ID[state.template];
      return state.styles[key].color || (tpl[key] as string) || fallbackColor(key as never);
    }

    function buildStyleEditor(key: keyof EditorState["styles"], mountId: string, title: string, colorKey: keyof typeof TPL_BY_ID[string]) {
      const style = state.styles[key];
      const mount = document.getElementById(mountId);
      if (!mount) return;
      mount.innerHTML = `
        <details class="style-editor" open data-style-editor="${key}">
          <summary>${title}</summary>
          <div class="tool-row">
            <button type="button" class="tool-btn" data-toggle-style="bold">B</button>
            <button type="button" class="tool-btn" data-toggle-style="italic"><em>I</em></button>
            <button type="button" class="tool-btn" data-toggle-style="underline"><u>U</u></button>
            <button type="button" class="tool-btn" data-align="left">Left</button>
            <button type="button" class="tool-btn" data-align="center">Center</button>
            <button type="button" class="tool-btn" data-align="right">Right</button>
          </div>
          <div class="editor-grid">
            <div class="editor-field"><label>Font size</label><input type="number" min="12" max="120" step="1" data-style-prop="size" value="${style.size}"></div>
            <div class="editor-field"><label>Text color</label><input type="color" data-style-prop="color" value="${currentEditorColor(key)}"></div>
            <div class="editor-field"><label>Line spacing <span class="range-readout" data-readout="lineHeight">${style.lineHeight.toFixed(2)}</span></label><input type="range" min="1" max="2.4" step=".05" data-style-prop="lineHeight" value="${style.lineHeight}"></div>
            <div class="editor-field"><label>Paragraph <span class="range-readout" data-readout="paragraphSpacing">${style.paragraphSpacing}px</span></label><input type="range" min="0" max="90" step="2" data-style-prop="paragraphSpacing" value="${style.paragraphSpacing}"></div>
            <div class="editor-field"><label>Indent <span class="range-readout" data-readout="indent">${style.indent}px</span></label><input type="range" min="-180" max="180" step="5" data-style-prop="indent" value="${style.indent}"></div>
          </div>
        </details>`;
      syncEditorButtons(key);
      mount.querySelectorAll<HTMLElement>("[data-toggle-style]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const prop = btn.dataset.toggleStyle as "bold" | "italic" | "underline";
          state.styles[key][prop] = !state.styles[key][prop];
          syncEditorButtons(key);
          await ensureFonts();
          renderPreview();
        });
      });
      mount.querySelectorAll<HTMLElement>("[data-align]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.styles[key].align = btn.dataset.align as "left" | "center" | "right";
          syncEditorButtons(key);
          renderPreview();
        });
      });
      mount.querySelectorAll<HTMLInputElement>("[data-style-prop]").forEach((input) => {
        input.addEventListener("input", async () => {
          const prop = input.dataset.styleProp as keyof typeof style;
          if (prop === "color") {
            state.styles[key].color = input.value;
          } else {
            const value = Number(input.value);
            (state.styles[key] as unknown as Record<string, number>)[prop] = value;
            updateEditorReadouts(key);
          }
          if (prop === "size" || prop === "lineHeight") await ensureFonts();
          renderPreview();
        });
      });
    }

    function renderCurrentStyleEditors() {
      buildStyleEditor("eyebrow", "eyebrowEditor", "Eyebrow style", "eyebrow");
      buildStyleEditor("arabic", "arabicEditor", "Arabic style", "arabic");
      buildStyleEditor("english", "englishEditor", "English style", "english");
      buildStyleEditor("source", "sourceEditor", "Source style", "source");
    }

    function setSelectedDuration(val: number, scrollTo: boolean) {
      state.duration = val;
      document.querySelectorAll(".wheel-item").forEach((el) => {
        el.classList.toggle("selected", Number((el as HTMLElement).dataset.val) === val);
      });
      updateHint();
      if (scrollTo) {
        const wheelScroll = document.getElementById("durationWheel") as HTMLElement | null;
        if (wheelScroll) wheelScroll.scrollTop = (val - 1) * 40;
      }
      updatePreviewProgress(0);
      state.audioTracks.forEach(normalizeAudioTrack);
      renderAudioTracks();
      renderPreview();
    }

    async function addAudioFiles(files: File[]) {
      let audioCtx: AudioContext;
      try {
        audioCtx = getAudioContext();
        await resumeAudioContext(audioCtx);
      } catch {
        alert("This browser does not support in-browser audio mixing. Try Chrome, Edge, or Safari.");
        return;
      }
      for (const file of files) {
        try {
          const buffer = await audioCtx.decodeAudioData(await file.arrayBuffer());
          state.audioTracks.push({
            id: `audio-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: file.name,
            buffer,
            duration: buffer.duration,
            start: 0,
            trimStart: 0,
            trimEnd: buffer.duration,
            volume: 1,
            fadeIn: 0,
            fadeOut: 0,
            enabled: true
          });
        } catch (error) {
          console.error(error);
          alert(`Could not read "${file.name}". Try another audio file format.`);
        }
      }
      renderAudioTracks();
      updateHint();
      renderPreview();
    }

    async function applyPendingReuse(sourceDb: ReturnType<typeof readLocalDb>) {
      const pendingBackground = window.localStorage.getItem("hadith-studio-pending-background");
      if (pendingBackground) {
        try {
          const kind = (window.localStorage.getItem("hadith-studio-pending-background-kind") as "image" | "video" | null) || "image";
          await setBackgroundFromSource(pendingBackground, kind);
          window.localStorage.removeItem("hadith-studio-pending-background");
          window.localStorage.removeItem("hadith-studio-pending-background-name");
          window.localStorage.removeItem("hadith-studio-pending-background-kind");
        } catch (error) {
          console.error("Pending background reuse failed:", error);
        }
      }

      const pendingAudio = window.localStorage.getItem("hadith-studio-pending-audio");
      if (pendingAudio) {
        try {
          const audioCtx = getAudioContext();
          await resumeAudioContext(audioCtx);
          const buffer = await audioCtx.decodeAudioData(await (await fetch(pendingAudio)).arrayBuffer());
          state.audioTracks.push({
            id: `audio-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: window.localStorage.getItem("hadith-studio-pending-audio-name") || "Imported audio",
            buffer,
            duration: buffer.duration,
            start: 0,
            trimStart: 0,
            trimEnd: buffer.duration,
            volume: 1,
            fadeIn: 0,
            fadeOut: 0,
            enabled: true
          });
          window.localStorage.removeItem("hadith-studio-pending-audio");
          window.localStorage.removeItem("hadith-studio-pending-audio-name");
        } catch (error) {
          console.error("Pending audio reuse failed:", error);
        }
      }

      const pendingHashtags = window.localStorage.getItem("hadith-studio-pending-hashtag-group");
      if (pendingHashtags) {
        try {
          const group = sourceDb.hashtags.find((item) => item.id === pendingHashtags);
          if (group) state.hashtags = group.hashtags;
          window.localStorage.removeItem("hadith-studio-pending-hashtag-group");
        } catch (error) {
          console.error("Pending hashtag reuse failed:", error);
        }
      }
    }

    async function exportPNG(options?: { download?: boolean }) {
      await ensureFonts();
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = W;
      exportCanvas.height = H;
      const ectx = exportCanvas.getContext("2d");
      if (!ectx) return;
      renderFrame(ectx, 1, 1.06);
      return await new Promise<Blob | null>((resolve) => {
        exportCanvas.toBlob((blob) => {
          if (!blob) return resolve(null);
          if (options?.download !== false) {
            const link = document.createElement("a");
            link.download = `hadith-short-${Date.now()}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
          }
          persistProject("Exported");
          resolve(blob);
        }, "image/png");
      });
    }

    function pickMimeType() {
      const candidates = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
      for (const candidate of candidates) {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(candidate)) return candidate;
      }
      return "";
    }

    async function exportVideo(options?: { download?: boolean }) {
      await ensureFonts();
      const progressWrap = document.getElementById("progressWrap") as HTMLDivElement | null;
      const progressBar = document.getElementById("progressBar") as HTMLDivElement | null;
      if (progressWrap) progressWrap.style.display = "block";
      if (progressBar) progressBar.style.width = "0%";
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = W;
      exportCanvas.height = H;
      const ectx = exportCanvas.getContext("2d");
      if (!ectx) throw new Error("Could not create export canvas.");
      let audioCtxForExport: AudioContext | null = null;
      let audioDestination: MediaStreamAudioDestinationNode | null = null;
      if (state.audioTracks.some((track) => track.enabled && track.buffer)) {
        audioCtxForExport = getAudioContext();
        await resumeAudioContext(audioCtxForExport);
        audioDestination = audioCtxForExport.createMediaStreamDestination();
      }
      const mimeType = pickMimeType();
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const videoStream = exportCanvas.captureStream(30);
      const stream = audioDestination
        ? new MediaStream([...videoStream.getVideoTracks(), ...audioDestination.stream.getAudioTracks()])
        : videoStream;
      const recorderOpts = mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : { videoBitsPerSecond: 8_000_000 };
      const recorder = new MediaRecorder(stream, recorderOpts);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      const durationMs = state.duration * 1000;
      return await new Promise<Blob | null>((resolve, reject) => {
        recorder.onstop = () => {
          try {
            const blob = new Blob(chunks, { type: mimeType || "video/webm" });
            if (options?.download !== false) {
              const link = document.createElement("a");
              link.download = `hadith-short-${Date.now()}.${ext}`;
              link.href = URL.createObjectURL(blob);
              link.click();
            }
            if (progressWrap) progressWrap.style.display = "none";
            persistProject("Exported");
            resolve(blob);
          } catch (error) {
            reject(error);
          }
        };
        renderAnimatedFrame(ectx, 0);
        recorder.start();
        if (audioDestination && audioCtxForExport) {
          scheduleAudioTracks(audioCtxForExport, audioDestination, 0);
        }
        const startTime = performance.now();
        const tick = (now: number) => {
          const elapsed = now - startTime;
          const t = Math.min(elapsed / durationMs, 1);
          renderAnimatedFrame(ectx, t);
          if (progressBar) progressBar.style.width = `${(t * 100).toFixed(0)}%`;
          if (t < 1) {
            requestAnimationFrame(tick);
          } else {
            setTimeout(() => recorder.stop(), 50);
          }
        };
        requestAnimationFrame(tick);
      });
    }

    async function saveDraft() {
      persistProject("Draft");
      rememberActiveProject();
      const status = document.getElementById("saveStatus");
      if (status) status.textContent = "Saved draft.";
      setTimeout(() => {
        if (status) status.textContent = "";
      }, 2000);
    }

    async function wireUp() {
      const serverDb = await fetchStudioDb();
      const localSnapshot = readLocalDbSnapshot();
      const sourceDb = serverDb?.configured && serverDb.connected && !serverDb.hasDocument && localSnapshot.hasData ? localSnapshot.db : serverDb?.db || localSnapshot.db;
      studioDbSnapshot = sourceDb;
      await hydrateFromLibrary(sourceDb);
      await applyPendingReuse(sourceDb);
      const templateGrid = document.getElementById("templateGrid");
      if (templateGrid) {
        templateGrid.innerHTML = "";
        templateOptions.forEach((tpl) => {
          const el = document.createElement("div");
          el.className = `template-swatch${tpl.id === state.template ? " active" : ""}`;
          el.dataset.tpl = tpl.id;
          if (tpl.kind === "image") {
            el.innerHTML = '<div class="swatch-custom">Upload<br>photo</div><div class="template-name">Your Photo</div>';
          } else {
            const dir = tpl.kind === "radial" ? "circle at 50% 20%" : "160deg";
            el.style.background = `${tpl.kind === "radial" ? "radial-gradient(" : "linear-gradient("}${dir}, ${tpl.colors?.[0]}, ${tpl.colors?.[1]})`;
            el.innerHTML = `<div class="template-name">${tpl.name}</div>`;
          }
          el.addEventListener("click", () => {
            document.querySelectorAll(".template-swatch").forEach((s) => s.classList.remove("active"));
            el.classList.add("active");
            state.template = tpl.id;
            const uploadSection = document.getElementById("uploadSection") as HTMLElement | null;
            if (uploadSection) uploadSection.style.display = tpl.id === "custom" ? "block" : "none";
            renderCurrentStyleEditors();
            renderPreview();
          });
          templateGrid.appendChild(el);
        });
      }

      renderCurrentStyleEditors();

      const uploadSection = document.getElementById("uploadSection") as HTMLElement | null;
      if (uploadSection) uploadSection.style.display = state.template === "custom" ? "block" : "none";

      const bgUpload = document.getElementById("bgUpload") as HTMLInputElement | null;
      bgUpload?.addEventListener("change", (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const source = String(ev.target?.result || "");
          const kind: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
          void setBackgroundFromSource(source, kind)
            .then(() => renderPreview())
            .catch((error) => {
              console.error("Background upload failed:", error);
              alert("Could not load that background media file.");
            });
        };
        reader.readAsDataURL(file);
      });

      function bindText(inputId: string, key: keyof Pick<EditorState, "eyebrow" | "arabic" | "english" | "source">) {
        const input = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement | null;
        input?.addEventListener("input", (event) => {
          state[key] = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
          renderPreview();
        });
      }
      bindText("eyebrowInput", "eyebrow");
      bindText("arabicInput", "arabic");
      bindText("englishInput", "english");
      bindText("sourceInput", "source");

      const watermarkInput = document.getElementById("watermarkInput") as HTMLInputElement | null;
      watermarkInput?.addEventListener("input", (event) => {
        state.watermark.text = (event.target as HTMLInputElement).value;
        renderPreview();
      });

      function bindHideToggle(inputId: string, key: keyof EditorState["styles"]) {
        const input = document.getElementById(inputId) as HTMLInputElement | null;
        input?.addEventListener("change", (event) => {
          state.styles[key].hidden = (event.target as HTMLInputElement).checked;
          renderPreview();
        });
      }
      bindHideToggle("hideEyebrowToggle", "eyebrow");
      bindHideToggle("hideArabicToggle", "arabic");
      bindHideToggle("hideEnglishToggle", "english");
      bindHideToggle("hideSourceToggle", "source");

      const arabicFontSelect = document.getElementById("arabicFontSelect") as HTMLSelectElement | null;
      arabicFontSelect?.addEventListener("change", async (event) => {
        state.arabicFont = (event.target as HTMLSelectElement).value as EditorState["arabicFont"];
        await ensureFonts();
        renderPreview();
      });
      const englishFontSelect = document.getElementById("englishFontSelect") as HTMLSelectElement | null;
      englishFontSelect?.addEventListener("change", async (event) => {
        state.englishFont = (event.target as HTMLSelectElement).value as EditorState["englishFont"];
        await ensureFonts();
        renderPreview();
      });

      document.querySelectorAll<HTMLElement>(".format-opt").forEach((opt) => {
        opt.addEventListener("click", () => {
          document.querySelectorAll(".format-opt").forEach((item) => item.classList.remove("active"));
          opt.classList.add("active");
          state.format = opt.dataset.format as EditorState["format"];
          const isVideo = state.format === "video";
          const videoOptions = document.getElementById("videoOptions") as HTMLElement | null;
          if (videoOptions) videoOptions.style.display = isVideo ? "block" : "none";
          const downloadBtn = document.getElementById("downloadBtn") as HTMLButtonElement | null;
          if (downloadBtn) downloadBtn.textContent = isVideo ? "Download Video" : "Download PNG";
          if (!isVideo) stopPreviewPlayback(true);
          updateHint();
          renderPreview();
        });
      });

      const animationToggle = document.getElementById("animationToggle") as HTMLInputElement | null;
      animationToggle?.addEventListener("change", (event) => {
        state.animationsEnabled = (event.target as HTMLInputElement).checked;
        const animationStyleSelect = document.getElementById("animationStyleSelect") as HTMLSelectElement | null;
        if (animationStyleSelect) animationStyleSelect.disabled = !state.animationsEnabled;
        stopPreviewPlayback(true);
        updateHint();
      });
      const animationStyleSelect = document.getElementById("animationStyleSelect") as HTMLSelectElement | null;
      animationStyleSelect?.addEventListener("change", (event) => {
        state.animationStyle = (event.target as HTMLSelectElement).value;
        stopPreviewPlayback(true);
        updateHint();
      });

      document.getElementById("previewPlayBtn")?.addEventListener("click", () => {
        playPreviewAnimation().catch((error) => console.error(error));
      });
      document.getElementById("previewStopBtn")?.addEventListener("click", () => {
        stopPreviewPlayback(true);
      });

      const audioUpload = document.getElementById("audioUpload") as HTMLInputElement | null;
      audioUpload?.addEventListener("change", async (event) => {
        const files = Array.from((event.target as HTMLInputElement).files || []);
        if (!files.length) return;
        await addAudioFiles(files);
        (event.target as HTMLInputElement).value = "";
      });

      const extractBtn = document.getElementById("extractBtn") as HTMLButtonElement | null;
      extractBtn?.addEventListener("click", async () => {
        const urlInput = document.getElementById("sunnahUrlInput") as HTMLInputElement | null;
        const url = urlInput?.value.trim() || "";
        if (!/^https?:\/\/(www\.)?sunnah\.com\//i.test(url)) {
          setExtractStatus("Please paste a valid sunnah.com hadith URL, e.g. https://sunnah.com/muslim:11b", "error");
          return;
        }
        extractBtn.disabled = true;
        setExtractStatus("Fetching…");
        try {
          const html = await fetchViaServerExtractor(url);
          if (!html) {
            setExtractStatus('Could not fetch the page from here. Use "paste HTML source" below instead.', "error");
            const section = document.getElementById("pasteHtmlSection") as HTMLElement | null;
            if (section) section.style.display = "block";
            return;
          }
          const result = parseSunnahHtml(html);
          if (!result.arabic && !result.english) {
            setExtractStatus("Fetched the page but could not find hadith content — the URL may not point to a single hadith.", "error");
            return;
          }
          applyExtraction(result);
          setExtractStatus("Extracted and filled in below — edit anything you like.", "success");
        } catch (error) {
          console.error(error);
          setExtractStatus('Something went wrong fetching that page. Use "paste HTML source" below instead.', "error");
          const section = document.getElementById("pasteHtmlSection") as HTMLElement | null;
          if (section) section.style.display = "block";
        } finally {
          extractBtn.disabled = false;
        }
      });

      document.getElementById("extractToggle")?.addEventListener("click", () => {
        const section = document.getElementById("pasteHtmlSection") as HTMLElement | null;
        if (!section) return;
        section.style.display = section.style.display === "none" ? "block" : "none";
      });

      document.getElementById("parsePastedBtn")?.addEventListener("click", () => {
        const input = document.getElementById("pasteHtmlInput") as HTMLTextAreaElement | null;
        const html = input?.value || "";
        if (!html || html.length < 200) {
          setExtractStatus("Paste the full page source first (view-source, select all, copy).", "error");
          return;
        }
        const result = parseSunnahHtml(html);
        if (!result.arabic && !result.english) {
          setExtractStatus("Could not find hadith content in the pasted HTML.", "error");
          return;
        }
        applyExtraction(result);
        setExtractStatus("Extracted and filled in below — edit anything you like.", "success");
      });

      const downloadBtn = document.getElementById("downloadBtn") as HTMLButtonElement | null;
      downloadBtn?.addEventListener("click", async () => {
        downloadBtn.disabled = true;
        const originalText = downloadBtn.textContent || "Download";
        try {
          if (state.format === "png") {
            downloadBtn.textContent = "Rendering...";
            await exportPNG();
          } else {
            downloadBtn.textContent = "Recording...";
            await exportVideo();
          }
        } catch (error) {
          console.error(error);
          alert("Something went wrong exporting. Try PNG if video recording is unsupported, or open this file in a normal browser tab instead of an embedded preview.");
        } finally {
          downloadBtn.disabled = false;
          downloadBtn.textContent = originalText;
        }
      });

      document.getElementById("saveDraftBtn")?.addEventListener("click", () => {
        saveDraft().catch((error) => console.error(error));
      });

      document.getElementById("postToBufferBtn")?.addEventListener("click", async () => {
        const button = document.getElementById("postToBufferBtn") as HTMLButtonElement | null;
        const originalText = button?.textContent || "Post to Buffer";
        if (button) button.disabled = true;
        if (button) button.textContent = "Preparing...";
        try {
          persistProject("Draft");
          const projectId = activeProjectIdRef.current || "current";
          const mediaBlob = state.format === "png" ? await exportPNG({ download: false }) : await exportVideo({ download: false });
          if (!mediaBlob) throw new Error("Could not export media for Buffer.");
          const fileName = state.format === "video" ? `${projectId}-${Date.now()}.mp4` : `${projectId}-${Date.now()}.png`;
          const contentType = mediaBlob.type || (state.format === "video" ? "video/mp4" : "image/png");
          const mediaUrl = await uploadBlobToCloudinary({
            blob: mediaBlob,
            path: `buffer/${projectId}/${fileName}`,
            contentType,
            fileName,
            resourceType: state.format === "video" ? "video" : "image"
          });
          studioDbSnapshot = {
            ...studioDbSnapshot,
            projects: studioDbSnapshot.projects.map((project) =>
              project.id === projectId
                ? {
                    ...project,
                    buffer: {
                      ...(project.buffer || { accountIds: [] }),
                      title: state.title || state.topic || project.title,
                      caption: state.caption || project.caption,
                      tags: state.hashtags,
                      mediaUrl,
                      mediaKind: state.format === "video" ? "video" : "image",
                      mediaType: contentType,
                      fileName,
                      category: "People & Blogs"
                    },
                    updatedAt: new Date().toISOString()
                  }
                : project
            )
          };
          writeLocalDb(studioDbSnapshot);
          if (activeProjectIdRef.current) {
            window.localStorage.setItem("hadith-studio-buffer-pending-project", activeProjectIdRef.current);
          }
          window.location.href = "/buffer";
        } catch (error) {
          console.error("Buffer preparation failed:", error);
          alert(error instanceof Error ? error.message : "Could not prepare media for Buffer.");
        } finally {
          if (button) button.disabled = false;
          if (button) button.textContent = originalText;
        }
      });

      const wheelItemsEl = document.getElementById("wheelItems");
      if (wheelItemsEl) {
        wheelItemsEl.innerHTML = "";
        for (let s = 1; s <= 60; s++) {
          const item = document.createElement("div");
          item.className = `wheel-item${s === state.duration ? " selected" : ""}`;
          item.dataset.val = `${s}`;
          item.textContent = `${s}s`;
          wheelItemsEl.appendChild(item);
        }
      }
      const wheelScroll = document.getElementById("durationWheel");
      wheelScroll?.addEventListener("scroll", () => {
        clearTimeout(scrollDebounce);
        scrollDebounce = setTimeout(() => {
          const idx = Math.round((wheelScroll as HTMLElement).scrollTop / 40);
          const val = Math.min(Math.max(idx + 1, 1), 60);
          setSelectedDuration(val, false);
        }, 90);
      });
      wheelScroll?.addEventListener("scrollend", () => {
        const idx = Math.round((wheelScroll as HTMLElement).scrollTop / 40);
        const val = Math.min(Math.max(idx + 1, 1), 60);
        setSelectedDuration(val, true);
      });
      document.querySelectorAll<HTMLElement>(".wheel-item").forEach((el) => {
        el.addEventListener("click", () => {
          setSelectedDuration(Number(el.dataset.val), true);
        });
      });

      setPreviewHeight(defaultPreviewHeight());
      if (state.format === "video") {
        const videoOptions = document.getElementById("videoOptions") as HTMLElement | null;
        if (videoOptions) videoOptions.style.display = "block";
      }
      const animationStyleSelectEl = document.getElementById("animationStyleSelect") as HTMLSelectElement | null;
      if (animationStyleSelectEl) animationStyleSelectEl.disabled = !state.animationsEnabled;
      updateHint();
      renderAudioTracks();
      renderPreview();
      await ensureFonts();
      renderPreview();

      autosaveTimer = setInterval(() => {
        persistProject("Draft");
        rememberActiveProject();
      }, 30000);
    }

    wireUp().catch((error) => {
      console.error("Studio initialization error:", error);
    });

    const previewResizeHandle = document.getElementById("previewResizeHandle");
    let previewResizeStartY = 0;
    let previewResizeStartHeight = 0;
    function beginPreviewResize(event: PointerEvent) {
      previewResizeStartY = event.clientY;
      previewResizeStartHeight = previewDisplayHeight || defaultPreviewHeight();
      (previewResizeHandle as HTMLElement).setPointerCapture(event.pointerId);
      document.body.style.userSelect = "none";
    }
    function movePreviewResize(event: PointerEvent) {
      if (!(previewResizeHandle as HTMLElement).hasPointerCapture(event.pointerId)) return;
      const delta = event.clientY - previewResizeStartY;
      setPreviewHeight(previewResizeStartHeight + delta);
    }
    function endPreviewResize(event: PointerEvent) {
      if ((previewResizeHandle as HTMLElement).hasPointerCapture(event.pointerId)) {
        (previewResizeHandle as HTMLElement).releasePointerCapture(event.pointerId);
      }
      document.body.style.userSelect = "";
    }
    previewResizeHandle?.addEventListener("pointerdown", beginPreviewResize as EventListener);
    previewResizeHandle?.addEventListener("pointermove", movePreviewResize as EventListener);
    previewResizeHandle?.addEventListener("pointerup", endPreviewResize as EventListener);
    previewResizeHandle?.addEventListener("pointercancel", endPreviewResize as EventListener);
    window.addEventListener("resize", () => {
      setPreviewHeight(previewDisplayHeight || defaultPreviewHeight());
    });

    const currentDownloadBtn = document.getElementById("downloadBtn") as HTMLButtonElement | null;
    const saveStatus = document.getElementById("saveStatus");
    void currentDownloadBtn;
    void saveStatus;

    const beforeUnload = () => {
      persistProject("Draft");
      rememberActiveProject();
    };
    window.addEventListener("beforeunload", beforeUnload);

    return () => {
      if (autosaveTimer) clearInterval(autosaveTimer);
      if (previewAnimationId !== null) cancelAnimationFrame(previewAnimationId);
      window.removeEventListener("beforeunload", beforeUnload);
      stopPreviewAudio();
    };
  }, [templateOptions]);

  return (
    <main className="hadith-app-shell flex min-h-screen flex-col overflow-hidden bg-[#0a0d11] text-[#e8e8e8] lg:flex-row">
      <section className="hadith-panel order-2 flex-1 min-h-0 overflow-y-auto border-t border-[var(--panel-border)] px-4 pb-8 pt-5 lg:order-1 lg:h-screen lg:w-[430px] lg:flex-none lg:border-r lg:border-t-0 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-[980px]">
          <h1 className="font-['Cormorant_Garamond',serif] text-[26px] font-semibold leading-tight text-[var(--gold-soft)]">Hadith Shorts</h1>
          <div className="mb-5 text-[12px] uppercase tracking-[0.04em] text-[var(--text-dim)]">1080 × 1920 · YouTube Shorts / Reels</div>

          <div className="mb-5 rounded-md border border-[rgba(201,162,75,.25)] bg-[rgba(201,162,75,.08)] px-3 py-2 text-[11px] leading-5 text-[#d8b98a]">
            If video export ever shows a "content blocked" message, or the sunnah.com extractor can't fetch a page: open this file directly in a normal browser tab. If fetching still fails, use the paste HTML source fallback below.
          </div>

          <span className="field-label">Choose template</span>
          <div className="template-grid" id="templateGrid" />

          <div id="uploadSection" style={{ display: "none" }}>
            <span className="field-label">Background image / video</span>
            <div className="upload-row">
              <label className="upload-btn" htmlFor="bgUpload">
                Upload media
              </label>
              <input type="file" id="bgUpload" accept="image/*,video/*" />
            </div>
          </div>

          <span className="field-label">Extract from sunnah.com</span>
          <div className="extract-row">
            <Input type="text" id="sunnahUrlInput" placeholder="https://sunnah.com/muslim:11b" />
            <Button className="extract-btn" id="extractBtn" type="button">
              Extract
            </Button>
          </div>
          <div className="extract-status" id="extractStatus" />
          <div className="extract-toggle" id="extractToggle">
            Fetch blocked? Paste the page's HTML source instead →
          </div>
          <div id="pasteHtmlSection" style={{ display: "none" }}>
            <Textarea
              id="pasteHtmlInput"
              placeholder="Right-click the sunnah.com page → View Page Source → Ctrl+A, Ctrl+C → paste here"
              className="mt-2 min-h-[90px] text-[11px] font-mono"
            />
            <Button className="extract-btn mt-2 w-full" id="parsePastedBtn" type="button">
              Parse pasted HTML
            </Button>
          </div>

          <div className="field-head">
            <span className="field-label">Eyebrow / topic (optional)</span>
            <label className="hide-toggle">
              <input type="checkbox" id="hideEyebrowToggle" /> Hide
            </label>
          </div>
          <Input type="text" id="eyebrowInput" placeholder="e.g. On Kindness" />
          <div id="eyebrowEditor" />

          <span className="field-label">Arabic font</span>
          <Select id="arabicFontSelect" defaultValue="amiri">
            <option value="amiri">Amiri — Classic Naskh</option>
            <option value="scheherazade">Scheherazade New — Traditional</option>
            <option value="arefruqaa">Aref Ruqaa — Ruqaa Script</option>
            <option value="reemkufi">Reem Kufi — Modern Kufic</option>
            <option value="lateef">Lateef — Soft Naskh</option>
            <option value="cairo">Cairo — Contemporary</option>
          </Select>
          <div id="arabicEditor" />

          <div className="field-head">
            <span className="field-label">Arabic text</span>
            <label className="hide-toggle">
              <input type="checkbox" id="hideArabicToggle" /> Hide
            </label>
          </div>
          <Textarea id="arabicInput" className="arabic-input" defaultValue="قَالَ رَسُولُ اللَّهِ ﷺ: مَنْ لَا يَرْحَمُ لَا يُرْحَمُ" />

          <span className="field-label">English font</span>
          <Select id="englishFontSelect" defaultValue="cormorant">
            <option value="cormorant">Cormorant Garamond</option>
            <option value="playfair">Playfair Display</option>
            <option value="ebgaramond">EB Garamond</option>
            <option value="lora">Lora</option>
            <option value="libre">Libre Baskerville</option>
            <option value="crimson">Crimson Text</option>
          </Select>
          <div id="englishEditor" />

          <div className="field-head">
            <span className="field-label">English translation</span>
            <label className="hide-toggle">
              <input type="checkbox" id="hideEnglishToggle" /> Hide
            </label>
          </div>
          <Textarea
            id="englishInput"
            className="english-input"
            defaultValue='The Messenger of Allah ﷺ said: "He who does not show mercy will not be shown mercy."'
          />

          <div className="field-head">
            <span className="field-label">Source</span>
            <label className="hide-toggle">
              <input type="checkbox" id="hideSourceToggle" /> Hide
            </label>
          </div>
          <Input type="text" id="sourceInput" defaultValue="Sahih al-Bukhari 6013" />
          <div id="sourceEditor" />

          <span className="field-label">Copyright / watermark</span>
          <Input type="text" id="watermarkInput" placeholder="© Nayeem / @nayeem" defaultValue="" />

          <span className="field-label">Export format</span>
          <div className="format-toggle">
            <div className="format-opt active" data-format="png">
              PNG image
            </div>
            <div className="format-opt" data-format="video">
              Video
            </div>
          </div>

          <div id="videoOptions" style={{ display: "none" }}>
            <span className="field-label">Video duration (seconds)</span>
            <div className="wheel-outer">
              <div className="wheel-fade-top" />
              <div className="wheel-fade-bottom" />
              <div className="wheel-highlight" />
              <div className="wheel-scroll" id="durationWheel">
                <div className="wheel-spacer" />
                <div id="wheelItems" />
                <div className="wheel-spacer" />
              </div>
            </div>
            <div className="video-tools">
              <div className="video-tools-row">
                <label className="inline-toggle">
                  <input type="checkbox" id="animationToggle" defaultChecked /> Animations
                </label>
                <div>
                  <span className="field-label" style={{ margin: 0, marginBottom: 8 }}>
                    Animation style
                  </span>
                  <Select id="animationStyleSelect" defaultValue="revealZoom">
                    <option value="revealZoom">Text reveal + slow zoom</option>
                    <option value="fade">Soft fade in</option>
                    <option value="slideUp">Slide up text</option>
                    <option value="slowZoom">Still text + slow zoom</option>
                    <option value="cinematic">Cinematic reveal</option>
                  </Select>
                </div>
              </div>
              <div className="preview-controls">
                <Button className="extract-btn" id="previewPlayBtn" type="button">
                  Play Preview
                </Button>
                <button className="preview-stop-btn" id="previewStopBtn" type="button">
                  Stop
                </button>
                <div className="preview-time" id="previewTime">
                  0.0s / 8s
                </div>
              </div>
              <div className="progress-wrap preview-progress">
                <div className="progress-bar" id="previewProgressBar" />
              </div>
            </div>
            <div className="audio-tools">
              <div className="audio-head">
                <div className="audio-title">Audio tracks</div>
                <label className="audio-add-btn">
                  Add audio
                  <input type="file" id="audioUpload" accept="audio/*" multiple />
                </label>
              </div>
              <div id="audioTrackList">
                <div className="audio-empty">Add music, voiceover, or sound effects. Each track can be trimmed and positioned on the video timeline.</div>
              </div>
              <div className="audio-note">Audio is mixed into video exports and plays during live preview. Start is video time; trim in/out is the section used from the audio file.</div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Button className="download-btn" id="downloadBtn" type="button">
              Download PNG
            </Button>
            <div className="flex gap-3">
              <Button id="saveDraftBtn" type="button" variant="outline" className="flex-1">
                Save Draft
              </Button>
              <Button id="postToBufferBtn" type="button" variant="secondary" className="flex-1">
                Post to Buffer
              </Button>
            </div>
          </div>
          <div className="progress-wrap" id="progressWrap">
            <div className="progress-bar" id="progressBar" />
          </div>
          <div className="hint" id="hintText">
            Renders at full 1080×1920. Import the PNG into CapCut/Premiere/InShot to add motion, voiceover, or a slow zoom for the Short.
          </div>
          <div className="mt-2 text-xs text-[var(--text-dim)]" id="saveStatus" />
        </div>
      </section>

      <section className="hadith-stage order-1 flex items-center justify-center border-b border-[rgba(255,255,255,.06)] p-4 shadow-stage lg:order-2 lg:flex-1 lg:border-b-0 lg:p-6">
        <div ref={previewShellRef} className="preview-shell w-full max-w-full">
          <div className="frame-wrap shadow-frame">
            <canvas ref={canvasRef} id="previewCanvas" width={1080} height={1920} className="block aspect-[9/16] w-full rounded-[4px] bg-black" />
          </div>
          <div className="preview-resize-handle" id="previewResizeHandle" title="Drag to resize preview" />
        </div>
      </section>
    </main>
  );
}

"use client";

import { RouteShell } from "@/components/studio/RouteShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useStudioDb } from "@/hooks/use-studio-db";
import { defaultSettings } from "@/lib/persistence";

export default function SettingsPage() {
  const { db, setDb, ready } = useStudioDb();
  const settings = db.settings || defaultSettings();

  function updateSetting(path: string, value: string | number | boolean) {
    setDb((current) => {
      const next = structuredClone(current);
      const creator = next.settings.creator;
      switch (path) {
        case "creatorName":
          creator.creatorName = String(value);
          break;
        case "watermarkText":
          creator.watermarkText = String(value);
          break;
        case "watermarkOpacity":
          creator.watermarkOpacity = Number(value);
          break;
        case "watermarkFont":
          creator.watermarkFont = String(value);
          break;
        case "watermarkSize":
          creator.watermarkSize = Number(value);
          break;
        case "watermarkPosition":
          creator.watermarkPosition = value as typeof creator.watermarkPosition;
          break;
        default:
          break;
      }
      return next;
    });
  }

  function resetDefaults() {
    setDb((current) => ({ ...current, settings: defaultSettings() }));
  }

  return (
    <RouteShell title="Settings" description="Watermark, creator name, and integration status.">
      {!ready ? <div className="text-sm text-[var(--text-dim)]">Loading settings…</div> : null}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-[var(--panel-border)] bg-[#11161d] xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-[var(--gold-soft)]">Watermark</CardTitle>
            <CardDescription>Rendered onto exported images and videos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Input value={settings.creator.creatorName} onChange={(event) => updateSetting("creatorName", event.target.value)} placeholder="Creator name" />
            <Input value={settings.creator.watermarkText} onChange={(event) => updateSetting("watermarkText", event.target.value)} placeholder="© Nayeem / @nayeem" />
            <label className="space-y-2 text-sm">
              <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Opacity</span>
              <Input type="number" min="0" max="1" step="0.05" value={settings.creator.watermarkOpacity} onChange={(event) => updateSetting("watermarkOpacity", event.target.value)} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Font</span>
              <Select value={settings.creator.watermarkFont} onChange={(event) => updateSetting("watermarkFont", event.target.value)}>
                <option value="Jost">Jost</option>
                <option value="Cormorant Garamond">Cormorant Garamond</option>
                <option value="Playfair Display">Playfair Display</option>
                <option value="Amiri">Amiri</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Size</span>
              <Input type="number" min="12" max="72" value={settings.creator.watermarkSize} onChange={(event) => updateSetting("watermarkSize", event.target.value)} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Position</span>
              <Select value={settings.creator.watermarkPosition} onChange={(event) => updateSetting("watermarkPosition", event.target.value)}>
                <option value="top-left">Top left</option>
                <option value="top-right">Top right</option>
                <option value="bottom-left">Bottom left</option>
                <option value="bottom-right">Bottom right</option>
                <option value="center">Center</option>
              </Select>
            </label>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Badge>MongoDB: server env required</Badge>
              <Badge>Cloudinary: server env required</Badge>
              <Badge>Buffer: server env required</Badge>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button onClick={resetDefaults}>Reset Defaults</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--panel-border)] bg-[#11161d]">
          <CardHeader>
            <CardTitle className="text-[var(--gold-soft)]">Configuration</CardTitle>
            <CardDescription>Runtime environment values are read from `process.env`.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--text-dim)]">
            <div>Creator: {settings.creator.creatorName}</div>
            <div>Watermark: {settings.creator.watermarkText}</div>
            <div>Opacity: {settings.creator.watermarkOpacity}</div>
            <div>Font: {settings.creator.watermarkFont}</div>
            <div>Position: {settings.creator.watermarkPosition}</div>
          </CardContent>
        </Card>
      </div>
    </RouteShell>
  );
}

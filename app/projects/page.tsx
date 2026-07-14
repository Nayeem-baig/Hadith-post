"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RouteShell } from "@/components/studio/RouteShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStudioDb } from "@/hooks/use-studio-db";
import { createProjectFromEditor, editorFromProject, type EditorState } from "@/lib/project";
import { upsertProject } from "@/lib/persistence";
import type { HadithProject } from "@/types/studio";

export default function ProjectsPage() {
  const router = useRouter();
  const { db, setDb, ready } = useStudioDb();
  const [search, setSearch] = useState("");

  const projects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...db.projects].filter((project) => {
      if (!term) return true;
      return [project.title, project.source, project.topic, project.template, project.status].some((field) => field.toLowerCase().includes(term));
    });
  }, [db.projects, search]);

  function openProject(project: HadithProject) {
    window.localStorage.setItem("hadith-studio-active-project-id", project.id);
    router.push("/");
  }

  function saveProject(project: HadithProject) {
    setDb((current) => upsertProject(current, { ...project, updatedAt: new Date().toISOString() }));
  }

  function duplicateProject(project: HadithProject) {
    const duplicate = createProjectFromEditor({ state: editorFromProject(project) as EditorState, existing: { ...project, id: undefined, title: `${project.title} Copy` } });
    duplicate.id = `project-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    duplicate.title = `${project.title} Copy`;
    duplicate.filename = duplicate.filename.replace(/(\.[^.]+)$/u, "-copy$1");
    duplicate.status = "Draft";
    duplicate.favorite = false;
    duplicate.createdAt = new Date().toISOString();
    duplicate.updatedAt = duplicate.createdAt;
    setDb((current) => upsertProject(current, duplicate));
  }

  function removeProject(id: string) {
    setDb((current) => ({ ...current, projects: current.projects.filter((project) => project.id !== id) }));
  }

  function toggleFavorite(id: string) {
    setDb((current) => ({
      ...current,
      projects: current.projects.map((project) => (project.id === id ? { ...project, favorite: !project.favorite } : project))
    }));
  }

  function saveCurrentAsDraft(project: HadithProject) {
    const next = { ...project, status: "Draft" as const, updatedAt: new Date().toISOString() };
    saveProject(next);
  }

  function postAgain(project: HadithProject) {
    window.localStorage.setItem("hadith-studio-buffer-pending-project", project.id);
    router.push("/buffer");
  }

  function restoreVersion(project: HadithProject, versionId: string) {
    const version = project.versions.find((item) => item.id === versionId);
    if (!version) return;
    setDb((current) => ({
      ...current,
      projects: current.projects.map((item) =>
        item.id === project.id
          ? {
              ...version.data,
              id: project.id,
              versions: project.versions,
              updatedAt: new Date().toISOString()
            }
          : item
      )
    }));
  }

  return (
    <RouteShell title="Content Library" description="Saved projects, drafts, exported versions, and restore history.">
      <div className="grid gap-4">
        <Card className="border-[var(--panel-border)] bg-[#11161d]">
          <CardHeader>
            <CardTitle className="text-[var(--gold-soft)]">Projects</CardTitle>
            <CardDescription>Every save is preserved locally and can be synced to MongoDB once configured.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects" />
            {!ready ? <div className="text-sm text-[var(--text-dim)]">Loading library…</div> : null}
            {projects.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {projects.map((project) => (
                  <Card key={project.id} className="border-[var(--panel-border)] bg-[#0d1116]">
                    <CardHeader className="space-y-2 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{project.title}</CardTitle>
                          <CardDescription className="text-xs">{project.source}</CardDescription>
                        </div>
                        <Badge>{project.status}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-[var(--text-dim)]">
                        <span>{project.template}</span>
                        <span>{project.format.toUpperCase()}</span>
                        <span>{new Date(project.updatedAt).toLocaleString()}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => openProject(project)}>Open</Button>
                        <Button size="sm" variant="secondary" onClick={() => saveCurrentAsDraft(project)}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => duplicateProject(project)}>Duplicate</Button>
                        <Button size="sm" variant={project.favorite ? "default" : "ghost"} onClick={() => toggleFavorite(project.id)}>
                          {project.favorite ? "★ Unfavorite" : "★ Favorite"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => saveCurrentAsDraft(project)}>Save Draft</Button>
                        <Button size="sm" variant="outline" onClick={() => postAgain(project)}>Post Again</Button>
                        <Button size="sm" variant="outline" onClick={() => restoreVersion(project, project.versions[0]?.id || "")} disabled={!project.versions.length}>
                          Restore Latest
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => removeProject(project.id)}>Delete</Button>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Filename</p>
                        <p className="break-all rounded-md border border-[var(--panel-border)] bg-[#11161d] px-3 py-2 text-sm">{project.filename}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-dim)]">Versions</p>
                        <div className="flex flex-wrap gap-2">
                          {project.versions.slice(0, 3).map((version) => (
                            <button
                              key={version.id}
                              type="button"
                              className="rounded-full border border-[var(--panel-border)] bg-[#11161d] px-3 py-1 text-xs text-[#d8dce2] hover:border-[var(--gold)]"
                              onClick={() => restoreVersion(project, version.id)}
                            >
                              {version.label} · {new Date(version.createdAt).toLocaleDateString()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[#0d1116] px-4 py-8 text-sm text-[var(--text-dim)]">
                No projects saved yet. Open the editor and use Save Draft or export a video/image.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RouteShell>
  );
}

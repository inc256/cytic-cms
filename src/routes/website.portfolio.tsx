import { createFileRoute } from "@tanstack/react-router";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWebsiteRows } from "@/hooks/use-website-rows";
import {
  deleteWebsiteImages,
  deleteWebsiteRow,
  getWebsiteImageUrl,
  PORTFOLIO_IMAGE_BUCKET,
  saveWebsiteRow,
  slugify,
  uploadWebsiteImage,
  type PortfolioProject,
} from "@/lib/website-cms";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/portfolio")({
  head: () => meta("Portfolio", "Manage portfolio projects and images."),
  component: Page,
});

const EMPTY_FORM = {
  title: "",
  slug: "",
  project_url: "",
  service: "",
  year: String(new Date().getFullYear()),
  summary: "",
  description: "",
  featured: false,
  status: "Draft",
};

type PortfolioImageItem =
  { id: string; kind: "existing"; path: string } | { id: string; kind: "new"; file: File };

function Page() {
  const {
    rows: projects,
    loading,
    error,
    refresh,
  } = useWebsiteRows<PortfolioProject>("cms_portfolio_projects");
  const [editing, setEditing] = useState<PortfolioProject | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageItems, setImageItems] = useState<PortfolioImageItem[]>([]);
  const [saving, setSaving] = useState(false);

  const startNew = () => {
    setEditing(null);
    setImageItems([]);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const startEdit = (project: PortfolioProject) => {
    setEditing(project);
    setImageItems(
      project.image_paths.map((path) => ({
        id: crypto.randomUUID(),
        kind: "existing",
        path,
      })),
    );
    setForm({
      title: project.title,
      slug: project.slug,
      project_url: project.project_url ?? "",
      service: project.service,
      year: String(project.year),
      summary: project.summary,
      description: project.description,
      featured: project.featured,
      status: project.status,
    });
    setOpen(true);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.service.trim()) {
      toast.error("Project title and service are required.");
      return;
    }
    if (imageItems.length === 0) {
      toast.error("Upload at least one project image.");
      return;
    }
    const projectUrl = form.project_url.trim();
    if (projectUrl) {
      try {
        const parsedUrl = new URL(projectUrl);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          throw new Error("Use a URL starting with http:// or https://.");
        }
      } catch (urlError) {
        toast.error(
          urlError instanceof Error && urlError.message.startsWith("Use a URL")
            ? urlError.message
            : "Enter a valid project URL or leave it blank.",
        );
        return;
      }
    }
    const year = Number(form.year);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
      toast.error("Enter a valid project year.");
      return;
    }
    setSaving(true);
    const uploaded: string[] = [];
    try {
      const orderedImagePaths: string[] = [];
      for (const item of imageItems) {
        if (item.kind === "existing") {
          orderedImagePaths.push(item.path);
        } else {
          const path = await uploadWebsiteImage(PORTFOLIO_IMAGE_BUCKET, item.file);
          uploaded.push(path);
          orderedImagePaths.push(path);
        }
      }
      const values = {
        title: form.title.trim(),
        slug: slugify(form.slug || form.title),
        project_url: projectUrl || null,
        service: form.service.trim(),
        year,
        summary: form.summary.trim(),
        description: form.description.trim(),
        image_paths: orderedImagePaths,
        featured: form.featured,
        status: form.status,
      };
      if (!values.slug) throw new Error("Add a title that can be used as a URL slug.");
      await saveWebsiteRow("cms_portfolio_projects", values, editing?.id);
      const retainedPaths = new Set(orderedImagePaths);
      const removedImages = editing?.image_paths.filter((path) => !retainedPaths.has(path)) ?? [];
      if (removedImages.length) {
        try {
          await deleteWebsiteImages(PORTFOLIO_IMAGE_BUCKET, removedImages);
        } catch (cleanupError) {
          toast.error(
            `Project saved, but removed images could not be deleted: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          );
        }
      }
      toast.success(editing ? "Portfolio project updated" : "Portfolio project created");
      setOpen(false);
      await refresh();
    } catch (saveError) {
      if (uploaded.length) {
        try {
          await deleteWebsiteImages(PORTFOLIO_IMAGE_BUCKET, uploaded);
        } catch (cleanupError) {
          toast.error(
            `Uploaded images could not be cleaned up: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          );
        }
      }
      toast.error(
        `Could not save portfolio project: ${saveError instanceof Error ? saveError.message : String(saveError)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const addImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []).filter((file) => file.size > 0);
    if (files.length) {
      setImageItems((current) => [
        ...current,
        ...files.map((file) => ({ id: crypto.randomUUID(), kind: "new" as const, file })),
      ]);
    }
    event.currentTarget.value = "";
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setImageItems((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      return reordered;
    });
  };

  const remove = async (project: PortfolioProject) => {
    try {
      await deleteWebsiteRow("cms_portfolio_projects", project.id);
      try {
        await deleteWebsiteImages(PORTFOLIO_IMAGE_BUCKET, project.image_paths);
      } catch (cleanupError) {
        toast.error(
          `Project deleted, but its images could not be removed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
      toast.success("Portfolio project deleted");
      await refresh();
    } catch (removeError) {
      toast.error(
        `Could not delete portfolio project: ${removeError instanceof Error ? removeError.message : String(removeError)}`,
      );
    }
  };

  return (
    <>
      <PageHeader
        title="Portfolio"
        description="Manage your portfolio projects. Each project needs at least one image; a link to the live project is optional."
        actions={
          <Button size="sm" onClick={startNew}>
            <Plus className="size-4" /> New project
          </Button>
        }
      />
      <AnalyticsState loading={loading} error={error} onRetry={() => void refresh()} />
      {!loading &&
        !error &&
        (projects.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <article
                key={project.id}
                className="overflow-hidden rounded-lg border bg-card shadow-soft"
              >
                <img
                  src={getWebsiteImageUrl(PORTFOLIO_IMAGE_BUCKET, project.image_paths[0])}
                  alt={project.title}
                  className="aspect-[16/10] w-full object-cover"
                />
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold">{project.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {project.service} · {project.year}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs">
                      {project.status}
                    </span>
                  </div>
                  {project.featured && (
                    <span className="text-xs font-medium text-primary">Featured</span>
                  )}
                  <p className="line-clamp-2 text-sm text-muted-foreground">{project.summary}</p>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {project.image_paths.length} image
                      {project.image_paths.length === 1 ? "" : "s"}
                    </span>
                    <span>/{project.slug}</span>
                  </div>
                  {project.project_url && (
                    <a
                      href={project.project_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-sm font-medium text-primary underline underline-offset-4"
                    >
                      View live project
                    </a>
                  )}
                  <div className="flex justify-end gap-2 border-t pt-3">
                    <Button size="sm" variant="outline" onClick={() => startEdit(project)}>
                      <Pencil className="size-4" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void remove(project)}>
                      <Trash2 className="size-4" /> Delete
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            No portfolio projects yet. Add a project and upload its images.
          </p>
        ))}

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="presentation"
        >
          <form
            onSubmit={(event) => void save(event)}
            className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-background p-6 shadow-xl"
            aria-label={editing ? "Edit project" : "New project"}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">
                {editing ? "Edit project" : "New project"}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="portfolio-title">Project title *</Label>
                <Input
                  id="portfolio-title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="portfolio-slug">URL slug</Label>
                <Input
                  id="portfolio-slug"
                  value={form.slug}
                  onChange={(event) => setForm({ ...form, slug: event.target.value })}
                  placeholder={slugify(form.title)}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="portfolio-project-url">Project URL (optional)</Label>
                <Input
                  id="portfolio-project-url"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://example.com/project"
                  value={form.project_url}
                  onChange={(event) => setForm({ ...form, project_url: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="portfolio-service">Service *</Label>
                <Input
                  id="portfolio-service"
                  value={form.service}
                  onChange={(event) => setForm({ ...form, service: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="portfolio-year">Year *</Label>
                <Input
                  id="portfolio-year"
                  type="number"
                  min="1900"
                  max="2200"
                  value={form.year}
                  onChange={(event) => setForm({ ...form, year: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="portfolio-summary">Summary</Label>
                <Input
                  id="portfolio-summary"
                  value={form.summary}
                  onChange={(event) => setForm({ ...form, summary: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="portfolio-description">Project description</Label>
                <Textarea
                  id="portfolio-description"
                  rows={5}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="portfolio-status">Status</Label>
                <select
                  id="portfolio-status"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                >
                  {["Draft", "In review", "Published"].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) => setForm({ ...form, featured: event.target.checked })}
                />
                Feature this project
              </label>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="portfolio-images">
                  Project images * (select multiple images or add more; upload order is retained)
                </Label>
                <Input
                  id="portfolio-images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={addImages}
                />
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, WebP or GIF; up to 10 MB each. Use the arrows below to set their final
                  order.
                </p>
              </div>
            </div>
            {imageItems.length > 0 && (
              <ol className="space-y-2" aria-label="Project image upload order">
                {imageItems.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-md border bg-card p-2"
                  >
                    {item.kind === "existing" ? (
                      <img
                        src={getWebsiteImageUrl(PORTFOLIO_IMAGE_BUCKET, item.path)}
                        alt=""
                        className="size-12 rounded object-cover"
                      />
                    ) : (
                      <div
                        className="grid size-12 shrink-0 place-items-center rounded bg-muted text-xs text-muted-foreground"
                        aria-hidden="true"
                      >
                        IMG
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Image {index + 1}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.kind === "new" ? item.file.name : `Saved image ${index + 1}`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Move image ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => moveImage(index, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Move image ${index + 1} down`}
                      disabled={index === imageItems.length - 1}
                      onClick={() => moveImage(index, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove image ${index + 1}`}
                      onClick={() =>
                        setImageItems((current) => current.filter((image) => image.id !== item.id))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ol>
            )}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                <ImagePlus className="size-4" /> {saving ? "Saving…" : "Save project"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

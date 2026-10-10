import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
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
  head: () => meta("Portfolio & Case Studies", "Manage live case studies and project images."),
  component: Page,
});

const EMPTY_FORM = {
  title: "",
  slug: "",
  service: "",
  year: String(new Date().getFullYear()),
  summary: "",
  description: "",
  featured: false,
  status: "Draft",
};

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
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const startNew = () => {
    setEditing(null);
    setImagePaths([]);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const startEdit = (project: PortfolioProject) => {
    setEditing(project);
    setImagePaths(project.image_paths);
    setForm({
      title: project.title,
      slug: project.slug,
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
    const files = Array.from(new FormData(event.currentTarget).getAll("images")).filter(
      (value): value is File => value instanceof File && value.size > 0,
    );
    if (!imagePaths.length && !files.length) {
      toast.error("Upload at least one project image.");
      return;
    }
    const year = Number(form.year);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
      toast.error("Enter a valid project year.");
      return;
    }
    setSaving(true);
    const uploaded: string[] = [];
    try {
      for (const file of files)
        uploaded.push(await uploadWebsiteImage(PORTFOLIO_IMAGE_BUCKET, file));
      const values = {
        title: form.title.trim(),
        slug: slugify(form.slug || form.title),
        service: form.service.trim(),
        year,
        summary: form.summary.trim(),
        description: form.description.trim(),
        image_paths: [...imagePaths, ...uploaded],
        featured: form.featured,
        status: form.status,
      };
      if (!values.slug) throw new Error("Add a title that can be used as a URL slug.");
      await saveWebsiteRow("cms_portfolio_projects", values, editing?.id);
      const removedImages = editing?.image_paths.filter((path) => !imagePaths.includes(path)) ?? [];
      if (removedImages.length) {
        try {
          await deleteWebsiteImages(PORTFOLIO_IMAGE_BUCKET, removedImages);
        } catch (cleanupError) {
          toast.error(
            `Project saved, but removed images could not be deleted: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          );
        }
      }
      toast.success(editing ? "Case study updated" : "Case study created");
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
        `Could not save case study: ${saveError instanceof Error ? saveError.message : String(saveError)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (project: PortfolioProject) => {
    try {
      await deleteWebsiteRow("cms_portfolio_projects", project.id);
      try {
        await deleteWebsiteImages(PORTFOLIO_IMAGE_BUCKET, project.image_paths);
      } catch (cleanupError) {
        toast.error(
          `Case study deleted, but its images could not be removed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
      toast.success("Case study deleted");
      await refresh();
    } catch (removeError) {
      toast.error(
        `Could not delete case study: ${removeError instanceof Error ? removeError.message : String(removeError)}`,
      );
    }
  };

  return (
    <>
      <PageHeader
        title="Portfolio & Case Studies"
        description="Manage live case studies. Every project requires at least one image stored in Supabase Storage."
        actions={
          <Button size="sm" onClick={startNew}>
            <Plus className="size-4" /> New case study
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
            No portfolio projects yet. Create a case study and upload its images.
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
            aria-label={editing ? "Edit case study" : "New case study"}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">
                {editing ? "Edit case study" : "New case study"}
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
                <Label htmlFor="portfolio-description">Case study</Label>
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
                  Project images * (JPEG, PNG, WebP or GIF; up to 10 MB each)
                </Label>
                <Input
                  id="portfolio-images"
                  name="images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                />
              </div>
            </div>
            {imagePaths.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {imagePaths.map((path) => (
                  <div key={path} className="relative">
                    <img
                      src={getWebsiteImageUrl(PORTFOLIO_IMAGE_BUCKET, path)}
                      alt="Project"
                      className="aspect-square w-full rounded-md object-cover"
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-background p-1"
                      onClick={() => setImagePaths(imagePaths.filter((item) => item !== path))}
                      aria-label="Remove image"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                <ImagePlus className="size-4" /> {saving ? "Saving…" : "Save case study"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

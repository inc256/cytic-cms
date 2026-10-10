import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  BookOpen,
  Check,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-context";
import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader, Panel } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseClient } from "@/lib/supabase";
import {
  deleteWorkspaceRow,
  getWorkspaceFileUrl,
  removeWorkspaceFiles,
  safeExternalUrl,
  saveWorkspaceRow,
  uploadWorkspaceFile,
  isWorkspaceStatus,
  type WorkspaceAcknowledgement,
  type WorkspaceCategory,
  type WorkspaceDocument,
  type WorkspaceNotice,
  type WorkspaceResource,
  type WorkspaceStatus,
  type WorkspaceType,
} from "@/lib/designer-workspace";

const LINKS: { type: WorkspaceType; label: string; to: string }[] = [
  { type: "guideline", label: "Guidelines & Handbook", to: "/designer-workspace/guidelines" },
  { type: "procedure", label: "Work Procedures", to: "/designer-workspace/procedures" },
  { type: "policy", label: "Rules & Policies", to: "/designer-workspace/policies" },
  { type: "checklist", label: "Quality Checklist", to: "/designer-workspace/checklist" },
  { type: "resource", label: "Resources & Templates", to: "/designer-workspace/resources" },
  { type: "learning", label: "Learning & Development", to: "/designer-workspace/learning" },
  { type: "notice", label: "Notices & Updates", to: "/designer-workspace/notices" },
];

const TITLES: Record<WorkspaceType, string> = {
  guideline: "Guidelines & Handbook",
  procedure: "Work Procedures",
  policy: "Rules & Policies",
  checklist: "Quality Checklist",
  resource: "Resources & Templates",
  learning: "Learning & Development",
  notice: "Notices & Updates",
};

function useWorkspaceAuth() {
  const { state } = useAuth();
  const role = state.status === "signed-in" ? state.role : null;
  return {
    role,
    userId: state.status === "signed-in" ? state.user.id : null,
    isManager: role === "CEO" || role === "CONTENT EDITOR",
    isCeo: role === "CEO",
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function routeForType(type: WorkspaceType) {
  return LINKS.find((item) => item.type === type)?.to ?? "/designer-workspace";
}

function textDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

function State({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string | null;
  retry: () => void;
}) {
  return <AnalyticsState loading={loading} error={error} onRetry={retry} />;
}

function WorkspaceCategoryControls({
  categories,
  onChanged,
}: {
  categories: WorkspaceCategory[];
  onChanged: () => Promise<void>;
}) {
  const rename = async (category: WorkspaceCategory) => {
    const value = window.prompt("Rename category", category.name);
    const name = value?.trim();
    if (!name || name === category.name) return;
    try {
      await saveWorkspaceRow("cms_workspace_categories", { name }, category.id);
      toast.success("Category renamed");
      await onChanged();
    } catch (renameError) {
      toast.error(`Could not rename category: ${errorMessage(renameError)}`);
    }
  };
  const remove = async (category: WorkspaceCategory) => {
    if (
      !window.confirm(
        `Delete "${category.name}"? Items in this category will become uncategorized.`,
      )
    ) {
      return;
    }
    try {
      await deleteWorkspaceRow("cms_workspace_categories", category.id);
      toast.success("Category deleted");
      await onChanged();
    } catch (deleteError) {
      toast.error(`Could not delete category: ${errorMessage(deleteError)}`);
    }
  };
  if (!categories.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <span
          key={category.id}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
        >
          {category.name}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Rename ${category.name}`}
            onClick={() => void rename(category)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Delete ${category.name}`}
            onClick={() => void remove(category)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </span>
      ))}
    </div>
  );
}

export function DesignerWorkspaceOverview() {
  const { role, userId, isManager } = useWorkspaceAuth();
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [categories, setCategories] = useState<WorkspaceCategory[]>([]);
  const [notices, setNotices] = useState<WorkspaceNotice[]>([]);
  const [resources, setResources] = useState<WorkspaceResource[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<WorkspaceAcknowledgement[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const results = await Promise.all([
      supabase
        .from("cms_workspace_documents")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase.from("cms_workspace_categories").select("*").order("sort_order"),
      supabase
        .from("cms_workspace_notices")
        .select("*")
        .order("published_at", { ascending: false }),
      supabase
        .from("cms_workspace_resources")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("cms_workspace_acknowledgements")
        .select("document_id,document_version,user_id,acknowledged_at")
        .order("acknowledged_at", { ascending: false }),
    ]);
    const failure = results.find((result) => result.error)?.error;
    if (failure) {
      setError(failure.message);
      setLoading(false);
      return;
    }
    setDocuments((results[0].data ?? []) as WorkspaceDocument[]);
    setCategories((results[1].data ?? []) as WorkspaceCategory[]);
    setNotices((results[2].data ?? []) as WorkspaceNotice[]);
    setResources((results[3].data ?? []) as WorkspaceResource[]);
    setAcknowledgements((results[4].data ?? []) as WorkspaceAcknowledgement[]);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentDocs = useMemo(
    () => documents.filter((doc) => doc.status === "Published"),
    [documents],
  );
  const unreadMandatory =
    role === "DESIGNER"
      ? currentDocs.filter(
          (doc) =>
            doc.mandatory_reading &&
            !acknowledgements.some(
              (ack) =>
                ack.document_id === doc.id &&
                ack.user_id === userId &&
                (!doc.require_renewed_acknowledgement || ack.document_version === doc.version),
            ),
        )
      : [];
  const visibleNotices = notices.filter((notice) => {
    if (notice.status !== "Published") return false;
    if (
      notice.expires_at &&
      !notice.show_after_expiry &&
      notice.expires_at < new Date().toISOString()
    ) {
      return false;
    }
    return isManager || (role !== null && notice.audience_roles.includes(role));
  });
  const searchable = [
    ...currentDocs.map((doc) => ({
      title: doc.title,
      summary: doc.summary,
      to: routeForType(doc.workspace_type),
    })),
    ...resources
      .filter((resource) => resource.status === "Published")
      .map((item) => ({
        title: item.name,
        summary: item.description,
        to: routeForType("resource"),
      })),
  ].filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(query.toLowerCase()));

  const acknowledge = async (doc: WorkspaceDocument) => {
    const supabase = getSupabaseClient();
    if (!supabase) return toast.error("Supabase is not configured.");
    const result = await supabase.from("cms_workspace_acknowledgements").insert({
      document_id: doc.id,
      document_version: doc.version,
      user_id: userId,
    });
    if (result.error) return toast.error(`Could not save acknowledgement: ${result.error.message}`);
    toast.success("Acknowledgement recorded");
    await load();
  };

  const learnings = currentDocs.filter((doc) => doc.workspace_type === "learning").slice(0, 4);
  const managerStats = {
    drafts: documents.filter((doc) => ["Draft", "In review"].includes(doc.status)).length,
    published: documents.filter((doc) => doc.status === "Published").length,
    mandatoryReading: documents.filter((doc) => doc.mandatory_reading && doc.status === "Published")
      .length,
  };

  return (
    <>
      <PageHeader
        eyebrow="CYTIC Creatives"
        title="Designer Workspace"
        description="The internal handbook, procedures, tools, and updates designers need to do their best work."
      />
      <State loading={loading} error={error} retry={() => void load()} />
      {!loading && !error && (
        <div className="space-y-6">
          {isManager && (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Drafts / in review", managerStats.drafts],
                ["Published documents", managerStats.published],
                ["Mandatory reading", managerStats.mandatoryReading],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 font-display text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          )}

          <Panel title="Find guidance">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
                placeholder="Search guides, procedures, resources…"
                aria-label="Search Designer Workspace"
              />
            </div>
            {query && (
              <ul className="mt-3 divide-y">
                {searchable.map((item) => (
                  <li key={`${item.to}-${item.title}`} className="py-2">
                    <Link className="font-medium text-primary hover:underline" to={item.to}>
                      {item.title}
                    </Link>
                    {item.summary && (
                      <p className="text-sm text-muted-foreground">{item.summary}</p>
                    )}
                  </li>
                ))}
                {!searchable.length && (
                  <li className="py-3 text-sm text-muted-foreground">
                    No published content matches your search.
                  </li>
                )}
              </ul>
            )}
          </Panel>

          {unreadMandatory.length > 0 && (
            <Panel
              title="Required reading"
              description="Please read and acknowledge the current version of each required document."
            >
              <ul className="divide-y">
                {unreadMandatory.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="font-medium">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Version {doc.version} · {doc.workspace_type}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => void acknowledge(doc)}>
                      Mark as read
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {LINKS.map((item) => {
              const count =
                item.type === "resource"
                  ? resources.filter((r) => r.status === "Published").length
                  : item.type === "notice"
                    ? visibleNotices.length
                    : currentDocs.filter((doc) => doc.workspace_type === item.type).length;
              const categoryCount = categories.filter(
                (category) => category.workspace_type === item.type,
              ).length;
              return (
                <Link
                  key={item.type}
                  to={item.to}
                  className="rounded-lg border bg-card p-5 shadow-soft transition hover:border-primary/40 hover:bg-primary-subtle"
                >
                  <BookOpen className="size-5 text-primary" />
                  <h2 className="mt-3 font-display font-semibold">{item.label}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {count} published item{count === 1 ? "" : "s"} · {categoryCount} categor
                    {categoryCount === 1 ? "y" : "ies"}
                  </p>
                </Link>
              );
            })}
          </div>

          {visibleNotices.some((notice) => notice.pinned) && (
            <Panel title="Pinned notices">
              <div className="space-y-3">
                {visibleNotices
                  .filter((notice) => notice.pinned)
                  .slice(0, 3)
                  .map((notice) => (
                    <article key={notice.id} className="rounded-md border p-3">
                      <p className="font-medium">{notice.title}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {notice.message}
                      </p>
                    </article>
                  ))}
              </div>
            </Panel>
          )}

          {learnings.length > 0 && (
            <Panel title="Recommended learning">
              <ul className="divide-y">
                {learnings.map((item) => (
                  <li key={item.id} className="py-2">
                    <Link
                      className="font-medium text-primary hover:underline"
                      to={routeForType("learning")}
                    >
                      {item.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">{item.summary}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {isManager && (
            <Panel
              title="Acknowledgement activity"
              description="Latest acknowledgements, with document version and timestamp."
            >
              {acknowledgements.length ? (
                <ul className="divide-y">
                  {acknowledgements.slice(0, 10).map((ack) => {
                    const doc = documents.find((item) => item.id === ack.document_id);
                    return (
                      <li
                        key={`${ack.document_id}-${ack.user_id}-${ack.document_version}`}
                        className="flex flex-wrap justify-between gap-2 py-2 text-sm"
                      >
                        <span>
                          {doc?.title ?? "Document"} · v{ack.document_version}
                        </span>
                        <span className="text-muted-foreground">
                          {ack.user_id} · {new Date(ack.acknowledged_at).toLocaleString()}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No acknowledgements recorded yet.</p>
              )}
            </Panel>
          )}
        </div>
      )}
    </>
  );
}

type DocumentForm = {
  title: string;
  summary: string;
  content: string;
  category_id: string;
  status: WorkspaceStatus;
  mandatory_reading: boolean;
  require_renewed_acknowledgement: boolean;
  objectives: string;
  external_url: string;
};

const EMPTY_DOCUMENT: DocumentForm = {
  title: "",
  summary: "",
  content: "",
  category_id: "",
  status: "Draft",
  mandatory_reading: false,
  require_renewed_acknowledgement: false,
  objectives: "",
  external_url: "",
};

export function WorkspaceDocumentLibrary({
  type,
}: {
  type: Exclude<WorkspaceType, "resource" | "notice">;
}) {
  const { role, userId, isManager, isCeo } = useWorkspaceAuth();
  const [rows, setRows] = useState<WorkspaceDocument[]>([]);
  const [categories, setCategories] = useState<WorkspaceCategory[]>([]);
  const [acks, setAcks] = useState<WorkspaceAcknowledgement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selected, setSelected] = useState<WorkspaceDocument | null>(null);
  const [editing, setEditing] = useState<WorkspaceDocument | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DocumentForm>(EMPTY_DOCUMENT);
  const [attachmentPaths, setAttachmentPaths] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [progress, setProgress] = useState<string[]>([]);

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const [docsResult, categoriesResult, ackResult, progressResult] = await Promise.all([
      supabase
        .from("cms_workspace_documents")
        .select("*")
        .eq("workspace_type", type)
        .order("updated_at", { ascending: false }),
      supabase
        .from("cms_workspace_categories")
        .select("*")
        .eq("workspace_type", type)
        .order("sort_order"),
      supabase
        .from("cms_workspace_acknowledgements")
        .select("document_id,document_version,user_id,acknowledged_at"),
      supabase
        .from("cms_workspace_learning_progress")
        .select("document_id,completed_at")
        .eq("user_id", userId ?? ""),
    ]);
    const failure =
      docsResult.error ?? categoriesResult.error ?? ackResult.error ?? progressResult.error;
    if (failure) {
      setError(failure.message);
      setLoading(false);
      return;
    }
    setRows((docsResult.data ?? []) as WorkspaceDocument[]);
    setCategories((categoriesResult.data ?? []) as WorkspaceCategory[]);
    setAcks((ackResult.data ?? []) as WorkspaceAcknowledgement[]);
    setProgress(
      ((progressResult.data ?? []) as { document_id: string; completed_at: string | null }[])
        .filter((item) => item.completed_at)
        .map((item) => item.document_id),
    );
    setError(null);
    setLoading(false);
  }, [type, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = rows.filter((row) => {
    const matchesQuery = `${row.title} ${row.summary} ${row.content}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesQuery && (categoryFilter === "all" || row.category_id === categoryFilter);
  });

  const canEdit = (row: WorkspaceDocument) =>
    isCeo || (role === "CONTENT EDITOR" && ["Draft", "In review"].includes(row.status));
  const startNew = () => {
    setEditing(null);
    setForm(EMPTY_DOCUMENT);
    setAttachmentPaths([]);
    setOpen(true);
  };
  const startEdit = (row: WorkspaceDocument) => {
    setEditing(row);
    setForm({
      title: row.title,
      summary: row.summary,
      content: row.content,
      category_id: row.category_id ?? "",
      status: row.status,
      mandatory_reading: row.mandatory_reading,
      require_renewed_acknowledgement: row.require_renewed_acknowledgement,
      objectives: row.objectives.join("\n"),
      external_url: row.external_url ?? "",
    });
    setAttachmentPaths(row.attachment_paths);
    setOpen(true);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) return toast.error("A title is required.");
    const files = Array.from(new FormData(event.currentTarget).getAll("attachments")).filter(
      (value): value is File => value instanceof File && value.size > 0,
    );
    setSaving(true);
    const uploaded: string[] = [];
    try {
      if (form.external_url.trim() && !safeExternalUrl(form.external_url.trim())) {
        setSaving(false);
        return toast.error("Enter a valid HTTP or HTTPS link.");
      }
      for (const file of files) uploaded.push(await uploadWorkspaceFile(file));
      const status = isCeo ? form.status : form.status === "In review" ? "In review" : "Draft";
      const publishedAt =
        status === "Published" ? (editing?.published_at ?? new Date().toISOString()) : null;
      await saveWorkspaceRow(
        "cms_workspace_documents",
        {
          workspace_type: type,
          category_id: form.category_id || null,
          title: form.title.trim(),
          summary: form.summary.trim(),
          content: form.content,
          objectives: form.objectives
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          attachment_paths: [...attachmentPaths, ...uploaded],
          external_url: safeExternalUrl(form.external_url),
          status,
          mandatory_reading: form.mandatory_reading,
          require_renewed_acknowledgement: form.require_renewed_acknowledgement,
          published_at: publishedAt,
        },
        editing?.id,
      );
      const removed =
        editing?.attachment_paths.filter((path) => !attachmentPaths.includes(path)) ?? [];
      if (removed.length) {
        try {
          await removeWorkspaceFiles(removed);
        } catch (cleanupError) {
          toast.error(
            `Saved, but removed files could not be deleted: ${errorMessage(cleanupError)}`,
          );
        }
      }
      toast.success(editing ? "Workspace document updated" : "Workspace document created");
      setOpen(false);
      await load();
    } catch (saveError) {
      if (uploaded.length) {
        try {
          await removeWorkspaceFiles(uploaded);
        } catch (cleanupError) {
          toast.error(`Uploaded files could not be cleaned up: ${errorMessage(cleanupError)}`);
        }
      }
      toast.error(`Could not save document: ${errorMessage(saveError)}`);
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveWorkspaceRow("cms_workspace_categories", {
        workspace_type: type,
        name: newCategory.trim(),
      });
      setNewCategory("");
      toast.success("Category added");
      await load();
    } catch (categoryError) {
      toast.error(`Could not add category: ${errorMessage(categoryError)}`);
    }
  };

  const removeDocument = async (doc: WorkspaceDocument) => {
    if (!window.confirm(`Delete “${doc.title}”? This cannot be undone.`)) return;
    try {
      await deleteWorkspaceRow("cms_workspace_documents", doc.id);
      try {
        await removeWorkspaceFiles(doc.attachment_paths);
      } catch (cleanupError) {
        toast.error(
          `Document deleted, but attached files could not be removed: ${errorMessage(cleanupError)}`,
        );
      }
      setSelected(null);
      toast.success("Document deleted");
      await load();
    } catch (deleteError) {
      toast.error(`Could not delete document: ${errorMessage(deleteError)}`);
    }
  };

  const setStatus = async (doc: WorkspaceDocument, status: WorkspaceStatus) => {
    try {
      await saveWorkspaceRow(
        "cms_workspace_documents",
        {
          status,
          published_at:
            status === "Published" ? (doc.published_at ?? new Date().toISOString()) : null,
        },
        doc.id,
      );
      toast.success(
        `Document ${status === "Published" ? "published" : status === "Archived" ? "archived" : "updated"}`,
      );
      await load();
      setSelected((current) =>
        current?.id === doc.id
          ? {
              ...current,
              status,
              published_at:
                status === "Published" ? (doc.published_at ?? new Date().toISOString()) : null,
            }
          : current,
      );
    } catch (statusError) {
      toast.error(`Could not update document status: ${errorMessage(statusError)}`);
    }
  };

  const acknowledge = async (doc: WorkspaceDocument) => {
    const supabase = getSupabaseClient();
    if (!supabase || !userId) return toast.error("Sign in before acknowledging a document.");
    const result = await supabase.from("cms_workspace_acknowledgements").insert({
      document_id: doc.id,
      document_version: doc.version,
      user_id: userId,
    });
    if (result.error) return toast.error(`Could not save acknowledgement: ${result.error.message}`);
    toast.success(
      "Acknowledgement recorded. This confirms you have read the document; it is not a legal signature.",
    );
    await load();
  };

  const toggleLearning = async (doc: WorkspaceDocument) => {
    const supabase = getSupabaseClient();
    if (!supabase || !userId) return toast.error("Sign in to save learning progress.");
    const completed = progress.includes(doc.id);
    const result = completed
      ? await supabase
          .from("cms_workspace_learning_progress")
          .delete()
          .eq("document_id", doc.id)
          .eq("user_id", userId)
      : await supabase
          .from("cms_workspace_learning_progress")
          .upsert({ document_id: doc.id, user_id: userId, completed_at: new Date().toISOString() });
    if (result.error) return toast.error(`Could not save progress: ${result.error.message}`);
    await load();
  };

  const docAcked = (doc: WorkspaceDocument) =>
    acks.some(
      (ack) =>
        ack.document_id === doc.id &&
        ack.user_id === userId &&
        (doc.require_renewed_acknowledgement ? ack.document_version === doc.version : true),
    );

  const downloadAttachment = async (path: string) => {
    try {
      const url = await getWorkspaceFileUrl(path, true);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      toast.error(`Could not access file: ${errorMessage(downloadError)}`);
    }
  };

  return (
    <>
      <PageHeader
        title={TITLES[type]}
        description={
          type === "procedure"
            ? "Follow each procedure in numbered order; attachments and current version are shown with the guide."
            : type === "policy"
              ? "Official internal policies and rules. Acknowledgement records confirm reading, not a legal signature."
              : type === "checklist"
                ? "Use this published quality checklist before submitting design work."
                : type === "learning"
                  ? "Practical learning materials for ongoing skill development."
                  : "Browse, search, and read published Designer Workspace materials."
        }
        actions={
          isManager ? (
            <Button size="sm" onClick={startNew}>
              <Plus className="size-4" /> New{" "}
              {type === "procedure" ? "procedure" : type === "policy" ? "policy" : "document"}
            </Button>
          ) : undefined
        }
      />
      <State loading={loading} error={error} retry={() => void load()} />
      {!loading && !error && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${TITLES[type].toLowerCase()}…`}
                aria-label="Search documents"
              />
            </div>
            {categories.length > 0 && (
              <select
                aria-label="Filter category"
                className="h-10 rounded-md border bg-background px-3 text-sm sm:w-64"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {isManager && (
            <>
              <form onSubmit={(event) => void addCategory(event)} className="flex max-w-lg gap-2">
                <Input
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  placeholder={`New ${TITLES[type].toLowerCase()} category`}
                  aria-label="New category name"
                  required
                />
                <Button type="submit" variant="outline" size="sm">
                  <Plus className="size-4" /> Category
                </Button>
              </form>
              <WorkspaceCategoryControls categories={categories} onChanged={load} />
            </>
          )}
          {visibleRows.length ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
              <div className="space-y-2">
                {visibleRows.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelected(doc)}
                    className={`w-full rounded-lg border p-4 text-left transition hover:border-primary/40 ${selected?.id === doc.id ? "border-primary bg-primary-subtle" : "bg-card"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{doc.title}</p>
                      {doc.mandatory_reading && (
                        <span className="text-xs text-destructive">Required</span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{doc.summary}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      v{doc.version} · updated {textDate(doc.updated_at)}
                      {doc.status !== "Published" ? ` · ${doc.status}` : ""}
                    </p>
                  </button>
                ))}
              </div>
              {selected ? (
                <article className="rounded-lg border bg-card p-5 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {categories.find((item) => item.id === selected.category_id)?.name ??
                          TITLES[type]}
                      </p>
                      <h2 className="mt-1 font-display text-2xl font-semibold">{selected.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{selected.summary}</p>
                    </div>
                    {isManager && canEdit(selected) && (
                      <Button size="sm" variant="outline" onClick={() => startEdit(selected)}>
                        Edit
                      </Button>
                    )}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-y py-3 text-xs text-muted-foreground">
                    <span>Version {selected.version}</span>
                    <span>Updated {textDate(selected.updated_at)}</span>
                    <span>{selected.created_by ? `Owner ${selected.created_by}` : ""}</span>
                    {selected.mandatory_reading && (
                      <span className="font-medium text-destructive">Mandatory reading</span>
                    )}
                  </div>
                  {type === "learning" && selected.objectives.length > 0 && (
                    <div className="mt-5 rounded-md bg-muted p-4">
                      <h3 className="font-medium">Learning objectives</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                        {selected.objectives.map((objective) => (
                          <li key={objective}>{objective}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {type === "checklist" ? (
                    <ul className="mt-5 space-y-3">
                      {selected.content.split("\n").map((line, index) =>
                        line.trim() ? (
                          <li key={`${index}-${line}`} className="flex gap-2 text-sm">
                            <input
                              type="checkbox"
                              aria-label={`Complete checklist item ${index + 1}`}
                              className="mt-1"
                            />
                            <span>{line.replace(/^\s*[-*]\s*/, "")}</span>
                          </li>
                        ) : null,
                      )}
                    </ul>
                  ) : type === "procedure" ? (
                    <ol className="mt-5 list-decimal space-y-3 pl-5">
                      {selected.content
                        .split("\n")
                        .filter((line) => line.trim())
                        .map((line, index) => (
                          <li key={index} className="whitespace-pre-wrap pl-1 text-sm leading-7">
                            {line.replace(/^\s*\d+[.)]\s*/, "")}
                          </li>
                        ))}
                    </ol>
                  ) : (
                    <div className="mt-5 whitespace-pre-wrap text-sm leading-7">
                      {selected.content || "No additional content has been added."}
                    </div>
                  )}
                  {selected.external_url && safeExternalUrl(selected.external_url) && (
                    <a
                      href={safeExternalUrl(selected.external_url) ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm text-primary underline"
                    >
                      Open related link <ExternalLink className="size-4" />
                    </a>
                  )}
                  {selected.attachment_paths.length > 0 && (
                    <div className="mt-5 border-t pt-4">
                      <h3 className="font-medium">Attachments</h3>
                      <ul className="mt-2 space-y-2">
                        {selected.attachment_paths.map((path) => (
                          <li key={path}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void downloadAttachment(path)}
                            >
                              <ArrowDownToLine className="size-4" />
                              {path.split("/").at(-1)}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {type === "learning" && role === "DESIGNER" && (
                    <Button
                      className="mt-5"
                      size="sm"
                      variant="outline"
                      onClick={() => void toggleLearning(selected)}
                    >
                      {progress.includes(selected.id) ? <Check className="size-4" /> : null}
                      {progress.includes(selected.id)
                        ? "Completed — mark as in progress"
                        : "Mark learning complete"}
                    </Button>
                  )}
                  {selected.mandatory_reading && role === "DESIGNER" && (
                    <div className="mt-5 border-t pt-4">
                      <p className="text-xs text-muted-foreground">
                        Acknowledgement confirms you have read this version. It is not a legal
                        signature.
                      </p>
                      <Button
                        className="mt-2"
                        size="sm"
                        disabled={docAcked(selected)}
                        onClick={() => void acknowledge(selected)}
                      >
                        {docAcked(selected) ? "Acknowledged" : "Acknowledge this version"}
                      </Button>
                    </div>
                  )}
                  {isManager && (
                    <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                      {!isCeo && (
                        <span className="self-center text-xs text-muted-foreground">
                          Editors save drafts for CEO publication.
                        </span>
                      )}
                      {isCeo && selected.status !== "Published" && (
                        <Button size="sm" onClick={() => void setStatus(selected, "Published")}>
                          Publish
                        </Button>
                      )}
                      {isCeo && selected.status === "Published" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void setStatus(selected, "Draft")}
                        >
                          Unpublish
                        </Button>
                      )}
                      {isCeo && selected.status !== "Archived" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void setStatus(selected, "Archived")}
                        >
                          Archive
                        </Button>
                      )}
                      {isCeo && selected.status === "Archived" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void setStatus(selected, "Draft")}
                        >
                          Restore
                        </Button>
                      )}
                      {canEdit(selected) && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => void removeDocument(selected)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  )}
                  {isManager && (
                    <div className="mt-4 text-xs text-muted-foreground">
                      Acknowledgements for this version:{" "}
                      {
                        acks.filter(
                          (ack) =>
                            ack.document_id === selected.id &&
                            ack.document_version === selected.version,
                        ).length
                      }
                    </div>
                  )}
                </article>
              ) : (
                <div className="grid min-h-64 place-items-center rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                  Choose an item to read its complete content.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-8 text-center">
              <p className="font-medium">No {TITLES[type].toLowerCase()} found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {query
                  ? "Try another search or category."
                  : isManager
                    ? "Create a draft to add the first item."
                    : "Published content will appear here when available."}
              </p>
            </div>
          )}
        </div>
      )}

      {open && isManager && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          role="presentation"
        >
          <form
            key={editing?.id ?? "new-document"}
            onSubmit={(event) => void save(event)}
            className="max-h-[92vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-xl border bg-background p-6 shadow-xl"
            aria-label="Workspace document editor"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">
                {editing ? "Edit" : "Create"} {TITLES[type]}
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
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="workspace-title">Title *</Label>
                <Input
                  id="workspace-title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="workspace-summary">Summary</Label>
                <Input
                  id="workspace-summary"
                  value={form.summary}
                  onChange={(event) => setForm({ ...form, summary: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="workspace-category">Category</Label>
                <select
                  id="workspace-category"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={form.category_id}
                  onChange={(event) => setForm({ ...form, category_id: event.target.value })}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="workspace-status">Workflow status</Label>
                <select
                  id="workspace-status"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value as WorkspaceStatus })
                  }
                >
                  {(isCeo
                    ? ["Draft", "In review", "Published", "Archived"]
                    : ["Draft", "In review"]
                  ).map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              {type === "learning" && (
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="workspace-objectives">Learning objectives (one per line)</Label>
                  <Textarea
                    id="workspace-objectives"
                    value={form.objectives}
                    onChange={(event) => setForm({ ...form, objectives: event.target.value })}
                    rows={3}
                  />
                </div>
              )}
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="workspace-content">
                  {type === "procedure"
                    ? "Procedure steps (one numbered step per line)"
                    : type === "checklist"
                      ? "Checklist items (one item per line)"
                      : "Full content"}
                </Label>
                <Textarea
                  id="workspace-content"
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                  rows={12}
                  placeholder={
                    type === "procedure"
                      ? "1. Receive and review the brief\n2. Confirm requirements with the project lead"
                      : type === "checklist"
                        ? "- Meets the approved brief\n- Check type and color consistency"
                        : "Write the complete guidance here…"
                  }
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="workspace-url">
                  Approved external link (optional, HTTP/HTTPS only)
                </Label>
                <Input
                  id="workspace-url"
                  type="url"
                  value={form.external_url}
                  onChange={(event) => setForm({ ...form, external_url: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="workspace-attachments">
                  Attachments (PDF, Office, ZIP, JPEG, PNG, WebP, GIF or SVG; max 20 MB each)
                </Label>
                <Input
                  id="workspace-attachments"
                  name="attachments"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.jpg,.jpeg,.png,.webp,.gif,.svg"
                />
              </div>
              {attachmentPaths.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="mb-2 text-sm font-medium">Saved attachments</p>
                  <ul className="space-y-1">
                    {attachmentPaths.map((path) => (
                      <li key={path} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{path.split("/").at(-1)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setAttachmentPaths(attachmentPaths.filter((item) => item !== path))
                          }
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {type === "policy" && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.mandatory_reading}
                      onChange={(event) =>
                        setForm({ ...form, mandatory_reading: event.target.checked })
                      }
                    />
                    Require designer acknowledgement
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.require_renewed_acknowledgement}
                      onChange={(event) =>
                        setForm({ ...form, require_renewed_acknowledgement: event.target.checked })
                      }
                    />
                    Require acknowledgement again after a new version
                  </label>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving…"
                  : isCeo && form.status === "Published"
                    ? "Save & publish"
                    : "Save draft"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function WorkspaceResourceLibrary() {
  const { isManager, isCeo } = useWorkspaceAuth();
  const [rows, setRows] = useState<WorkspaceResource[]>([]);
  const [categories, setCategories] = useState<WorkspaceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceResource | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const [resources, categoryRows] = await Promise.all([
      supabase
        .from("cms_workspace_resources")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("cms_workspace_categories")
        .select("*")
        .eq("workspace_type", "resource")
        .order("sort_order"),
    ]);
    if (resources.error || categoryRows.error) {
      setError(
        resources.error?.message ?? categoryRows.error?.message ?? "Unable to load resources.",
      );
      setLoading(false);
      return;
    }
    setRows((resources.data ?? []) as WorkspaceResource[]);
    setCategories((categoryRows.data ?? []) as WorkspaceCategory[]);
    setError(null);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    const preview = form.get("preview");
    const fileToUpload = file instanceof File && file.size ? file : null;
    const previewToUpload = preview instanceof File && preview.size ? preview : null;
    const name = String(form.get("name") ?? "").trim();
    const externalUrl = String(form.get("external_url") ?? "").trim();
    const url = safeExternalUrl(externalUrl);
    if (externalUrl && !url) return toast.error("Enter a valid HTTP or HTTPS link.");
    const removeFile = form.get("remove_file") === "on";
    const removePreview = form.get("remove_preview") === "on";
    const existingFile = removeFile ? null : (editing?.file_path ?? null);
    const existingPreview = removePreview ? null : (editing?.preview_path ?? null);
    if (!name || (!fileToUpload && !existingFile && !url))
      return toast.error(
        "Add a resource name and either upload a file or enter an HTTP/HTTPS link.",
      );
    setSaving(true);
    const uploaded: string[] = [];
    try {
      const filePath = fileToUpload ? await uploadWorkspaceFile(fileToUpload) : null;
      if (filePath) uploaded.push(filePath);
      const previewPath = previewToUpload ? await uploadWorkspaceFile(previewToUpload) : null;
      if (previewPath) uploaded.push(previewPath);
      const statusValue = String(form.get("status") ?? "Draft");
      const status: WorkspaceStatus =
        isCeo && isWorkspaceStatus(statusValue)
          ? statusValue
          : editing?.status === "In review"
            ? "In review"
            : "Draft";
      await saveWorkspaceRow(
        "cms_workspace_resources",
        {
          category_id: String(form.get("category_id") ?? "") || null,
          name,
          description: String(form.get("description") ?? "").trim(),
          resource_type: String(form.get("resource_type") ?? "Document"),
          file_path: filePath ?? existingFile,
          preview_path: previewPath ?? existingPreview,
          external_url: url,
          status,
        },
        editing?.id,
      );
      const removed = [
        fileToUpload || removeFile ? editing?.file_path : null,
        previewToUpload || removePreview ? editing?.preview_path : null,
      ].filter((path): path is string => Boolean(path));
      if (removed.length) {
        try {
          await removeWorkspaceFiles(removed);
        } catch (cleanupError) {
          toast.error(`Saved, but old files could not be deleted: ${errorMessage(cleanupError)}`);
        }
      }
      toast.success(editing ? "Resource updated" : "Resource saved");
      setOpen(false);
      await load();
    } catch (saveError) {
      if (uploaded.length) {
        try {
          await removeWorkspaceFiles(uploaded);
        } catch (cleanupError) {
          toast.error(`Uploaded files could not be cleaned up: ${errorMessage(cleanupError)}`);
        }
      }
      toast.error(`Could not save resource: ${errorMessage(saveError)}`);
    } finally {
      setSaving(false);
    }
  };
  const filtered = rows.filter((row) =>
    `${row.name} ${row.description} ${row.resource_type}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const addCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveWorkspaceRow("cms_workspace_categories", {
        workspace_type: "resource",
        name: newCategory.trim(),
        description: "",
      });
      setNewCategory("");
      await load();
    } catch (categoryError) {
      toast.error(`Could not add resource category: ${errorMessage(categoryError)}`);
    }
  };
  const deleteResource = async (item: WorkspaceResource) => {
    try {
      await deleteWorkspaceRow("cms_workspace_resources", item.id);
      const paths = [item.file_path, item.preview_path].filter((path): path is string =>
        Boolean(path),
      );
      if (paths.length) {
        try {
          await removeWorkspaceFiles(paths);
        } catch (cleanupError) {
          toast.error(
            `Resource deleted, but its files could not be removed: ${errorMessage(cleanupError)}`,
          );
        }
      }
      await load();
    } catch (deleteError) {
      toast.error(`Could not delete resource: ${errorMessage(deleteError)}`);
    }
  };

  return (
    <>
      <PageHeader
        title="Resources & Templates"
        description="Approved templates, brand assets, specifications, and learning links."
        actions={
          isManager ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> Add resource
            </Button>
          ) : undefined
        }
      />
      <State loading={loading} error={error} retry={() => void load()} />
      {!loading && !error && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search resources"
              aria-label="Search resources"
            />
          </div>
          {isManager && (
            <form onSubmit={(event) => void addCategory(event)} className="flex max-w-lg gap-2">
              <Input
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder="New resource category"
                aria-label="New resource category"
                required
              />
              <Button type="submit" variant="outline" size="sm">
                <Plus className="size-4" /> Category
              </Button>
            </form>
          )}
          {isManager && <WorkspaceCategoryControls categories={categories} onChanged={load} />}
          {filtered.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered
                .filter((item) => isManager || item.status === "Published")
                .map((item) => (
                  <article key={item.id} className="rounded-lg border bg-card p-5">
                    <p className="text-xs text-muted-foreground">
                      {categories.find((category) => category.id === item.category_id)?.name ??
                        item.resource_type}
                    </p>
                    <h2 className="mt-1 font-display font-semibold">{item.name}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.status} · updated {textDate(item.updated_at)}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.file_path && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void getWorkspaceFileUrl(item.file_path)
                              .then((url) => window.open(url, "_blank", "noopener,noreferrer"))
                              .catch((e: unknown) => toast.error(errorMessage(e)))
                          }
                        >
                          <ArrowDownToLine className="size-4" />
                          Download
                        </Button>
                      )}
                      {safeExternalUrl(item.external_url) && (
                        <Button asChild size="sm" variant="outline">
                          <a
                            href={safeExternalUrl(item.external_url) ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open link <ExternalLink className="size-4" />
                          </a>
                        </Button>
                      )}
                      {isManager && (isCeo || ["Draft", "In review"].includes(item.status)) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditing(item);
                            setOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      {isCeo && item.status !== "Published" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            void saveWorkspaceRow(
                              "cms_workspace_resources",
                              { status: "Published" },
                              item.id,
                            )
                              .then(load)
                              .catch((e: unknown) =>
                                toast.error(`Could not publish resource: ${errorMessage(e)}`),
                              )
                          }
                        >
                          Publish
                        </Button>
                      )}
                      {isCeo && item.status === "Published" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void saveWorkspaceRow(
                              "cms_workspace_resources",
                              { status: "Archived" },
                              item.id,
                            )
                              .then(load)
                              .catch((e: unknown) =>
                                toast.error(`Could not archive resource: ${errorMessage(e)}`),
                              )
                          }
                        >
                          Archive
                        </Button>
                      )}
                      {isManager && (isCeo || ["Draft", "In review"].includes(item.status)) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void deleteResource(item)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              No published resources are available.
            </p>
          )}
        </div>
      )}
      {open && isManager && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <form
            key={editing?.id ?? "new-resource"}
            onSubmit={(event) => void save(event)}
            className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl bg-background p-6"
          >
            <h2 className="font-display text-lg font-semibold">
              {editing ? "Edit resource" : "Add resource"}
            </h2>
            <div className="grid gap-3">
              <Label>
                Name
                <Input name="name" defaultValue={editing?.name} required />
              </Label>
              <Label>
                Description
                <Textarea name="description" rows={3} defaultValue={editing?.description} />
              </Label>
              <Label>
                Category
                <select
                  name="category_id"
                  defaultValue={editing?.category_id ?? ""}
                  className="h-10 w-full rounded-md border bg-background px-3"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Label>
              <Label>
                Resource type
                <Input
                  name="resource_type"
                  defaultValue={editing?.resource_type}
                  placeholder="Template, Brand asset, Link…"
                  required
                />
              </Label>
              {editing?.file_path && (
                <label className="flex gap-2 text-sm">
                  <input name="remove_file" type="checkbox" /> Remove current file
                </label>
              )}
              <Label>
                Upload approved file (max 20 MB)
                <Input
                  name="file"
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.jpg,.jpeg,.png,.webp,.gif,.svg"
                />
              </Label>
              {editing?.preview_path && (
                <label className="flex gap-2 text-sm">
                  <input name="remove_preview" type="checkbox" /> Remove current preview
                </label>
              )}
              <Label>
                Optional preview file
                <Input name="preview" type="file" accept="image/*" />
              </Label>
              <Label>
                Or approved external URL
                <Input name="external_url" type="url" defaultValue={editing?.external_url ?? ""} />
              </Label>
              {isCeo && (
                <Label>
                  Status
                  <select
                    name="status"
                    defaultValue={editing?.status ?? "Draft"}
                    className="h-10 w-full rounded-md border bg-background px-3"
                  >
                    <option>Draft</option>
                    <option>In review</option>
                    <option>Published</option>
                    <option>Archived</option>
                  </select>
                </Label>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save resource"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function WorkspaceNoticeLibrary() {
  const { role, isManager, isCeo } = useWorkspaceAuth();
  const [rows, setRows] = useState<WorkspaceNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceNotice | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await supabase
      .from("cms_workspace_notices")
      .select("*")
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false });
    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }
    setRows((result.data ?? []) as WorkspaceNotice[]);
    setError(null);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const audienceRows = rows.filter((notice) => {
    if (!isManager && notice.status !== "Published") return false;
    if (!isManager && role && !notice.audience_roles.includes(role)) return false;
    if (
      !isManager &&
      notice.expires_at &&
      !notice.show_after_expiry &&
      notice.expires_at < new Date().toISOString()
    )
      return false;
    return `${notice.title} ${notice.message}`.toLowerCase().includes(query.toLowerCase());
  });

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fileValue = form.get("attachment");
    const file = fileValue instanceof File && fileValue.size ? fileValue : null;
    const removeAttachment = form.get("remove_attachment") === "on";
    setSaving(true);
    let path: string | null = removeAttachment ? null : (editing?.attachment_path ?? null);
    try {
      const uploadedPath = file ? await uploadWorkspaceFile(file) : null;
      if (uploadedPath) path = uploadedPath;
      const statusValue = String(form.get("status") ?? "Draft");
      const status: WorkspaceStatus =
        isCeo && isWorkspaceStatus(statusValue)
          ? statusValue
          : editing?.status === "In review"
            ? "In review"
            : "Draft";
      await saveWorkspaceRow(
        "cms_workspace_notices",
        {
          title: String(form.get("title")).trim(),
          message: String(form.get("message")).trim(),
          attachment_path: path,
          priority: String(form.get("priority")),
          published_at:
            status === "Published" ? (editing?.published_at ?? new Date().toISOString()) : null,
          expires_at: (() => {
            const value = String(form.get("expires_at") ?? "");
            return value ? new Date(value).toISOString() : null;
          })(),
          show_after_expiry: form.get("show_after_expiry") === "on",
          pinned: form.get("pinned") === "on",
          audience_roles: form.getAll("audience_roles"),
          status,
        },
        editing?.id,
      );
      if ((file || removeAttachment) && editing?.attachment_path) {
        try {
          await removeWorkspaceFiles([editing.attachment_path]);
        } catch (cleanupError) {
          toast.error(
            `Saved, but the old attachment could not be removed: ${errorMessage(cleanupError)}`,
          );
        }
      }
      toast.success(editing ? "Notice updated" : "Notice saved");
      setOpen(false);
      await load();
    } catch (saveError) {
      if (file && path && path !== editing?.attachment_path) {
        try {
          await removeWorkspaceFiles([path]);
        } catch (cleanupError) {
          toast.error(`Uploaded attachment could not be cleaned up: ${errorMessage(cleanupError)}`);
        }
      }
      toast.error(`Could not save notice: ${errorMessage(saveError)}`);
    } finally {
      setSaving(false);
    }
  };
  const deleteNotice = async (notice: WorkspaceNotice) => {
    try {
      await deleteWorkspaceRow("cms_workspace_notices", notice.id);
      if (notice.attachment_path) {
        try {
          await removeWorkspaceFiles([notice.attachment_path]);
        } catch (cleanupError) {
          toast.error(
            `Notice deleted, but attachment could not be removed: ${errorMessage(cleanupError)}`,
          );
        }
      }
      await load();
    } catch (deleteError) {
      toast.error(`Could not delete notice: ${errorMessage(deleteError)}`);
    }
  };
  const updateNoticeStatus = async (notice: WorkspaceNotice, status: WorkspaceStatus) => {
    try {
      await saveWorkspaceRow(
        "cms_workspace_notices",
        {
          status,
          published_at:
            status === "Published" ? (notice.published_at ?? new Date().toISOString()) : null,
        },
        notice.id,
      );
      toast.success(`Notice ${status.toLowerCase()}`);
      await load();
    } catch (statusError) {
      toast.error(`Could not update notice: ${errorMessage(statusError)}`);
    }
  };

  return (
    <>
      <PageHeader
        title="Notices & Updates"
        description="Published announcements for the intended roles. Expiry follows each notice's visibility setting."
        actions={
          isManager ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> New notice
            </Button>
          ) : undefined
        }
      />
      <State loading={loading} error={error} retry={() => void load()} />
      {!loading && !error && (
        <div className="space-y-3">
          {audienceRows.length ? (
            audienceRows.map((notice) => (
              <article key={notice.id} className="rounded-lg border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-semibold">{notice.title}</h2>
                  {notice.pinned && (
                    <span className="rounded bg-primary-subtle px-2 py-1 text-xs text-primary">
                      Pinned
                    </span>
                  )}
                  <span className="rounded bg-muted px-2 py-1 text-xs">{notice.priority}</span>
                  {isManager && (
                    <span className="rounded bg-muted px-2 py-1 text-xs">{notice.status}</span>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{notice.message}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Published {textDate(notice.published_at)}
                  {notice.expires_at
                    ? ` · ${notice.show_after_expiry ? "remains visible after" : "visible until"} ${textDate(notice.expires_at)}`
                    : ""}
                </p>
                {notice.attachment_path && (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void getWorkspaceFileUrl(notice.attachment_path!)
                        .then((url) => window.open(url, "_blank", "noopener,noreferrer"))
                        .catch((e: unknown) => toast.error(errorMessage(e)))
                    }
                  >
                    <ArrowDownToLine className="size-4" />
                    Download attachment
                  </Button>
                )}
                {isManager && (isCeo || ["Draft", "In review"].includes(notice.status)) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(notice);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    {isCeo && notice.status !== "Published" && (
                      <Button
                        size="sm"
                        onClick={() => void updateNoticeStatus(notice, "Published")}
                      >
                        Publish
                      </Button>
                    )}
                    {isCeo && notice.status === "Published" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void updateNoticeStatus(notice, "Archived")}
                      >
                        Archive
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => void deleteNotice(notice)}>
                      Delete
                    </Button>
                  </div>
                )}
              </article>
            ))
          ) : (
            <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              No notices are available.
            </p>
          )}
        </div>
      )}
      {open && isManager && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <form
            key={editing?.id ?? "new-notice"}
            onSubmit={(event) => void save(event)}
            className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl bg-background p-6"
          >
            <h2 className="font-display text-lg font-semibold">
              {editing ? "Edit notice" : "New notice"}
            </h2>
            <Label>
              Title
              <Input name="title" defaultValue={editing?.title} required />
            </Label>
            <Label>
              Message
              <Textarea name="message" rows={6} defaultValue={editing?.message} required />
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Label>
                Priority
                <select
                  name="priority"
                  defaultValue={editing?.priority ?? "Normal"}
                  className="h-10 w-full rounded-md border bg-background px-3"
                >
                  <option>Normal</option>
                  <option>Low</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              </Label>
              <Label>
                Expiry date (optional)
                <Input
                  name="expires_at"
                  type="datetime-local"
                  defaultValue={
                    editing?.expires_at
                      ? new Date(editing.expires_at).toISOString().slice(0, 16)
                      : ""
                  }
                />
              </Label>
              {editing?.attachment_path && (
                <label className="flex gap-2 text-sm">
                  <input name="remove_attachment" type="checkbox" /> Remove current attachment
                </label>
              )}
            </div>
            <Label>
              Attachment (optional)
              <Input
                name="attachment"
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.jpg,.jpeg,.png,.webp,.gif,.svg"
              />
            </Label>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex gap-2">
                <input name="pinned" type="checkbox" defaultChecked={editing?.pinned} />
                Pin notice
              </label>
              <label className="flex gap-2">
                <input
                  name="show_after_expiry"
                  type="checkbox"
                  defaultChecked={editing?.show_after_expiry}
                />
                Keep visible after expiry
              </label>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Audience</p>
              {["DESIGNER", "CEO", "CONTENT EDITOR"].map((item) => (
                <label key={item} className="mr-4 inline-flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="audience_roles"
                    value={item}
                    defaultChecked={
                      editing ? editing.audience_roles.includes(item) : item === "DESIGNER"
                    }
                  />
                  {item}
                </label>
              ))}
            </div>
            {isCeo && (
              <Label>
                Publication status
                <select
                  name="status"
                  defaultValue={editing?.status ?? "Draft"}
                  className="h-10 w-full rounded-md border bg-background px-3"
                >
                  <option>Draft</option>
                  <option>In review</option>
                  <option>Published</option>
                  <option>Archived</option>
                  <option>Archived</option>
                </select>
              </Label>
            )}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save notice"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

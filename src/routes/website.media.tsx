import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Film, Image as ImageIcon, PenTool, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/cms/primitives";
import { media } from "@/lib/demo-data";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/media")({
  head: () => meta("Media Library", "Images, vectors, documents and video used across the CYTIC website."),
  component: Page,
});
const ICON = { Image: ImageIcon, Vector: PenTool, Document: FileText, Video: Film } as const;

function Page() {
  const [q, setQ] = useState("");
  const list = media.filter((m) => m.name.includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Media Library" description="Uploads are stored once and reused across pages."
        actions={<Button size="sm" onClick={() => toast("Uploads need Lovable Cloud storage", { description: "Not yet connected." })}><Upload className="size-4" /> Upload</Button>} />
      <div className="relative mb-4 max-w-xs"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files…" className="pl-8" /></div>
      {list.length === 0 ? <EmptyState title="No files found" body="Try another file name." /> : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {list.map((m) => {
            const I = ICON[m.type as keyof typeof ICON];
            return (
              <button key={m.name} className="group overflow-hidden rounded-lg border bg-card text-left shadow-soft transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="grid aspect-square place-items-center bg-sand/30 text-gold-foreground"><I className="size-8" /></div>
                <div className="p-3"><p className="truncate text-xs font-medium">{m.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{m.size} · used {m.used}×</p></div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

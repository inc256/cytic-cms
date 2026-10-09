import { useMemo, useState, type ReactNode } from "react";
import { MoreHorizontal, Plus, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, StatusBadge } from "./primitives";

type Row = Record<string, unknown>;
export type Column<T extends Row> = {
  key: keyof T & string; label: string; align?: "right"; render?: (row: T) => ReactNode; className?: string;
};
export type Field = { key: string; label: string; type?: "text" | "number" | "date" | "select"; options?: string[]; required?: boolean };

export function ResourceTable<T extends Row>({
  rows: initial, columns, searchKeys, statusKey, fields, entity, onRowClick, rowActions,
}: {
  rows: T[]; columns: Column<T>[]; searchKeys: (keyof T & string)[]; statusKey?: keyof T & string;
  fields?: Field[]; entity: string; onRowClick?: (r: T) => void; rowActions?: (r: T) => ReactNode;
}) {
  const [rows, setRows] = useState<T[]>(initial);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<T | null | "new">(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const statuses = useMemo(() => statusKey ? Array.from(new Set(initial.map((r) => String(r[statusKey])))) : [], [initial, statusKey]);
  const filtered = rows.filter((r) =>
    (status === "all" || String(r[statusKey!]) === status) &&
    searchKeys.some((k) => String(r[k]).toLowerCase().includes(q.toLowerCase())));

  const open = (r: T | "new") => {
    setForm(r === "new" ? {} : Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])));
    setEditing(r);
  };
  const save = () => {
    const missing = fields?.find((f) => f.required && !form[f.key]?.trim());
    if (missing) return toast.error(`${missing.label} is required`);
    const parsed = Object.fromEntries(Object.entries(form).map(([k, v]) => {
      const f = fields?.find((x) => x.key === k);
      return [k, f?.type === "number" ? Number(v) : v];
    })) as T;
    if (editing === "new") setRows((p) => [parsed, ...p]);
    else setRows((p) => p.map((r) => (r === editing ? { ...r, ...parsed } : r)));
    toast.success(`${entity} ${editing === "new" ? "created" : "updated"}`, { description: "Saved to demo session only — not persisted." });
    setEditing(null);
  };

  const exportCsv = () => {
    const head = columns.map((c) => c.label).join(",");
    const body = filtered.map((r) => columns.map((c) => JSON.stringify(String(r[c.key] ?? ""))).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([head + "\n" + body], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${entity.toLowerCase().replace(/\s/g, "-")}.csv` });
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border bg-card shadow-soft">
      <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${entity.toLowerCase()}s…`} aria-label="Search" className="h-9 pl-8 sm:max-w-xs" />
        </div>
        {statusKey && (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" className="h-9" onClick={exportCsv}><Download className="size-4" /> Export</Button>
        {fields && <Button size="sm" className="h-9" onClick={() => open("new")}><Plus className="size-4" /> New {entity.toLowerCase()}</Button>}
      </div>
      {filtered.length === 0 ? (
        <EmptyState title={`No ${entity.toLowerCase()}s match`} body="Try a different search term or clear the status filter." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((c) => <TableHead key={c.key} className={`h-10 text-xs font-medium ${c.align === "right" ? "text-right" : ""}`}>{c.label}</TableHead>)}
                <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, i) => (
                <TableRow key={i} className={onRowClick ? "cursor-pointer" : ""} onClick={() => onRowClick?.(r)}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={`py-3 text-sm ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.className ?? ""}`}>
                      {c.render ? c.render(r) : c.key === statusKey ? <StatusBadge status={String(r[c.key])} /> : String(r[c.key] ?? "")}
                    </TableCell>
                  ))}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label="Row actions"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onRowClick && <DropdownMenuItem onClick={() => onRowClick(r)}>View details</DropdownMenuItem>}
                        {fields && <DropdownMenuItem onClick={() => open(r)}>Edit</DropdownMenuItem>}
                        {rowActions?.(r)}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(r)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">{filtered.length} of {rows.length} records · demo data</div>

      {fields && (
        <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing === "new" ? `New ${entity.toLowerCase()}` : `Edit ${entity.toLowerCase()}`}</DialogTitle>
              <DialogDescription>Fields marked * are required.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className={`grid gap-1.5 ${f.type === "select" || f.type === "number" || f.type === "date" ? "" : "sm:col-span-2"}`}>
                  <Label htmlFor={f.key} className="text-xs">{f.label}{f.required && " *"}</Label>
                  {f.type === "select" ? (
                    <Select value={form[f.key] ?? ""} onValueChange={(v) => setForm({ ...form, [f.key]: v })}>
                      <SelectTrigger id={f.key}><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>{f.options!.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input id={f.key} type={f.type ?? "text"} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>Save {entity.toLowerCase()}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {entity.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the record from the list. Financial records should normally be reversed rather than deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setRows((p) => p.filter((r) => r !== deleting)); toast.success(`${entity} deleted`); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

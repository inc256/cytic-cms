import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-context";
import { PageHeader, Panel } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CMS_ROLES, isCmsRole, type CmsRole } from "@/lib/cms-access";
import { getSupabaseClient } from "@/lib/supabase";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/users")({
  head: () => meta("Users & Permissions", "Manage CMS accounts and access roles."),
  component: Page,
});

type CmsUser = {
  user_id: string;
  email: string;
  full_name: string;
  role: CmsRole | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

function displayDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

function Page() {
  const { state } = useAuth();
  const [rows, setRows] = useState<CmsUser[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: loadError } = await supabase.rpc("get_cms_users");
    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }
    setRows(
      ((data ?? []) as (Omit<CmsUser, "role"> & { role: string | null })[]).map((row) => ({
        ...row,
        role: isCmsRole(row.role) ? row.role : null,
      })),
    );
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (state.status === "signed-in" && state.role === "CEO") void loadUsers();
    else setLoading(false);
  }, [loadUsers, state]);

  const filteredRows = useMemo(
    () =>
      rows.filter((user) => {
        const matchesQuery = `${user.full_name} ${user.email} ${user.role ?? ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase());
        const matchesRole =
          roleFilter === "all" ||
          (roleFilter === "unassigned" ? user.role === null : user.role === roleFilter);
        return matchesQuery && matchesRole;
      }),
    [query, roleFilter, rows],
  );

  const updateRole = async (user: CmsUser, value: string) => {
    const newRole = value === "unassigned" ? null : isCmsRole(value) ? value : undefined;
    if (newRole === undefined || newRole === user.role) return;
    setUpdating(user.user_id);
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      setUpdating(null);
      return;
    }
    const { error: updateError } = await supabase.rpc("set_cms_user_role", {
      p_user_id: user.user_id,
      p_role: newRole,
    });
    if (updateError) {
      toast.error(`Could not update role: ${updateError.message}`);
    } else {
      setRows((current) =>
        current.map((row) => (row.user_id === user.user_id ? { ...row, role: newRole } : row)),
      );
      toast.success(newRole ? `${user.email} assigned ${newRole}` : `${user.email} role removed`);
    }
    setUpdating(null);
  };

  if (state.status !== "signed-in" || state.role !== "CEO") {
    return (
      <Panel title="CEO access required">
        <p className="text-sm text-muted-foreground">
          User management is available only to the CEO role.
        </p>
      </Panel>
    );
  }

  return (
    <>
      <PageHeader
        title="Users & Permissions"
        description="Manage real Supabase Auth accounts and their CMS access roles."
        actions={
          <Button size="sm" variant="outline" onClick={() => void loadUsers()} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />

      <Panel className="mb-5">
        <div className="flex gap-3">
          <UserPlus className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">Add an account through Supabase Auth</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create or invite users in Supabase Dashboard → Authentication → Users. They will
              appear here, where you can assign a CMS role. Role changes are enforced by Supabase;
              the browser app never uses a service-role key.
            </p>
          </div>
        </div>
      </Panel>

      <Panel
        title="Supabase Auth users"
        description={`${rows.length} real account${rows.length === 1 ? "" : "s"} · status reflects email confirmation`}
        flush
      >
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email or role"
              aria-label="Search users"
              className="h-9 pl-8 sm:max-w-sm"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger aria-label="Filter users by role" className="h-9 sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {CMS_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p role="status" className="p-6 text-sm text-muted-foreground">
            Loading Supabase Auth users…
          </p>
        ) : error ? (
          <div className="p-6" role="alert">
            <p className="text-sm text-destructive">{error}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Run supabase/user-management.sql after supabase/rbac.sql, and confirm your account has
              the CEO role.
            </p>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => void loadUsers()}>
              Retry
            </Button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-8 text-center">
            <ShieldCheck className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No accounts found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an account in Supabase Auth or adjust the search and role filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role ?? "unassigned"}
                        disabled={updating === user.user_id || user.user_id === state.user.id}
                        onValueChange={(value) => void updateRole(user, value)}
                      >
                        <SelectTrigger
                          aria-label={`Role for ${user.email}`}
                          className="h-9 min-w-44"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {CMS_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          user.email_confirmed_at ? "text-success" : "text-muted-foreground"
                        }
                      >
                        {user.email_confirmed_at ? "Confirmed" : "Not confirmed"}
                      </span>
                    </TableCell>
                    <TableCell>{displayDate(user.last_sign_in_at)}</TableCell>
                    <TableCell>{displayDate(user.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!loading && !error && (
          <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            Showing {filteredRows.length} of {rows.length} accounts
          </div>
        )}
      </Panel>
    </>
  );
}

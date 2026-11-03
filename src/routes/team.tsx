import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ContactRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-context";
import { PageHeader, Panel } from "@/components/cms/primitives";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { getSupabaseClient } from "@/lib/supabase";
import { isCmsRole, type CmsRole } from "@/lib/cms-access";
import { meta } from "@/lib/seo";
import {
  deleteDigitalSignature,
  getDigitalSignatureUrl,
  uploadDigitalSignature,
} from "@/lib/website-cms";

export const Route = createFileRoute("/team")({
  head: () => meta("Team", "Manage team member profiles and private documents."),
  component: Page,
});

type CmsUser = {
  user_id: string;
  email: string;
  full_name: string;
  role: CmsRole | null;
};

function isEmploymentStatus(value: string): value is ProfileForm["employment_status"] {
  return value === "Active" || value === "On leave" || value === "Inactive";
}

type TeamProfile = {
  user_id: string;
  full_name: string;
  date_of_birth: string | null;
  job_title: string;
  phone: string;
  start_date: string | null;
  employment_status: "Active" | "On leave" | "Inactive";
  national_id_type: string;
  national_id_number: string;
  profile_image_path: string | null;
  id_document_path: string | null;
  digital_signature_path: string | null;
  profile_image_url?: string | undefined;
  id_document_url?: string | undefined;
  digital_signature_url?: string | undefined;
};

type ProfileForm = {
  user_id: string;
  full_name: string;
  date_of_birth: string;
  job_title: string;
  phone: string;
  start_date: string;
  employment_status: TeamProfile["employment_status"];
  national_id_type: string;
  national_id_number: string;
  profile_image_path: string | null;
  id_document_path: string | null;
  digital_signature_path: string | null;
};

const emptyForm: ProfileForm = {
  user_id: "",
  full_name: "",
  date_of_birth: "",
  job_title: "",
  phone: "",
  start_date: "",
  employment_status: "Active",
  national_id_type: "",
  national_id_number: "",
  profile_image_path: null,
  id_document_path: null,
  digital_signature_path: null,
};

async function signedFileUrl(path: string | null): Promise<string | undefined> {
  if (!path) return undefined;
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.storage.from("team-private").createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

async function uploadTeamFile(file: File, userId: string, kind: "photo" | "id") {
  const photoTypes = ["image/jpeg", "image/png", "image/webp"];
  const documentTypes = [...photoTypes, "application/pdf"];
  if (!(kind === "photo" ? photoTypes : documentTypes).includes(file.type)) {
    throw new Error(
      kind === "photo"
        ? "Choose a JPG, PNG, or WebP image."
        : "Choose a JPG, PNG, WebP, or PDF ID document.",
    );
  }
  if (file.size > 20 * 1024 * 1024) throw new Error("Team files must be 20 MB or smaller.");
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "file";
  const path = `${userId}/${kind}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("team-private").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

function Page() {
  const { state } = useAuth();
  const [users, setUsers] = useState<CmsUser[]>([]);
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);

  const loadTeam = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [usersResult, profilesResult] = await Promise.all([
        supabase.rpc("get_cms_users"),
        supabase.from("cms_team_profiles").select("*").order("full_name"),
      ]);
      if (usersResult.error) throw new Error(usersResult.error.message);
      if (profilesResult.error) throw new Error(profilesResult.error.message);
      const availableUsers = (
        (usersResult.data ?? []) as (Omit<CmsUser, "role"> & { role: string | null })[]
      ).map((user) => ({
        ...user,
        role: isCmsRole(user.role) ? user.role : null,
      }));
      const profilesWithUrls = await Promise.all(
        ((profilesResult.data ?? []) as TeamProfile[]).map(async (profile) => ({
          ...profile,
          profile_image_url: await signedFileUrl(profile.profile_image_path),
          id_document_url: await signedFileUrl(profile.id_document_path),
          digital_signature_url: profile.digital_signature_path
            ? await getDigitalSignatureUrl(profile.digital_signature_path)
            : undefined,
        })),
      );
      setUsers(availableUsers);
      setProfiles(profilesWithUrls);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load team profiles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state.status === "signed-in" && state.role === "CEO") void loadTeam();
    else setLoading(false);
  }, [loadTeam, state]);

  const filteredProfiles = useMemo(() => {
    const text = search.trim().toLowerCase();
    return profiles.filter((profile) => {
      const user = users.find((candidate) => candidate.user_id === profile.user_id);
      return `${profile.full_name} ${profile.job_title} ${profile.phone} ${user?.email ?? ""}`
        .toLowerCase()
        .includes(text);
    });
  }, [profiles, search, users]);

  const availableUsers = users.filter(
    (user) =>
      user.user_id === editing || !profiles.some((profile) => profile.user_id === user.user_id),
  );

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setPhotoFile(null);
    setIdFile(null);
    setSignatureFile(null);
    setDialogOpen(true);
  };

  const startEdit = (profile: TeamProfile) => {
    setEditing(profile.user_id);
    setForm({
      user_id: profile.user_id,
      full_name: profile.full_name,
      date_of_birth: profile.date_of_birth ?? "",
      job_title: profile.job_title,
      phone: profile.phone,
      start_date: profile.start_date ?? "",
      employment_status: profile.employment_status,
      national_id_type: profile.national_id_type,
      national_id_number: profile.national_id_number,
      profile_image_path: profile.profile_image_path,
      id_document_path: profile.id_document_path,
      digital_signature_path: profile.digital_signature_path,
    });
    setPhotoFile(null);
    setIdFile(null);
    setSignatureFile(null);
    setDialogOpen(true);
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    setSaving(true);
    const uploadedTeamPaths: string[] = [];
    const uploadedSignaturePaths: string[] = [];
    let profileSaved = false;
    try {
      const profileImagePath = photoFile
        ? await uploadTeamFile(photoFile, form.user_id, "photo")
        : form.profile_image_path;
      if (photoFile && profileImagePath) uploadedTeamPaths.push(profileImagePath);
      const idDocumentPath = idFile
        ? await uploadTeamFile(idFile, form.user_id, "id")
        : form.id_document_path;
      if (idFile && idDocumentPath) uploadedTeamPaths.push(idDocumentPath);
      const signaturePath = signatureFile
        ? await uploadDigitalSignature(signatureFile)
        : form.digital_signature_path;
      if (signatureFile && signaturePath) uploadedSignaturePaths.push(signaturePath);

      const { error: saveError } = await supabase.from("cms_team_profiles").upsert({
        user_id: form.user_id,
        full_name: form.full_name.trim(),
        date_of_birth: form.date_of_birth || null,
        job_title: form.job_title.trim(),
        phone: form.phone.trim(),
        start_date: form.start_date || null,
        employment_status: form.employment_status,
        national_id_type: form.national_id_type.trim(),
        national_id_number: form.national_id_number.trim(),
        profile_image_path: profileImagePath,
        id_document_path: idDocumentPath,
        digital_signature_path: signaturePath,
        updated_at: new Date().toISOString(),
      });
      if (saveError) throw new Error(saveError.message);
      profileSaved = true;

      const oldProfile = profiles.find((profile) => profile.user_id === form.user_id);
      const pathsToRemove = [
        photoFile ? oldProfile?.profile_image_path : null,
        idFile ? oldProfile?.id_document_path : null,
      ].filter((path): path is string => Boolean(path));
      if (pathsToRemove.length) {
        const { error: removeError } = await supabase.storage
          .from("team-private")
          .remove(pathsToRemove);
        if (removeError)
          toast.error(`Profile saved, but old files could not be removed: ${removeError.message}`);
      }
      if (
        oldProfile?.digital_signature_path &&
        oldProfile.digital_signature_path !== signaturePath
      ) {
        try {
          const removed = await deleteDigitalSignature(oldProfile.digital_signature_path);
          if (!removed)
            toast.info("The previous signature was retained because an existing document uses it.");
        } catch (removeError) {
          toast.error(
            `Profile saved, but the previous signature could not be removed: ${removeError instanceof Error ? removeError.message : String(removeError)}`,
          );
        }
      }

      toast.success(editing ? "Team profile updated." : "Team profile created.");
      setDialogOpen(false);
      await loadTeam();
    } catch (saveError) {
      if (!profileSaved && uploadedTeamPaths.length) {
        const { error: cleanupError } = await supabase.storage
          .from("team-private")
          .remove(uploadedTeamPaths);
        if (cleanupError) toast.error(`Uploaded file cleanup failed: ${cleanupError.message}`);
      }
      if (!profileSaved && uploadedSignaturePaths.length) {
        const { error: cleanupError } = await supabase.storage
          .from("cytic_digital_signatures")
          .remove(uploadedSignaturePaths);
        if (cleanupError) toast.error(`Signature upload cleanup failed: ${cleanupError.message}`);
      }
      toast.error(saveError instanceof Error ? saveError.message : "Could not save team profile.");
    } finally {
      setSaving(false);
    }
  };

  const deleteProfile = async (profile: TeamProfile) => {
    if (
      !window.confirm(
        `Remove ${profile.full_name}'s team profile? Their Supabase Auth account will remain.`,
      )
    )
      return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    setDeleting(profile.user_id);
    const { error: deleteError } = await supabase
      .from("cms_team_profiles")
      .delete()
      .eq("user_id", profile.user_id);
    if (deleteError) {
      toast.error(`Could not remove profile: ${deleteError.message}`);
      setDeleting(null);
      return;
    }
    const paths = [profile.profile_image_path, profile.id_document_path].filter(
      (path): path is string => Boolean(path),
    );
    if (paths.length) {
      const { error: removeError } = await supabase.storage.from("team-private").remove(paths);
      if (removeError)
        toast.error(`Profile removed, but files could not be deleted: ${removeError.message}`);
    }
    if (profile.digital_signature_path) {
      try {
        const removed = await deleteDigitalSignature(profile.digital_signature_path);
        if (!removed)
          toast.info("The signature was retained because an existing document uses it.");
      } catch (removeError) {
        toast.error(
          `Profile removed, but its signature could not be deleted: ${removeError instanceof Error ? removeError.message : String(removeError)}`,
        );
      }
    }
    toast.success("Team profile removed. The Auth account was not deleted.");
    setDeleting(null);
    await loadTeam();
  };

  if (state.status !== "signed-in" || state.role !== "CEO") {
    return (
      <Panel title="CEO access required">
        <p className="text-sm text-muted-foreground">
          Team profiles are private and available only to the CEO.
        </p>
      </Panel>
    );
  }

  return (
    <>
      <PageHeader
        title="Team"
        description="Maintain team profiles, contact details, employee signatures, and private identity records."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => void loadTeam()} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" onClick={startCreate} disabled={!users.length}>
              <Plus className="size-4" /> Add team member
            </Button>
          </>
        }
      />

      <Panel className="mb-5">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            Team records must be linked to an existing Supabase Auth account. Profile photos and ID
            documents are kept in a private bucket and are accessible only to CEO accounts. Employee
            PNG signatures can be selected for invoices, quotations, and receipts.
          </p>
        </div>
      </Panel>

      <Panel
        title="Team directory"
        description={`${profiles.length} profile${profiles.length === 1 ? "" : "s"}`}
        flush
      >
        <div className="relative border-b p-3">
          <Search className="absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, job title, email or phone"
            aria-label="Search team"
            className="h-9 pl-8 sm:max-w-md"
          />
        </div>
        {loading ? (
          <p role="status" className="p-6 text-sm text-muted-foreground">
            Loading team profiles…
          </p>
        ) : error ? (
          <div className="p-6" role="alert">
            <p className="text-sm text-destructive">{error}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Run supabase/user-management.sql after supabase/rbac.sql and verify your CEO role.
            </p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => void loadTeam()}>
              Retry
            </Button>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">
              {profiles.length ? "No team members match" : "No team profiles yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {profiles.length
                ? "Try another search."
                : "Create a Supabase Auth account, then add its team profile here."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team member</TableHead>
                <TableHead>Login account</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Signature</TableHead>
                <TableHead>ID document</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.map((profile) => {
                const user = users.find((candidate) => candidate.user_id === profile.user_id);
                return (
                  <TableRow key={profile.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarImage src={profile.profile_image_url} alt="" />
                          <AvatarFallback>
                            {profile.full_name.slice(0, 2).toUpperCase() || (
                              <ContactRound className="size-4" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{profile.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {profile.phone || "No phone"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user?.email ?? "Account unavailable"}</TableCell>
                    <TableCell>{user?.role ?? "Unassigned"}</TableCell>
                    <TableCell>{profile.job_title || "—"}</TableCell>
                    <TableCell>{profile.employment_status}</TableCell>
                    <TableCell>
                      {profile.digital_signature_path ? "Available" : "Not set"}
                    </TableCell>
                    <TableCell>
                      {profile.id_document_url ? (
                        <a
                          className="text-primary underline"
                          href={profile.id_document_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View private file
                        </a>
                      ) : profile.national_id_number ? (
                        `${profile.national_id_type || "ID"} recorded`
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${profile.full_name}`}
                          onClick={() => startEdit(profile)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${profile.full_name}`}
                          disabled={deleting === profile.user_id}
                          onClick={() => void deleteProfile(profile)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit team profile" : "Create team profile"}</DialogTitle>
            <DialogDescription>
              Personal data and ID files are stored in CEO-restricted Supabase resources.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-5" onSubmit={(event) => void saveProfile(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="team-account">Supabase Auth account</Label>
                <Select
                  value={form.user_id}
                  disabled={Boolean(editing)}
                  onValueChange={(userId) => {
                    const selected = users.find((user) => user.user_id === userId);
                    setForm((current) => ({
                      ...current,
                      user_id: userId,
                      full_name: selected?.full_name ?? "",
                    }));
                  }}
                >
                  <SelectTrigger id="team-account">
                    <SelectValue placeholder="Choose an existing account" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-name">Full name</Label>
                <Input
                  id="team-name"
                  required
                  value={form.full_name}
                  onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-title">Job title / position</Label>
                <Input
                  id="team-title"
                  value={form.job_title}
                  onChange={(event) => setForm({ ...form, job_title: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-dob">Date of birth</Label>
                <Input
                  id="team-dob"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(event) => setForm({ ...form, date_of_birth: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-phone">Phone</Label>
                <Input
                  id="team-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-start-date">Start date</Label>
                <Input
                  id="team-start-date"
                  type="date"
                  value={form.start_date}
                  onChange={(event) => setForm({ ...form, start_date: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-status">Employment status</Label>
                <Select
                  value={form.employment_status}
                  onValueChange={(value) => {
                    if (isEmploymentStatus(value))
                      setForm((current) => ({ ...current, employment_status: value }));
                  }}
                >
                  <SelectTrigger id="team-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="On leave">On leave</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-id-type">ID type</Label>
                <Input
                  id="team-id-type"
                  placeholder="National ID, passport, driver's license…"
                  value={form.national_id_type}
                  onChange={(event) => setForm({ ...form, national_id_type: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-id-number">ID number</Label>
                <Input
                  id="team-id-number"
                  autoComplete="off"
                  value={form.national_id_number}
                  onChange={(event) => setForm({ ...form, national_id_number: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-photo">Profile photo</Label>
                <Input
                  id="team-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  {form.profile_image_path
                    ? "A photo is saved. Choose another to replace it."
                    : "Optional · JPG, PNG, WebP · up to 20 MB"}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-id-file">ID document image or PDF</Label>
                <Input
                  id="team-id-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(event) => setIdFile(event.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  {form.id_document_path
                    ? "A document is saved. Choose another to replace it."
                    : "Optional · JPG, PNG, WebP, PDF · up to 20 MB"}
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="team-signature">Digital signature (PNG, max 2 MB)</Label>
                <Input
                  id="team-signature"
                  type="file"
                  accept="image/png,.png"
                  onChange={(event) => setSignatureFile(event.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  {signatureFile
                    ? `${signatureFile.name} will replace the saved signature.`
                    : form.digital_signature_path
                      ? "A signature is saved. Choose another PNG to replace it, or remove it below."
                      : "Optional · PNG only · up to 2 MB"}
                </p>
                {form.digital_signature_path && (
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        profiles.find((profile) => profile.user_id === form.user_id)
                          ?.digital_signature_url
                      }
                      alt="Saved employee signature"
                      className="h-12 max-w-40 object-contain object-left"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSignatureFile(null);
                        setForm((current) => ({ ...current, digital_signature_path: null }));
                      }}
                    >
                      Remove signature
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !form.user_id}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create profile"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

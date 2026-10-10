export const CMS_ROLES = [
  "CEO",
  "INVESTOR",
  "PARTNER",
  "CONTENT EDITOR",
  "FINANCE",
  "SECRETARY",
  "DESIGNER",
] as const;

export type CmsRole = (typeof CMS_ROLES)[number];

export function isCmsRole(value: unknown): value is CmsRole {
  return typeof value === "string" && CMS_ROLES.some((role) => role === value);
}

export function canAccessPath(role: CmsRole | null, path: string): boolean {
  if (role === "CEO") return true;
  if (!role) return false;

  const normalizedPath = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (normalizedPath === "/analytics/invoices") return role === "FINANCE";
  const analytics = normalizedPath.startsWith("/analytics/");
  const website = [
    "/website/services",
    "/website/portfolio",
    "/website/blog",
    "/website/inquiries",
    "/website/proposals",
    "/website/quote",
    "/website/settings",
  ].includes(normalizedPath);
  const designerWorkspace = [
    "/designer-workspace",
    "/designer-workspace/palette-creator",
    "/designer-workspace/guidelines",
    "/designer-workspace/procedures",
    "/designer-workspace/policies",
    "/designer-workspace/checklist",
    "/designer-workspace/resources",
    "/designer-workspace/learning",
    "/designer-workspace/notices",
  ].includes(normalizedPath);

  switch (role) {
    case "FINANCE":
    case "SECRETARY":
      return normalizedPath === "/" || analytics;
    case "INVESTOR":
      return normalizedPath === "/";
    case "PARTNER":
      return normalizedPath === "/";
    case "CONTENT EDITOR":
      return website || designerWorkspace;
    case "DESIGNER":
      return designerWorkspace;
  }
}

export function defaultPathForRole(role: CmsRole): string {
  if (role === "CONTENT EDITOR") return "/website/portfolio";
  if (role === "DESIGNER") return "/designer-workspace";
  return "/";
}

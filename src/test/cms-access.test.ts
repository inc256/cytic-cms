import { describe, expect, it } from "vitest";

import { canAccessPath, CMS_ROLES, defaultPathForRole, isCmsRole } from "@/lib/cms-access";
import { findCrumbs } from "@/components/cms/nav";

describe("CMS role access", () => {
  it("defines the requested role set", () => {
    expect(CMS_ROLES).toEqual([
      "CEO",
      "INVESTOR",
      "PARTNER",
      "CONTENT EDITOR",
      "FINANCE",
      "SECRETARY",
      "DESIGNER",
    ]);
  });

  it("allows the CEO to access every route", () => {
    expect(canAccessPath("CEO", "/users")).toBe(true);
    expect(canAccessPath("CEO", "/analytics/finance")).toBe(true);
  });

  it("restricts Users & Permissions to the CEO", () => {
    for (const role of CMS_ROLES.filter((role) => role !== "CEO")) {
      expect(canAccessPath(role, "/users")).toBe(false);
    }
  });

  it("restricts Team to the CEO", () => {
    expect(canAccessPath("CEO", "/team")).toBe(true);
    for (const role of CMS_ROLES.filter((role) => role !== "CEO")) {
      expect(canAccessPath(role, "/team")).toBe(false);
    }
  });

  it("normalizes Designer Workspace navigation routes with a trailing slash", () => {
    expect(findCrumbs("/designer-workspace/")).toEqual(["Designer Workspace", "Designer Overview"]);
  });

  it("includes the dedicated Projects page in Business Analytics", () => {
    expect(findCrumbs("/analytics/projects")).toEqual(["Business Analytics", "Projects"]);
    expect(canAccessPath("CEO", "/analytics/projects")).toBe(true);
    expect(canAccessPath("FINANCE", "/analytics/projects")).toBe(true);
    expect(canAccessPath("SECRETARY", "/analytics/projects")).toBe(true);
    expect(canAccessPath("CONTENT EDITOR", "/analytics/projects")).toBe(false);
  });

  it("places Quotations in Business Analytics and grants its roles access", () => {
    expect(findCrumbs("/website/proposals")).toEqual(["Business Analytics", "Quotations"]);
    expect(canAccessPath("CEO", "/website/proposals")).toBe(true);
    expect(canAccessPath("FINANCE", "/website/proposals")).toBe(true);
    expect(canAccessPath("SECRETARY", "/website/proposals")).toBe(true);
    expect(canAccessPath("CONTENT EDITOR", "/website/proposals")).toBe(false);
  });

  it("keeps General Settings CEO-only and exposes landing quotes to analytics roles", () => {
    expect(findCrumbs("/settings")).toEqual(["General Settings"]);
    expect(canAccessPath("CEO", "/settings")).toBe(true);
    expect(canAccessPath("FINANCE", "/settings")).toBe(false);
    expect(findCrumbs("/website/inquiries")).toEqual(["Business Analytics", "Landing Page Quotes"]);
    expect(canAccessPath("FINANCE", "/website/inquiries")).toBe(true);
    expect(canAccessPath("PARTNER", "/website/inquiries")).toBe(true);
    expect(canAccessPath("SECRETARY", "/website/inquiries")).toBe(true);
    expect(canAccessPath("CONTENT EDITOR", "/website/inquiries")).toBe(true);
  });

  it("keeps Receipts & Transactions under Business Analytics", () => {
    expect(findCrumbs("/analytics/receipts")).toEqual([
      "Business Analytics",
      "Receipts & Transactions",
    ]);
    expect(canAccessPath("CEO", "/analytics/receipts")).toBe(true);
    expect(canAccessPath("FINANCE", "/analytics/receipts")).toBe(true);
    expect(canAccessPath("SECRETARY", "/analytics/receipts")).toBe(true);
    expect(canAccessPath("INVESTOR", "/analytics/receipts")).toBe(false);
  });

  it("shows overview to CEO, finance, investor, partner, and secretary", () => {
    for (const role of ["CEO", "FINANCE", "INVESTOR", "PARTNER", "SECRETARY"] as const) {
      expect(canAccessPath(role, "/")).toBe(true);
    }
    expect(canAccessPath("DESIGNER", "/designer-workspace/")).toBe(true);
    expect(defaultPathForRole("DESIGNER")).toBe("/designer-workspace");
    expect(canAccessPath("CONTENT EDITOR", "/")).toBe(false);
    expect(canAccessPath("DESIGNER", "/")).toBe(false);
  });

  it("limits business analytics to CEO, finance, and secretary", () => {
    expect(canAccessPath("INVESTOR", "/analytics/finance")).toBe(false);
    expect(canAccessPath("PARTNER", "/analytics/finance")).toBe(false);
    expect(canAccessPath("SECRETARY", "/analytics/finance")).toBe(true);
    expect(canAccessPath("INVESTOR", "/website/inquiries")).toBe(false);
    expect(canAccessPath("FINANCE", "/analytics/receipts")).toBe(true);
    expect(canAccessPath("FINANCE", "/analytics/invoices")).toBe(true);
    expect(canAccessPath("SECRETARY", "/analytics/invoices")).toBe(false);
    expect(canAccessPath("INVESTOR", "/analytics/invoices")).toBe(false);
    expect(defaultPathForRole("SECRETARY")).toBe("/");
  });

  it("restricts the entire Website workspace to CEO and content editor", () => {
    for (const path of [
      "/website/services",
      "/website/portfolio",
      "/website/blog",
      "/website/quote",
      "/website/settings",
    ]) {
      expect(canAccessPath("CEO", path)).toBe(true);
      expect(canAccessPath("CONTENT EDITOR", path)).toBe(true);
      expect(canAccessPath("PARTNER", path)).toBe(false);
      expect(canAccessPath("SECRETARY", path)).toBe(false);
      expect(canAccessPath("DESIGNER", path)).toBe(false);
    }
    expect(defaultPathForRole("CONTENT EDITOR")).toBe("/website/portfolio");
  });

  it("allows editors across Website while denying deleted CMS areas", () => {
    expect(canAccessPath("CONTENT EDITOR", "/website/blog")).toBe(true);
    expect(canAccessPath("CONTENT EDITOR", "/website/seo")).toBe(false);
    expect(canAccessPath("CONTENT EDITOR", "/website/pages")).toBe(false);
    expect(canAccessPath("DESIGNER", "/website/portfolio")).toBe(false);
  });

  it("limits Designer Workspace management to CEO and content editor and gives designers reader access", () => {
    for (const path of [
      "/designer-workspace",
      "/designer-workspace/palette-creator",
      "/designer-workspace/guidelines",
      "/designer-workspace/procedures",
      "/designer-workspace/policies",
      "/designer-workspace/checklist",
      "/designer-workspace/resources",
      "/designer-workspace/learning",
      "/designer-workspace/notices",
    ]) {
      expect(canAccessPath("CEO", path)).toBe(true);
      expect(canAccessPath("CONTENT EDITOR", path)).toBe(true);
      expect(canAccessPath("DESIGNER", path)).toBe(true);
      expect(canAccessPath("FINANCE", path)).toBe(false);
      expect(canAccessPath("PARTNER", path)).toBe(false);
    }
  });

  it("rejects invalid and missing roles", () => {
    expect(isCmsRole("CEO")).toBe(true);
    expect(isCmsRole("INVESTOR")).toBe(true);
    expect(isCmsRole("CONTENT EDITOR")).toBe(true);
    expect(isCmsRole("Administrator")).toBe(false);
    expect(canAccessPath(null, "/")).toBe(false);
  });
});

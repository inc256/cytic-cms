import { describe, expect, it } from "vitest";

import {
  DEFAULT_INVOICE_BANK_SETTINGS,
  DEFAULT_WEBSITE_SETTINGS,
  getDocumentBankDetails,
  getDocumentCompanyDetails,
  groupDocumentSocials,
  normalizeWebsiteSettings,
  resolveDocumentSignature,
} from "@/lib/website-cms";

describe("document settings", () => {
  it("normalizes missing and invalid settings without losing defaults", () => {
    expect(normalizeWebsiteSettings({ phone: "+256 700 000 000", show_quote: false })).toEqual({
      ...DEFAULT_WEBSITE_SETTINGS,
      phone: "+256 700 000 000",
      show_quote: false,
    });
  });

  it("groups matching social usernames into one document entry", () => {
    const settings = normalizeWebsiteSettings({
      instagram: "instagram.com/cytic",
      tiktok: "@CYTIC",
      youtube: "https://youtube.com/@cytic/videos",
      linkedin: "linkedin.com/company/another-name",
    });

    expect(groupDocumentSocials(settings)).toEqual([
      { platforms: ["Instagram", "TikTok", "YouTube"], username: "cytic" },
      { platforms: ["LinkedIn"], username: "another-name" },
    ]);
    expect(getDocumentCompanyDetails(settings)).toEqual([
      { label: "Instagram · TikTok · YouTube", value: "@cytic" },
      { label: "LinkedIn", value: "@another-name" },
    ]);
  });

  it("includes each optional invoice bank detail", () => {
    const settings = {
      ...DEFAULT_INVOICE_BANK_SETTINGS,
      bank_name: "Example Bank",
      bank_account_name: "CYTIC Creatives",
      bank_account_number: "123456",
      bank_swift: "EXAMPLEXX",
      bank_address: "Kampala",
    };

    expect(getDocumentBankDetails(settings)).toEqual([
      { label: "Bank name", value: "Example Bank" },
      { label: "Account name", value: "CYTIC Creatives" },
      { label: "Account number", value: "123456" },
      { label: "SWIFT", value: "EXAMPLEXX" },
      { label: "Bank address", value: "Kampala" },
    ]);
  });

  it("resolves company or employee signatures and leaves physical signatures empty", () => {
    const signatories = [
      {
        user_id: "employee-1",
        full_name: "Alex Employee",
        job_title: "Director",
        digital_signature_path: "signatures/employee.png",
      },
    ];

    expect(
      resolveDocumentSignature(false, "employee-1", "signatures/company.png", signatories),
    ).toEqual({
      path: null,
      userId: null,
      name: null,
    });
    expect(
      resolveDocumentSignature(true, "company", "signatures/company.png", signatories),
    ).toEqual({
      path: "signatures/company.png",
      userId: null,
      name: "CYTIC Creatives.",
    });
    expect(resolveDocumentSignature(true, "employee-1", null, signatories)).toEqual({
      path: "signatures/employee.png",
      userId: "employee-1",
      name: "Alex Employee",
    });
    expect(() => resolveDocumentSignature(true, "", null, signatories)).toThrow(
      "Choose a signatory with a saved digital signature.",
    );
  });
});

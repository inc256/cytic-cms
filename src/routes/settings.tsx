import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cms/primitives";
import { SettingsSection } from "@/components/cms/settings-form";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/settings")({
  head: () => meta("General Settings", "Company information, regional preferences and administration for CYTIC."),
  component: () => (
    <>
      <PageHeader title="General Settings" description="Company-wide configuration for the CMS." />
      <div className="grid gap-6">
        <SettingsSection title="Company" fields={[
          { id: "n", label: "Company name", value: "CYTIC Creatives" },
          { id: "pg", label: "Parent company", value: "Namielus Group Limited" },
          { id: "m", label: "Motto", value: "Identity that hits differently." },
          { id: "a", label: "Address", value: "Kampala, Uganda" },
        ]} />
        <SettingsSection title="Regional" fields={[
          { id: "c", label: "Default currency", value: "UGX" },
          { id: "tz", label: "Time zone", value: "Africa/Kampala (UTC+3)" },
          { id: "df", label: "Date format", value: "YYYY-MM-DD" },
          { id: "rp", label: "Receipt number prefix", value: "RCT-{YYYY}-" },
        ]} />
        <SettingsSection title="Security" fields={[
          { id: "2fa", label: "Require two-factor sign-in for finance roles", value: true },
          { id: "audit", label: "Keep audit log of financial changes", value: true },
        ]} />
      </div>
    </>
  ),
});

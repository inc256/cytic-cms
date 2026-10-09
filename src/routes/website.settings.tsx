import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cms/primitives";
import { SettingsSection } from "@/components/cms/settings-form";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/settings")({
  head: () => meta("Website Settings", "Contact details, social links and site behaviour for the CYTIC website."),
  component: () => (
    <>
      <PageHeader title="Website Settings" description="Public-facing details and site-wide switches." />
      <div className="grid gap-6">
        <SettingsSection title="Contact & social" fields={[
          { id: "e", label: "Public email", value: "hello@cytic.co" },
          { id: "p", label: "Phone", value: "+256 700 000 000", help: "Placeholder — replace with the real number." },
          { id: "ig", label: "Instagram", value: "@cyticcreatives" },
          { id: "li", label: "LinkedIn", value: "linkedin.com/company/cytic" },
        ]} />
        <SettingsSection title="Behaviour" fields={[
          { id: "q", label: "Show Self-Quote on the website", value: true },
          { id: "m", label: "Maintenance mode", value: false, help: "Shows a holding page to visitors." },
        ]} />
      </div>
    </>
  ),
});

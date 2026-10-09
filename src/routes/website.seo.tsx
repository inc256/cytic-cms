import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cms/primitives";
import { SettingsSection } from "@/components/cms/settings-form";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/seo")({
  head: () => meta("SEO Settings", "Search titles, descriptions and indexing for the CYTIC website."),
  component: () => (
    <>
      <PageHeader title="SEO Settings" description="How CYTIC appears in search results and when shared." />
      <div className="grid gap-6">
        <SettingsSection title="Defaults" fields={[
          { id: "t", label: "Default title", value: "CYTIC Creatives — Identity that hits differently", help: "Keep under 60 characters." },
          { id: "s", label: "Title separator", value: "—" },
          { id: "d", label: "Default description", value: "Digital products, brand identity, UI/UX design and merchandise branding from Kampala.", long: true, help: "Keep under 160 characters." },
        ]} />
        <SettingsSection title="Indexing" fields={[
          { id: "idx", label: "Allow search engines to index the site", value: true },
          { id: "map", label: "Generate sitemap automatically", value: true },
        ]} />
      </div>
    </>
  ),
});

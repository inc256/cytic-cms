import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader, Panel } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_WEBSITE_SETTINGS,
  getWebsiteSettings,
  saveWebsiteSettings,
  type WebsiteSettings,
} from "@/lib/website-cms";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/settings")({
  head: () => meta("Website Settings", "Manage landing-page behavior settings."),
  component: Page,
});

function Page() {
  const [settings, setSettings] = useState<WebsiteSettings>(DEFAULT_WEBSITE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSettings(await getWebsiteSettings());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load website settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => void load(), []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await saveWebsiteSettings(settings);
      setSaved(true);
      toast.success("Website settings saved");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setSaveError(message);
      toast.error(`Could not save website settings: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading || error) {
    return (
      <>
        <PageHeader
          title="Website Settings"
          description="Manage the public landing page and self-quote flow."
        />
        <AnalyticsState loading={loading} error={error} onRetry={() => void load()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Website Settings"
        description="These controls affect the landing page. Manage shared company details in General Settings."
      />
      <form onSubmit={(event) => void save(event)} className="grid gap-6">
        <Panel title="Landing-page behavior">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="show-quote">Show Self-Quote</Label>
                <p className="text-xs text-muted-foreground">
                  Allow visitors to request a self-quote from the landing page.
                </p>
              </div>
              <Switch
                id="show-quote"
                checked={settings.show_quote}
                onCheckedChange={(show_quote) => {
                  setSaved(false);
                  setSettings({ ...settings, show_quote });
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="maintenance-mode">Maintenance mode</Label>
                <p className="text-xs text-muted-foreground">
                  Have the public site display its maintenance page.
                </p>
              </div>
              <Switch
                id="maintenance-mode"
                checked={settings.maintenance_mode}
                onCheckedChange={(maintenance_mode) => {
                  setSaved(false);
                  setSettings({ ...settings, maintenance_mode });
                }}
              />
            </div>
          </div>
        </Panel>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save website settings"}
          </Button>
          {saved && (
            <p role="status" className="text-sm text-success">
              Website settings saved successfully.
            </p>
          )}
          {saveError && (
            <p role="alert" className="text-sm text-destructive">
              Could not save website settings: {saveError}
            </p>
          )}
        </div>
      </form>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader, Panel } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getSupabaseClient } from "@/lib/supabase";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/settings")({
  head: () => meta("Website Settings", "Manage live public contact and website behavior settings."),
  component: Page,
});

type PublicSettings = {
  public_email: string;
  phone: string;
  instagram: string;
  linkedin: string;
  show_quote: boolean;
  maintenance_mode: boolean;
};

const DEFAULTS: PublicSettings = {
  public_email: "",
  phone: "",
  instagram: "",
  linkedin: "",
  show_quote: true,
  maintenance_mode: false,
};

function Page() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    const result = await supabase
      .from("cms_website_settings")
      .select("settings")
      .eq("id", true)
      .single();
    if (result.error) setError(result.error.message);
    else setSettings({ ...DEFAULTS, ...(result.data.settings as Partial<PublicSettings>) });
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    setSaving(true);
    const result = await supabase.from("cms_website_settings").upsert({
      id: true,
      settings,
      updated_at: new Date().toISOString(),
    });
    if (result.error) toast.error(`Could not save website settings: ${result.error.message}`);
    else toast.success("Website settings saved");
    setSaving(false);
  };

  if (loading || error) {
    return (
      <>
        <PageHeader
          title="Website Settings"
          description="Manage public website contact and behavior settings."
        />
        <AnalyticsState loading={loading} error={error} onRetry={() => void load()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Website Settings"
        description="These values are saved to Supabase for the public website to consume."
      />
      <form onSubmit={(event) => void save(event)} className="grid gap-6">
        <Panel title="Contact & social">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="public-email">Public email</Label>
              <Input
                id="public-email"
                type="email"
                value={settings.public_email}
                onChange={(e) => setSettings({ ...settings, public_email: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="public-phone">Phone</Label>
              <Input
                id="public-phone"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="public-instagram">Instagram URL or handle</Label>
              <Input
                id="public-instagram"
                value={settings.instagram}
                onChange={(e) => setSettings({ ...settings, instagram: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="public-linkedin">LinkedIn URL</Label>
              <Input
                id="public-linkedin"
                value={settings.linkedin}
                onChange={(e) => setSettings({ ...settings, linkedin: e.target.value })}
              />
            </div>
          </div>
        </Panel>
        <Panel title="Website behavior">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="show-quote">Show Self-Quote</Label>
                <p className="text-xs text-muted-foreground">
                  Allow visitors to access the quote flow.
                </p>
              </div>
              <Switch
                id="show-quote"
                checked={settings.show_quote}
                onCheckedChange={(show_quote) => setSettings({ ...settings, show_quote })}
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
                onCheckedChange={(maintenance_mode) =>
                  setSettings({ ...settings, maintenance_mode })
                }
              />
            </div>
          </div>
        </Panel>
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save website settings"}
          </Button>
        </div>
      </form>
    </>
  );
}

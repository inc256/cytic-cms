import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AnalyticsState } from "@/components/cms/analytics-state";
import { PageHeader, Panel } from "@/components/cms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useWebsiteRows } from "@/hooks/use-website-rows";
import { getSupabaseClient } from "@/lib/supabase";
import { deleteWebsiteRow, saveWebsiteRow, type WebsiteService } from "@/lib/website-cms";
import { formatMoney } from "@/lib/format";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/website/quote")({
  head: () =>
    meta("Self-Quote & Pricing", "Configure live quote-flow settings, pricing and questions."),
  component: Page,
});

type PriceRule = {
  id: string;
  service: string;
  item: string;
  unit: string;
  base_price: number;
  active: boolean;
};
type ScopeQuestion = {
  id: string;
  question: string;
  applies_to: string;
  input_type: string;
  pricing_rule: string;
};
type QuoteSettings = { service_availability: Record<string, boolean>; disclaimer: string };
const STEPS = [
  "What do you need?",
  "Select specific services",
  "Define project scope",
  "Business & project info",
  "Expected timeline",
  "Contact details",
  "Review initial estimate",
  "Request a detailed proposal",
];
const DEFAULT_DISCLAIMER =
  "This Self-Quote is an initial estimate only. It is not a final quotation, invoice, contract or binding commercial offer. A detailed proposal will follow a review of your requirements.";

function Page() {
  const services = useWebsiteRows<WebsiteService>("cms_website_services", "sort_order");
  const pricing = useWebsiteRows<PriceRule>("cms_quote_pricing", "sort_order");
  const questions = useWebsiteRows<ScopeQuestion>("cms_quote_questions", "sort_order");
  const [settings, setSettings] = useState<QuoteSettings>({
    service_availability: {},
    disclaimer: DEFAULT_DISCLAIMER,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const refreshSettings = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      setSettingsLoading(false);
      return;
    }
    const result = await supabase.from("cms_quote_settings").select("*").eq("id", true).single();
    if (result.error) toast.error(`Could not load quote settings: ${result.error.message}`);
    else if (result.data) {
      setSettings({
        service_availability: (result.data.service_availability as Record<string, boolean>) ?? {},
        disclaimer: result.data.disclaimer,
      });
    }
    setSettingsLoading(false);
  };

  useEffect(() => {
    void refreshSettings();
  }, []);

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    setSavingSettings(true);
    const result = await supabase.from("cms_quote_settings").upsert({
      id: true,
      service_availability: settings.service_availability,
      disclaimer: settings.disclaimer,
      updated_at: new Date().toISOString(),
    });
    if (result.error) toast.error(`Could not save quote settings: ${result.error.message}`);
    else toast.success("Quote settings saved");
    setSavingSettings(false);
  };

  const addPricing = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const pricingForm = event.currentTarget;
    const form = new FormData(event.currentTarget);
    try {
      await saveWebsiteRow("cms_quote_pricing", {
        service: String(form.get("service")).trim(),
        item: String(form.get("item")).trim(),
        unit: String(form.get("unit")).trim(),
        base_price: Number(form.get("base_price")),
      });
      toast.success("Pricing rule added");
      pricingForm.reset();
      await pricing.refresh();
    } catch (error) {
      toast.error(
        `Could not add pricing rule: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const addQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const questionForm = event.currentTarget;
    const form = new FormData(event.currentTarget);
    try {
      await saveWebsiteRow("cms_quote_questions", {
        question: String(form.get("question")).trim(),
        applies_to: String(form.get("applies_to")).trim(),
        input_type: String(form.get("input_type")).trim(),
        pricing_rule: String(form.get("pricing_rule")).trim(),
      });
      toast.success("Scope question added");
      questionForm.reset();
      await questions.refresh();
    } catch (error) {
      toast.error(
        `Could not add scope question: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const togglePricing = async (rule: PriceRule) => {
    try {
      await saveWebsiteRow("cms_quote_pricing", { active: !rule.active }, rule.id);
      await pricing.refresh();
    } catch (error) {
      toast.error(
        `Could not update pricing rule: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const remove = async (table: string, id: string, label: string, refresh: () => Promise<void>) => {
    try {
      await deleteWebsiteRow(table, id);
      toast.success(`${label} deleted`);
      await refresh();
    } catch (error) {
      toast.error(
        `Could not delete ${label.toLowerCase()}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const loadError = services.error ?? pricing.error ?? questions.error;
  const isLoading = services.loading || pricing.loading || questions.loading || settingsLoading;

  return (
    <>
      <PageHeader
        title="Self-Quote & Pricing"
        description="Manage the live quote-flow availability, pricing rules, scope questions and disclaimer."
      />
      <AnalyticsState
        loading={isLoading}
        error={loadError}
        onRetry={() => {
          void services.refresh();
          void pricing.refresh();
          void questions.refresh();
          void refreshSettings();
        }}
      />
      {!isLoading && !loadError && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Public quote steps">
              <ol className="divide-y">
                {STEPS.map((step, index) => (
                  <li key={step} className="flex items-center gap-3 py-2 text-sm">
                    <span className="grid size-7 place-items-center rounded-full bg-primary-subtle text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </Panel>
            <Panel
              title="Service availability"
              description="Disabled services are hidden in the public quote flow."
            >
              {services.rows.length ? (
                <ul className="space-y-4">
                  {services.rows.map((service) => (
                    <li key={service.id} className="flex items-center justify-between gap-4">
                      <div>
                        <Label htmlFor={`available-${service.id}`}>{service.name}</Label>
                        <p className="text-xs text-muted-foreground">{service.category}</p>
                      </div>
                      <Switch
                        id={`available-${service.id}`}
                        checked={settings.service_availability[service.id] ?? true}
                        onCheckedChange={(checked) =>
                          setSettings({
                            ...settings,
                            service_availability: {
                              ...settings.service_availability,
                              [service.id]: checked,
                            },
                          })
                        }
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add services before managing quote availability.
                </p>
              )}
            </Panel>
          </div>

          <Panel title="Pricing rules" description="Amounts are stored in UGX whole shillings.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    {["Service", "Item", "Unit", "Starting price", "Active", ""].map(
                      (heading, i) => (
                        <th key={`${heading}-${i}`} className="px-3 py-2">
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pricing.rows.map((rule) => (
                    <tr key={rule.id}>
                      <td className="px-3 py-2">{rule.service}</td>
                      <td className="px-3 py-2">{rule.item}</td>
                      <td className="px-3 py-2">{rule.unit}</td>
                      <td className="px-3 py-2">{formatMoney(Number(rule.base_price))}</td>
                      <td className="px-3 py-2">
                        <Switch
                          aria-label={`${rule.active ? "Disable" : "Enable"} ${rule.item}`}
                          checked={rule.active}
                          onCheckedChange={() => void togglePricing(rule)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            void remove(
                              "cms_quote_pricing",
                              rule.id,
                              "Pricing rule",
                              pricing.refresh,
                            )
                          }
                          aria-label="Delete pricing rule"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form
              onSubmit={(event) => void addPricing(event)}
              className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div className="grid gap-1.5">
                <Label htmlFor="price-service">Service</Label>
                <Input id="price-service" name="service" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="price-item">Item</Label>
                <Input id="price-item" name="item" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="price-unit">Unit</Label>
                <Input id="price-unit" name="unit" placeholder="project, screen, page…" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="price-base">Starting price (UGX)</Label>
                <Input id="price-base" name="base_price" type="number" min="0" step="1" required />
              </div>
              <Button type="submit" size="sm" className="sm:col-span-2 lg:col-span-4">
                <Plus className="size-4" /> Add pricing rule
              </Button>
            </form>
          </Panel>

          <Panel title="Scope questions">
            <div className="space-y-2">
              {questions.rows.map((question) => (
                <div
                  key={question.id}
                  className="flex items-start justify-between gap-3 border-b py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{question.question}</p>
                    <p className="text-xs text-muted-foreground">
                      {question.applies_to} · {question.input_type} · {question.pricing_rule}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      void remove(
                        "cms_quote_questions",
                        question.id,
                        "Scope question",
                        questions.refresh,
                      )
                    }
                    aria-label="Delete scope question"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <form
              onSubmit={(event) => void addQuestion(event)}
              className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"
            >
              <div className="grid gap-1.5">
                <Label htmlFor="question-text">Question</Label>
                <Input id="question-text" name="question" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="question-applies">Applies to</Label>
                <Input id="question-applies" name="applies_to" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="question-type">Input type</Label>
                <Input
                  id="question-type"
                  name="input_type"
                  placeholder="text, range, select…"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="question-rule">Pricing rule</Label>
                <Input id="question-rule" name="pricing_rule" />
              </div>
              <Button type="submit" size="sm" className="sm:col-span-2">
                <Plus className="size-4" /> Add scope question
              </Button>
            </form>
          </Panel>

          <Panel title="Estimate disclaimer" description="Shown alongside the initial estimate.">
            <form onSubmit={(event) => void saveSettings(event)} className="space-y-3">
              <Textarea
                rows={4}
                value={settings.disclaimer}
                onChange={(event) => setSettings({ ...settings, disclaimer: event.target.value })}
              />
              <div className="flex items-start gap-2 rounded-md border border-gold/40 bg-warning-subtle p-3 text-xs text-gold-foreground">
                <AlertTriangle className="size-4 shrink-0" />
                {settings.disclaimer}
              </div>
              <Button size="sm" type="submit" disabled={savingSettings}>
                {savingSettings ? "Saving…" : "Save quote settings"}
              </Button>
            </form>
          </Panel>
        </div>
      )}
    </>
  );
}

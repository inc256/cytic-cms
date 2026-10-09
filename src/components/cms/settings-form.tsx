import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Panel } from "./primitives";

export type SettingField = { id: string; label: string; value: string | boolean; help?: string; long?: boolean };

export function SettingsSection({ title, description, fields }: { title: string; description?: string | undefined; fields: SettingField[] }) {
  return (
    <Panel title={title} description={description}>
      <form className="grid gap-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); toast.success(`${title} saved`, { description: "Demo session only." }); }}>
        {fields.map((f) => typeof f.value === "boolean" ? (
          <div key={f.id} className="flex items-start justify-between gap-4 sm:col-span-2">
            <div><Label htmlFor={f.id}>{f.label}</Label>{f.help && <p className="mt-0.5 text-xs text-muted-foreground">{f.help}</p>}</div>
            <Switch id={f.id} defaultChecked={f.value} />
          </div>
        ) : (
          <div key={f.id} className={`grid gap-1.5 ${f.long ? "sm:col-span-2" : ""}`}>
            <Label htmlFor={f.id}>{f.label}</Label>
            {f.long ? <Textarea id={f.id} defaultValue={f.value} rows={3} /> : <Input id={f.id} defaultValue={f.value} />}
            {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
          </div>
        ))}
        <div className="sm:col-span-2"><Button type="submit" size="sm">Save changes</Button></div>
      </form>
    </Panel>
  );
}

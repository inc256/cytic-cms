import { createFileRoute } from "@tanstack/react-router";
import { Check, Minus } from "lucide-react";
import { PageHeader, Panel } from "@/components/cms/primitives";
import { ResourceTable } from "@/components/cms/resource-table";
import { users } from "@/lib/demo-data";
import { meta } from "@/lib/seo";

export const Route = createFileRoute("/users")({
  head: () => meta("Users & Permissions", "Manage who can access the CYTIC CMS and what they can do."),
  component: Page,
});
const roles = ["Owner", "Finance", "Content editor", "Sales"];
const perms: [string, boolean[]][] = [
  ["View analytics", [true, true, false, true]],
  ["Record income & expenses", [true, true, false, false]],
  ["Issue receipts", [true, true, false, false]],
  ["Edit website content", [true, false, true, false]],
  ["Manage pricing", [true, false, false, true]],
  ["Manage leads & proposals", [true, false, false, true]],
  ["Manage users", [true, false, false, false]],
];

function Page() {
  return (
    <>
      <PageHeader title="Users & Permissions" description="Invite teammates and assign roles. Roles control what each person can see and change." />
      <ResourceTable entity="User" rows={users} statusKey="status" searchKeys={["name", "email", "role"]}
        columns={[{ key: "name", label: "Name", className: "font-medium" }, { key: "email", label: "Email" }, { key: "role", label: "Role" }, { key: "status", label: "Status" }, { key: "last", label: "Last active" }]}
        fields={[{ key: "name", label: "Full name", required: true }, { key: "email", label: "Email", required: true }, { key: "role", label: "Role", type: "select", options: roles }, { key: "status", label: "Status", type: "select", options: ["Invited", "Active"] }]} />
      <Panel title="Role permissions" className="mt-6" flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground"><th className="px-5 py-2.5 text-left font-medium">Permission</th>{roles.map((r) => <th key={r} className="px-5 py-2.5 text-center font-medium">{r}</th>)}</tr></thead>
            <tbody className="divide-y">{perms.map(([p, v]) => (
              <tr key={p}><td className="px-5 py-3">{p}</td>{v.map((ok, i) => <td key={i} className="px-5 py-3 text-center">{ok ? <Check className="mx-auto size-4 text-primary" aria-label="Allowed" /> : <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label="Not allowed" />}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

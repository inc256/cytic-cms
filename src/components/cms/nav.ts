import {
  LayoutDashboard,
  LineChart,
  Globe,
  Users,
  BookOpen,
  ContactRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { title: string; to: string };
export type NavGroup = {
  title: string;
  icon: LucideIcon;
  to?: string;
  num?: string;
  sections?: { label?: string; items: NavItem[] }[];
};

export const NAV: NavGroup[] = [
  { title: "Overview", icon: LayoutDashboard, to: "/" },
  {
    title: "Business Analytics",
    num: "01",
    icon: LineChart,
    sections: [
      {
        items: [
          { title: "Business Performance", to: "/analytics/performance" },
          { title: "Income & Expenditure", to: "/analytics/finance" },
          { title: "Receipts & Transactions", to: "/analytics/receipts" },
          { title: "Service Analytics", to: "/analytics/services" },
          { title: "Business Trends", to: "/analytics/trends" },
          { title: "Goals & Reports", to: "/analytics/goals" },
        ],
      },
    ],
  },
  {
    title: "Website",
    num: "02",
    icon: Globe,
    sections: [
      {
        label: "Content",
        items: [
          { title: "Services & Categories", to: "/website/services" },
          { title: "Portfolio & Case Studies", to: "/website/portfolio" },
          { title: "Blog & Articles", to: "/website/blog" },
        ],
      },
      {
        label: "Client acquisition",
        items: [
          { title: "Self-Quote & Pricing", to: "/website/quote" },
          { title: "Inquiries & Leads", to: "/website/inquiries" },
          { title: "Proposals", to: "/website/proposals" },
        ],
      },
      { label: "Configuration", items: [{ title: "Website Settings", to: "/website/settings" }] },
    ],
  },
  {
    title: "Designer Workspace",
    num: "03",
    icon: BookOpen,
    sections: [
      {
        items: [
          { title: "Designer Overview", to: "/designer-workspace" },
          { title: "Palette Creator", to: "/designer-workspace/palette-creator" },
          { title: "Guidelines & Handbook", to: "/designer-workspace/guidelines" },
          { title: "Work Procedures", to: "/designer-workspace/procedures" },
          { title: "Rules & Policies", to: "/designer-workspace/policies" },
          { title: "Quality Checklist", to: "/designer-workspace/checklist" },
          { title: "Resources & Templates", to: "/designer-workspace/resources" },
          { title: "Learning & Development", to: "/designer-workspace/learning" },
          { title: "Notices & Updates", to: "/designer-workspace/notices" },
        ],
      },
    ],
  },
  { title: "Users & Permissions", num: "04", icon: Users, to: "/users" },
  { title: "Team", num: "05", icon: ContactRound, to: "/team" },
];

export function findCrumbs(path: string): string[] {
  const normalizedPath = path.length > 1 ? path.replace(/\/+$/, "") : path;
  for (const g of NAV) {
    if (g.to === normalizedPath) return [g.title];
    for (const s of g.sections ?? [])
      for (const i of s.items) if (i.to === normalizedPath) return [g.title, i.title];
  }
  return [];
}

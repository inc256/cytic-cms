import {
  LayoutDashboard, LineChart, Globe, Users, Settings, type LucideIcon,
} from "lucide-react";

export type NavItem = { title: string; to: string };
export type NavGroup = {
  title: string; icon: LucideIcon; to?: string; num?: string;
  sections?: { label?: string; items: NavItem[] }[];
};

export const NAV: NavGroup[] = [
  { title: "Overview", icon: LayoutDashboard, to: "/" },
  {
    title: "Business Analytics", num: "01", icon: LineChart,
    sections: [{ items: [
      { title: "Business Performance", to: "/analytics/performance" },
      { title: "Income & Expenditure", to: "/analytics/finance" },
      { title: "Receipts & Transactions", to: "/analytics/receipts" },
      { title: "Service Analytics", to: "/analytics/services" },
      { title: "Business Trends", to: "/analytics/trends" },
      { title: "Goals & Reports", to: "/analytics/goals" },
    ] }],
  },
  {
    title: "Website", num: "02", icon: Globe,
    sections: [
      { label: "Content", items: [
        { title: "Pages & Sections", to: "/website/pages" },
        { title: "Services & Categories", to: "/website/services" },
        { title: "Portfolio & Case Studies", to: "/website/portfolio" },
        { title: "Blog & Articles", to: "/website/blog" },
        { title: "Media Library", to: "/website/media" },
      ] },
      { label: "Client acquisition", items: [
        { title: "Self-Quote & Pricing", to: "/website/quote" },
        { title: "Inquiries & Leads", to: "/website/inquiries" },
        { title: "Proposals", to: "/website/proposals" },
      ] },
      { label: "Configuration", items: [
        { title: "SEO Settings", to: "/website/seo" },
        { title: "Website Settings", to: "/website/settings" },
      ] },
    ],
  },
  { title: "Users & Permissions", num: "03", icon: Users, to: "/users" },
  { title: "General Settings", num: "04", icon: Settings, to: "/settings" },
];

export function findCrumbs(path: string): string[] {
  for (const g of NAV) {
    if (g.to === path) return [g.title];
    for (const s of g.sections ?? []) for (const i of s.items) if (i.to === path) return [g.title, i.title];
  }
  return [];
}

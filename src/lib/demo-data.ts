// DEMO DATA — integration boundary.
// Every record here is sample data for UI demonstration only. Replace these
// exports with Lovable Cloud queries when the backend is connected.
// Money is stored as integer minor units (UGX has no minor unit, so whole shillings).

export const CURRENCY = "UGX";
export const formatMoney = (amount: number, currency = CURRENCY) =>
  `${currency} ${amount.toLocaleString("en-US")}`;
export const formatCompact = (n: number) =>
  Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const SERVICES = [
  { id: "digital", name: "Digital Products", short: "Websites, web apps and mobile apps", color: "var(--chart-1)" },
  { id: "brand", name: "Brand Identity & Logo Design", short: "Logos, identity systems, guidelines", color: "var(--chart-2)" },
  { id: "uiux", name: "UI/UX Design", short: "Research, wireframes, interfaces", color: "var(--chart-3)" },
  { id: "merch", name: "Merchandise Branding", short: "Promotional wear, packaging, print", color: "var(--chart-4)" },
] as const;

export const monthly = [
  { month: "May", income: 18400000, expense: 9100000, inquiries: 21, proposals: 9, accepted: 4 },
  { month: "Jun", income: 22100000, expense: 10400000, inquiries: 26, proposals: 11, accepted: 5 },
  { month: "Jul", income: 19800000, expense: 11800000, inquiries: 24, proposals: 10, accepted: 4 },
  { month: "Aug", income: 27500000, expense: 12200000, inquiries: 31, proposals: 14, accepted: 7 },
  { month: "Sep", income: 31200000, expense: 13900000, inquiries: 35, proposals: 15, accepted: 8 },
  { month: "Oct", income: 12600000, expense: 5400000, inquiries: 14, proposals: 6, accepted: 2 },
];

export const revenueByService = [
  { service: "Digital Products", value: 54200000 },
  { service: "Brand Identity", value: 38100000 },
  { service: "UI/UX Design", value: 26800000 },
  { service: "Merchandise", value: 12500000 },
];

export type Txn = {
  id: string; type: "income" | "expense"; date: string; party: string; project: string;
  description: string; category: string; amount: number; method: string; reference: string;
  status: "cleared" | "partial" | "refunded"; notes?: string;
};

export const transactions: Txn[] = [
  { id: "INC-2026-0142", type: "income", date: "2026-10-07", party: "Kampala Roastery Ltd", project: "Roastery rebrand", description: "Deposit 50%", category: "Brand Identity", amount: 4500000, method: "Bank transfer", reference: "STB-889211", status: "partial" },
  { id: "INC-2026-0141", type: "income", date: "2026-10-03", party: "Nile Fintech", project: "Wallet app UI", description: "Milestone 2", category: "UI/UX Design", amount: 6200000, method: "Mobile money", reference: "MTN-55120", status: "cleared" },
  { id: "EXP-2026-0098", type: "expense", date: "2026-10-02", party: "Figma Inc.", project: "—", description: "Team licences (Q4)", category: "Software", amount: 1350000, method: "Card", reference: "FIG-3341", status: "cleared" },
  { id: "INC-2026-0140", type: "income", date: "2026-09-28", party: "Akwaaba Hotels", project: "Booking website", description: "Final payment", category: "Digital Products", amount: 9800000, method: "Bank transfer", reference: "ABS-77310", status: "cleared" },
  { id: "EXP-2026-0097", type: "expense", date: "2026-09-26", party: "PrintHub Uganda", project: "Roastery rebrand", description: "Packaging samples", category: "Production", amount: 2100000, method: "Bank transfer", reference: "PH-2201", status: "cleared" },
  { id: "INC-2026-0139", type: "income", date: "2026-09-21", party: "Zuri Wellness", project: "Merch drop", description: "Branded apparel", category: "Merchandise", amount: 3400000, method: "Mobile money", reference: "AIR-10923", status: "cleared" },
  { id: "EXP-2026-0096", type: "expense", date: "2026-09-18", party: "Office rent", project: "—", description: "September rent", category: "Operations", amount: 3000000, method: "Bank transfer", reference: "RNT-0918", status: "cleared" },
  { id: "INC-2026-0138", type: "income", date: "2026-09-12", party: "Pearl Logistics", project: "Fleet dashboard", description: "Refund — scope reduction", category: "Digital Products", amount: 800000, method: "Bank transfer", reference: "SCB-4410", status: "refunded" },
  { id: "EXP-2026-0095", type: "expense", date: "2026-09-10", party: "Freelance illustrator", project: "Zuri Wellness", description: "Illustration set", category: "Contractors", amount: 1800000, method: "Mobile money", reference: "MTN-44021", status: "cleared" },
];

export const receipts = [
  { no: "RCT-2026-0087", date: "2026-10-07", client: "Kampala Roastery Ltd", txn: "INC-2026-0142", project: "Roastery rebrand", paid: 4500000, total: 9000000, method: "Bank transfer", issuedBy: "Amara Nalwoga" },
  { no: "RCT-2026-0086", date: "2026-10-03", client: "Nile Fintech", txn: "INC-2026-0141", project: "Wallet app UI", paid: 6200000, total: 18600000, method: "Mobile money", issuedBy: "Amara Nalwoga" },
  { no: "RCT-2026-0085", date: "2026-09-28", client: "Akwaaba Hotels", txn: "INC-2026-0140", project: "Booking website", paid: 9800000, total: 19600000, method: "Bank transfer", issuedBy: "Daniel Okello" },
  { no: "RCT-2026-0084", date: "2026-09-21", client: "Zuri Wellness", txn: "INC-2026-0139", project: "Merch drop", paid: 3400000, total: 3400000, method: "Mobile money", issuedBy: "Daniel Okello" },
];

export const inquiries = [
  { id: "LD-311", name: "Grace Atim", company: "Atim Organics", service: "Brand Identity", budget: 6000000, source: "Self-Quote", status: "New", date: "2026-10-08" },
  { id: "LD-310", name: "Ibrahim Ssali", company: "Ssali Motors", service: "Digital Products", budget: 14000000, source: "Contact form", status: "Contacted", date: "2026-10-06" },
  { id: "LD-309", name: "Lydia Achieng", company: "Bloom Salon", service: "Merchandise", budget: 2500000, source: "Self-Quote", status: "Qualified", date: "2026-10-04" },
  { id: "LD-308", name: "Peter Mugisha", company: "AgriLink", service: "UI/UX Design", budget: 9000000, source: "Referral", status: "Proposal sent", date: "2026-10-01" },
  { id: "LD-307", name: "Sarah Namubiru", company: "Kora Studio", service: "Brand Identity", budget: 4000000, source: "Self-Quote", status: "Lost", date: "2026-09-27" },
  { id: "LD-306", name: "Joel Kato", company: "EduSpark", service: "Digital Products", budget: 22000000, source: "Self-Quote", status: "Won", date: "2026-09-20" },
];

export const proposals = [
  { id: "PRP-058", client: "AgriLink", title: "Farmer marketplace UX", value: 9400000, status: "Sent", updated: "2026-10-05", validUntil: "2026-10-31" },
  { id: "PRP-057", client: "Ssali Motors", title: "Dealer website + CMS", value: 15800000, status: "Draft", updated: "2026-10-07", validUntil: "—" },
  { id: "PRP-056", client: "EduSpark", title: "Learning platform MVP", value: 21500000, status: "Accepted", updated: "2026-09-24", validUntil: "2026-10-15" },
  { id: "PRP-055", client: "Kora Studio", title: "Identity refresh", value: 4200000, status: "Declined", updated: "2026-09-29", validUntil: "2026-10-10" },
];

export const activity = [
  { kind: "quote", text: "New Self-Quote request from Atim Organics", time: "2h ago" },
  { kind: "payment", text: "Payment of UGX 4,500,000 recorded — Kampala Roastery", time: "1d ago" },
  { kind: "proposal", text: "Proposal PRP-057 saved as draft", time: "1d ago" },
  { kind: "inquiry", text: "Inquiry submitted by Ssali Motors", time: "3d ago" },
  { kind: "expense", text: "Expense recorded — Figma licences", time: "6d ago" },
  { kind: "content", text: "Case study “Akwaaba Hotels” published", time: "1w ago" },
];

export const goals = [
  { name: "Monthly revenue target", target: 30000000, actual: 12600000, unit: "money" },
  { name: "Monthly expenditure limit", target: 14000000, actual: 5400000, unit: "money" },
  { name: "New clients this quarter", target: 12, actual: 5, unit: "count" },
  { name: "Proposal conversion", target: 50, actual: 41, unit: "percent" },
];

export const users = [
  { name: "Amara Nalwoga", email: "amara@cytic.co", role: "Owner", status: "Active", last: "Just now" },
  { name: "Daniel Okello", email: "daniel@cytic.co", role: "Finance", status: "Active", last: "3h ago" },
  { name: "Ruth Kembabazi", email: "ruth@cytic.co", role: "Content editor", status: "Active", last: "Yesterday" },
  { name: "Brian Tumusiime", email: "brian@cytic.co", role: "Sales", status: "Invited", last: "—" },
];

export const pages = [
  { title: "Home", slug: "/", sections: 7, status: "Published", updated: "2026-10-02" },
  { title: "About", slug: "/about", sections: 5, status: "Published", updated: "2026-09-14" },
  { title: "Services", slug: "/services", sections: 6, status: "Published", updated: "2026-09-30" },
  { title: "Work", slug: "/work", sections: 3, status: "Published", updated: "2026-10-05" },
  { title: "Self-Quote", slug: "/quote", sections: 8, status: "Draft", updated: "2026-10-08" },
  { title: "Contact", slug: "/contact", sections: 3, status: "Published", updated: "2026-08-21" },
];

export const portfolio = [
  { title: "Akwaaba Hotels", service: "Digital Products", year: 2026, status: "Published", featured: true },
  { title: "Nile Fintech Wallet", service: "UI/UX Design", year: 2026, status: "Draft", featured: false },
  { title: "Kampala Roastery", service: "Brand Identity", year: 2026, status: "In review", featured: true },
  { title: "Zuri Wellness Merch", service: "Merchandise", year: 2025, status: "Published", featured: false },
];

export const articles = [
  { title: "Why identity systems outlive logos", category: "Branding", author: "Ruth Kembabazi", status: "Published", date: "2026-09-18" },
  { title: "Designing for mobile money users", category: "UI/UX", author: "Amara Nalwoga", status: "Scheduled", date: "2026-10-14" },
  { title: "Merch that people actually wear", category: "Merchandise", author: "Ruth Kembabazi", status: "Draft", date: "—" },
];

export const media = [
  { name: "akwaaba-hero.jpg", type: "Image", size: "1.2 MB", used: 3 },
  { name: "roastery-logo.svg", type: "Vector", size: "48 KB", used: 2 },
  { name: "nile-wallet-flow.png", type: "Image", size: "2.4 MB", used: 1 },
  { name: "brand-guidelines.pdf", type: "Document", size: "6.1 MB", used: 0 },
  { name: "zuri-tees.jpg", type: "Image", size: "980 KB", used: 2 },
  { name: "showreel-2026.mp4", type: "Video", size: "18 MB", used: 1 },
];

export const pricing = [
  { service: "Digital Products", item: "Business website", base: 6500000, unit: "project", active: true },
  { service: "Digital Products", item: "Web application", base: 15000000, unit: "project", active: true },
  { service: "Brand Identity", item: "Logo design", base: 1800000, unit: "project", active: true },
  { service: "Brand Identity", item: "Full identity system", base: 5500000, unit: "project", active: true },
  { service: "UI/UX Design", item: "UX audit", base: 2500000, unit: "project", active: true },
  { service: "UI/UX Design", item: "Interface design", base: 450000, unit: "screen", active: true },
  { service: "Merchandise", item: "Promotional wear", base: 35000, unit: "piece", active: true },
  { service: "Merchandise", item: "Packaging design", base: 2200000, unit: "project", active: false },
];

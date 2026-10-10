import { getSupabaseClient } from "@/lib/supabase";

export type BusinessProject = {
  id: string;
  project_code: string;
  name: string;
  client_name: string;
  service_category: string;
  contract_value: number;
  status: "In Progress" | "Completed" | "On Hold" | "Cancelled";
  completed_at: string | null;
  created_at: string;
};

export type FinancialTransaction = {
  id: string;
  transaction_ref: string;
  transaction_type: "income" | "expense" | "refund";
  transaction_date: string;
  party: string;
  project_id: string | null;
  service_category: string | null;
  description: string;
  amount: number;
  method: string;
  payment_reference: string | null;
  receipt_number: string | null;
  created_at: string;
};

export type BusinessGoal = {
  id: string;
  name: string;
  metric: "revenue" | "expenses" | "inquiries" | "projects_completed";
  target: number;
  period_start: string;
  period_end: string;
  created_at: string;
};

export type QuoteRequest = {
  quote_id: string;
  business_name: string;
  selected_services: unknown;
  status: string;
  created_at: string;
};

export type AnalyticsData = {
  projects: BusinessProject[];
  transactions: FinancialTransaction[];
  goals: BusinessGoal[];
  quotes: QuoteRequest[];
};

export type PeriodRange = { start: Date; end: Date };

export function getPeriodRange(period: string, now = new Date()): PeriodRange {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "This week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (period === "This month") {
    start.setDate(1);
  } else if (period === "This year") {
    start.setMonth(0, 1);
  } else {
    const quarterMonth = Math.floor(start.getMonth() / 3) * 3;
    start.setMonth(quarterMonth, 1);
  }

  return { start, end };
}

export function getPreviousPeriodRange(period: string, now = new Date()): PeriodRange {
  const current = getPeriodRange(period, now);
  const start = new Date(current.start);
  const end = new Date(current.start);
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 999);

  if (period === "This week") {
    start.setDate(start.getDate() - 7);
  } else if (period === "This month") {
    start.setMonth(start.getMonth() - 1, 1);
  } else if (period === "This year") {
    start.setFullYear(start.getFullYear() - 1, 0, 1);
  } else {
    start.setMonth(start.getMonth() - 3, 1);
  }

  return { start, end };
}

export function inRange(value: string, range: PeriodRange): boolean {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return date >= range.start && date <= range.end;
}

export function sumTransactions(
  transactions: FinancialTransaction[],
  type: FinancialTransaction["transaction_type"],
  range?: PeriodRange,
): number {
  return transactions
    .filter((transaction) => transaction.transaction_type === type)
    .filter((transaction) => !range || inRange(transaction.transaction_date, range))
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
}

function getServiceNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const serviceNames: Record<string, string> = {
    digital: "Digital Products",
    brand: "Brand Identity & Logo Design",
    uiux: "UI/UX Design",
    merch: "Merchandise Branding",
  };
  return value
    .map((item) => {
      if (typeof item === "string") return serviceNames[item] ?? item;
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const label =
          record.name ??
          record.label ??
          record.title ??
          record.service_name ??
          record.service ??
          record.id;
        if (typeof label !== "string") return "";
        return serviceNames[label] ?? label;
      }
      return "";
    })
    .filter(Boolean);
}

export function buildMonthlySeries(data: AnalyticsData, count = 6, endDate = new Date()) {
  const first = new Date(endDate.getFullYear(), endDate.getMonth() - count + 1, 1);
  const periods = Array.from({ length: count }, (_, index) => {
    const date = new Date(first.getFullYear(), first.getMonth() + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en", { month: "short", year: "2-digit" });
    return { key, month: label, income: 0, expense: 0, inquiries: 0, proposals: 0, accepted: 0 };
  });
  const byKey = new Map(periods.map((period) => [period.key, period]));

  for (const transaction of data.transactions) {
    const key = transaction.transaction_date.slice(0, 7);
    const period = byKey.get(key);
    if (!period) continue;
    const amount = Number(transaction.amount);
    if (transaction.transaction_type === "income") period.income += amount;
    if (transaction.transaction_type === "expense") period.expense += amount;
    if (transaction.transaction_type === "refund") period.income -= amount;
  }

  for (const quote of data.quotes) {
    const period = byKey.get(quote.created_at.slice(0, 7));
    if (!period) continue;
    period.inquiries += 1;
    if (["Proposal Sent", "Approved", "In Progress", "Completed"].includes(quote.status)) {
      period.proposals += 1;
    }
    if (["Approved", "In Progress", "Completed"].includes(quote.status)) {
      period.accepted += 1;
    }
  }

  return periods.map(({ key: _key, ...period }) => period);
}

export function buildServiceAnalytics(data: AnalyticsData) {
  const grouped = new Map<
    string,
    {
      service: string;
      inquiries: number;
      quotes: number;
      accepted: number;
      completed: number;
      revenue: number;
    }
  >();
  for (const quote of data.quotes) {
    const requested = getServiceNames(quote.selected_services);
    for (const service of requested) {
      const row = grouped.get(service) ?? {
        service,
        inquiries: 0,
        quotes: 0,
        accepted: 0,
        completed: 0,
        revenue: 0,
      };
      row.inquiries += 1;
      row.quotes += 1;
      if (["Approved", "In Progress", "Completed"].includes(quote.status)) row.accepted += 1;
      if (quote.status === "Completed") row.completed += 1;
      grouped.set(service, row);
    }
  }

  const projectServices = new Map(
    data.projects.map((project) => [project.id, project.service_category]),
  );
  for (const transaction of data.transactions) {
    if (transaction.transaction_type !== "income" && transaction.transaction_type !== "refund")
      continue;
    const service =
      transaction.service_category ??
      (transaction.project_id ? projectServices.get(transaction.project_id) : undefined);
    if (!service) continue;
    const row = grouped.get(service) ?? {
      service,
      inquiries: 0,
      quotes: 0,
      accepted: 0,
      completed: 0,
      revenue: 0,
    };
    row.revenue +=
      transaction.transaction_type === "refund"
        ? -Number(transaction.amount)
        : Number(transaction.amount);
    grouped.set(service, row);
  }

  return Array.from(grouped.values()).map((row) => ({
    ...row,
    averageValue: row.completed ? Math.round(row.revenue / row.completed) : 0,
    conversion: row.inquiries ? Math.round((row.accepted / row.inquiries) * 100) : 0,
  }));
}

export function getGoalActual(goal: BusinessGoal, data: AnalyticsData): number {
  const range = {
    start: new Date(`${goal.period_start}T00:00:00`),
    end: new Date(`${goal.period_end}T23:59:59.999`),
  };

  if (goal.metric === "revenue") {
    return (
      sumTransactions(data.transactions, "income", range) -
      sumTransactions(data.transactions, "refund", range)
    );
  }
  if (goal.metric === "expenses") {
    return sumTransactions(data.transactions, "expense", range);
  }
  if (goal.metric === "inquiries") {
    return data.quotes.filter((quote) => inRange(quote.created_at, range)).length;
  }
  return data.projects.filter(
    (project) =>
      project.status === "Completed" &&
      project.completed_at !== null &&
      inRange(project.completed_at, range),
  ).length;
}

export function getProjectFinancials(data: AnalyticsData) {
  return data.projects.map((project) => {
    const projectTransactions = data.transactions.filter(
      (transaction) => transaction.project_id === project.id,
    );
    const received =
      sumTransactions(projectTransactions, "income") -
      sumTransactions(projectTransactions, "refund");
    const cost = sumTransactions(projectTransactions, "expense");
    return {
      ...project,
      received,
      cost,
      margin: received ? Math.round(((received - cost) / received) * 100) : 0,
      outstanding: Math.max(0, Number(project.contract_value) - Math.max(0, received)),
    };
  });
}

export function buildServiceCombinations(data: AnalyticsData) {
  const counts = new Map<string, number>();
  for (const quote of data.quotes) {
    const names = getServiceNames(quote.selected_services).sort();
    if (!names.length) continue;
    const key = names.join(" + ");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts, ([combo, count]) => ({ combo, count })).sort(
    (left, right) => right.count - left.count || left.combo.localeCompare(right.combo),
  );
}

export function percentageChange(current: number, previous: number): number | undefined {
  if (previous === 0) return current === 0 ? 0 : undefined;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [
    columns.map(escape).join(","),
    ...rows.map((row) => columns.map((key) => escape(row[key] ?? "")).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchBusinessAnalytics(): Promise<AnalyticsData> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const [projectsResult, transactionsResult, goalsResult, quotesResult] = await Promise.all([
    supabase.from("cms_projects").select("*").order("created_at", { ascending: false }),
    supabase
      .from("cms_financial_transactions")
      .select("*")
      .order("transaction_date", { ascending: false }),
    supabase.from("cms_business_goals").select("*").order("period_start", { ascending: false }),
    supabase.rpc("get_cms_analytics_quote_requests"),
  ]);

  const error =
    projectsResult.error ?? transactionsResult.error ?? goalsResult.error ?? quotesResult.error;
  if (error) throw new Error(error.message);

  return {
    projects: (projectsResult.data ?? []) as BusinessProject[],
    transactions: (transactionsResult.data ?? []) as FinancialTransaction[],
    goals: (goalsResult.data ?? []) as BusinessGoal[],
    quotes: (quotesResult.data ?? []) as QuoteRequest[],
  };
}

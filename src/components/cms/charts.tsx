import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatCompact, formatMoney, monthly, revenueByService } from "@/lib/demo-data";

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "var(--foreground)", fontWeight: 500 },
};
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export function IncomeExpenseChart({ height = 280 }: { height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={monthly} margin={{ left: -8, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="month" {...axis} />
        <YAxis {...axis} tickFormatter={formatCompact} />
        <Tooltip {...tip} formatter={(v: number) => formatMoney(v)} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="income" name="Income received" stroke="var(--chart-1)" strokeWidth={2} fill="url(#inc)" />
        <Area type="monotone" dataKey="expense" name="Expenditure" stroke="var(--chart-2)" strokeWidth={2} fill="transparent" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ServiceDonut({ height = 240 }: { height?: number }) {
  const total = revenueByService.reduce((a, b) => a + b.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ResponsiveContainer width="100%" height={height} className="max-w-[220px]">
        <PieChart>
          <Pie data={revenueByService} dataKey="value" nameKey="service" innerRadius="62%" outerRadius="95%" paddingAngle={2} stroke="none">
            {revenueByService.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
          </Pie>
          <Tooltip {...tip} formatter={(v: number) => formatMoney(v)} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="w-full space-y-2.5 text-sm">
        {revenueByService.map((s, i) => (
          <li key={s.service} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: COLORS[i] }} />
            <span className="flex-1 text-muted-foreground">{s.service}</span>
            <span className="tabular-nums font-medium">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConversionChart({ height = 260 }: { height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={monthly} margin={{ left: -16, right: 8, top: 8 }} barGap={2}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="month" {...axis} />
        <YAxis {...axis} />
        <Tooltip {...tip} cursor={{ fill: "var(--muted)" }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="inquiries" name="Inquiries" fill="var(--chart-4)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="proposals" name="Proposals" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="accepted" name="Accepted" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function NetLineChart({ height = 260 }: { height?: number }) {
  const data = monthly.map((m) => ({ ...m, net: m.income - m.expense }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="month" {...axis} />
        <YAxis {...axis} tickFormatter={formatCompact} />
        <Tooltip {...tip} formatter={(v: number) => formatMoney(v)} />
        <Line type="monotone" dataKey="net" name="Net result" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HBar({ data, dataKey, nameKey, money, height = 220 }: { data: object[]; dataKey: string; nameKey: string; money?: boolean; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" {...axis} tickFormatter={money ? formatCompact : undefined} />
        <YAxis type="category" dataKey={nameKey} {...axis} width={120} />
        <Tooltip {...tip} cursor={{ fill: "var(--muted)" }} formatter={(v: number) => (money ? formatMoney(v) : v)} />
        <Bar dataKey={dataKey} fill="var(--chart-1)" radius={[0, 3, 3, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

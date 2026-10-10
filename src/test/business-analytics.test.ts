import { describe, expect, it } from "vitest";

import {
  buildMonthlySeries,
  buildServiceAnalytics,
  buildServiceCombinations,
  getGoalActual,
  getPreviousPeriodRange,
  getPeriodRange,
  getProjectFinancials,
  percentageChange,
  sumTransactions,
  type AnalyticsData,
  type BusinessGoal,
} from "@/lib/business-analytics";

const sample: AnalyticsData = {
  projects: [
    {
      id: "project-1",
      project_code: "PRJ-1",
      name: "Website",
      client_name: "Client",
      service_category: "Digital Products",
      contract_value: 1000,
      status: "Completed",
      completed_at: "2026-01-20T12:00:00Z",
      created_at: "2026-01-20T12:00:00Z",
    },
  ],
  transactions: [
    {
      id: "income-1",
      transaction_ref: "TXN-1",
      transaction_type: "income",
      transaction_date: "2026-01-10",
      party: "Client",
      project_id: "project-1",
      service_category: "Digital Products",
      description: "",
      amount: 800,
      method: "Cash",
      payment_reference: null,
      receipt_number: "RCT-1",
      created_at: "2026-01-10T12:00:00Z",
    },
    {
      id: "refund-1",
      transaction_ref: "TXN-2",
      transaction_type: "refund",
      transaction_date: "2026-01-12",
      party: "Client",
      project_id: "project-1",
      service_category: "Digital Products",
      description: "",
      amount: 100,
      method: "Cash",
      payment_reference: null,
      receipt_number: null,
      created_at: "2026-01-12T12:00:00Z",
    },
    {
      id: "expense-1",
      transaction_ref: "TXN-3",
      transaction_type: "expense",
      transaction_date: "2026-01-13",
      party: "Supplier",
      project_id: "project-1",
      service_category: "Digital Products",
      description: "",
      amount: 200,
      method: "Cash",
      payment_reference: null,
      receipt_number: null,
      created_at: "2026-01-13T12:00:00Z",
    },
  ],
  goals: [],
  quotes: [
    {
      quote_id: "Q-1",
      business_name: "Client",
      selected_services: [{ id: "digital" }],
      status: "Completed",
      created_at: "2026-01-15T12:00:00Z",
    },
    {
      quote_id: "Q-2",
      business_name: "Other",
      selected_services: ["Brand Identity"],
      status: "New",
      created_at: "2026-01-16T12:00:00Z",
    },
  ],
};

describe("business analytics calculations", () => {
  it("builds monthly series from saved transactions and quote requests", () => {
    const series = buildMonthlySeries(sample, 1, new Date("2026-01-30T12:00:00"));
    expect(series).toEqual([
      { month: "Jan 26", income: 700, expense: 200, inquiries: 2, proposals: 1, accepted: 1 },
    ]);
  });

  it("groups recorded payments and quote interest by service", () => {
    const rows = buildServiceAnalytics(sample);
    expect(rows).toContainEqual(
      expect.objectContaining({
        service: "Digital Products",
        inquiries: 1,
        accepted: 1,
        completed: 1,
        revenue: 700,
        averageValue: 700,
        conversion: 100,
      }),
    );
    expect(buildServiceCombinations(sample)).toEqual([
      { combo: "Brand Identity", count: 1 },
      { combo: "Digital Products", count: 1 },
    ]);
  });

  it("calculates net project position and goal progress from saved records", () => {
    expect(getProjectFinancials(sample)[0]).toMatchObject({
      received: 700,
      cost: 200,
      margin: 71,
      outstanding: 300,
    });
    const goal: BusinessGoal = {
      id: "goal-1",
      name: "January revenue",
      metric: "revenue",
      target: 1000,
      period_start: "2026-01-01",
      period_end: "2026-01-31",
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(getGoalActual(goal, sample)).toBe(700);
  });

  it("returns an explicit zero-baseline percentage state", () => {
    expect(percentageChange(0, 0)).toBe(0);
    expect(percentageChange(5, 0)).toBeUndefined();
    expect(percentageChange(15, 10)).toBe(50);
  });

  it("uses the immediately preceding calendar month or quarter for comparisons", () => {
    const month = getPreviousPeriodRange("This month", new Date("2026-10-10T12:00:00"));
    expect(month.start.getFullYear()).toBe(2026);
    expect(month.start.getMonth()).toBe(8);
    expect(month.start.getDate()).toBe(1);
    expect(month.end.getMonth()).toBe(8);
    expect(month.end.getDate()).toBe(30);
    expect(month.end.getHours()).toBe(23);
    expect(month.end.getMinutes()).toBe(59);

    const quarter = getPreviousPeriodRange("This quarter", new Date("2026-10-10T12:00:00"));
    expect(quarter.start.getMonth()).toBe(6);
    expect(quarter.start.getDate()).toBe(1);
    expect(quarter.end.getMonth()).toBe(8);
    expect(quarter.end.getDate()).toBe(30);
    expect(quarter.end.getHours()).toBe(23);
  });

  it("sums each transaction type within an explicit date range", () => {
    const range = getPeriodRange("This month", new Date("2026-01-20T12:00:00"));
    expect(sumTransactions(sample.transactions, "income", range)).toBe(800);
    expect(sumTransactions(sample.transactions, "refund", range)).toBe(100);
  });
});

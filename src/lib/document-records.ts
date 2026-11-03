import { getSupabaseClient } from "@/lib/supabase";

export type ReceiptRecord = {
  id: string;
  receipt_number: string;
  client_name: string;
  project_id: string | null;
  paid_for: string;
  receipt_date: string;
  amount_paid: number;
  balance: number;
  payment_method: string;
  payment_reference: string | null;
  notes: string;
  digital_signature_path: string | null;
  digital_signature_user_id: string | null;
  digital_signature_name: string | null;
  created_at: string;
};

export type ReceiptProject = { id: string; name: string; client_name: string };

export type NewReceipt = Omit<ReceiptRecord, "id" | "receipt_number" | "created_at">;

export async function getReceiptRecords(): Promise<{
  receipts: ReceiptRecord[];
  projects: ReceiptProject[];
}> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const [receiptsResult, projectsResult] = await Promise.all([
    supabase.from("cms_receipts").select("*").order("created_at", { ascending: false }),
    supabase.from("cms_projects").select("id,name,client_name").order("name"),
  ]);
  if (receiptsResult.error) throw new Error(receiptsResult.error.message);
  if (projectsResult.error) throw new Error(projectsResult.error.message);
  return {
    receipts: (receiptsResult.data ?? []) as ReceiptRecord[],
    projects: (projectsResult.data ?? []) as ReceiptProject[],
  };
}

export async function createReceiptRecord(receipt: NewReceipt): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase.from("cms_receipts").insert(receipt);
  if (result.error) throw new Error(result.error.message);
}

export async function deleteReceiptRecord(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase.from("cms_receipts").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

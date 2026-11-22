import { format, formatDistanceToNowStrict } from "date-fns";
import { GST_LABELS, type GstStatus } from "@/types";

export function formatInr(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

export function formatRelative(iso: string | Date | null | undefined) {
  if (!iso) return "";
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function gstLabel(status: string) {
  return GST_LABELS[status as GstStatus] ?? status;
}

export function formatDate(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "d MMM yyyy");
}

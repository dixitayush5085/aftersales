import { dbConnect } from "@/lib/db";
import { BUILTIN_COLUMN_META, builtinSeed, mergeColumn, readColumnVisibility } from "@/lib/columns-policy";
import { ClientColumnModel } from "@/models/column";
import type { ClientColumn, Role } from "@/types";

let cache: { at: number; columns: ClientColumn[] } | null = null;
const CACHE_MS = 4_000;

export function clearColumnCache() {
  cache = null;
}

function toColumn(row: {
  key: string;
  label: string;
  kind: string;
  type: string;
  sortOrder: number;
  visible?: Partial<ClientColumn["visible"]>;
}): ClientColumn {
  return {
    key: row.key,
    label: row.label,
    kind: row.kind === "custom" ? "custom" : "builtin",
    type: row.type as ClientColumn["type"],
    sortOrder: row.sortOrder,
    visible: readColumnVisibility(row.visible as Partial<Record<string, boolean>> | undefined),
  };
}

export async function getColumnCatalog(): Promise<ClientColumn[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.columns;
  await dbConnect();

  const seed = builtinSeed();
  const existing = await ClientColumnModel.find().lean();
  const byKey = new Map(existing.map((row) => [row.key, row]));

  const missing = seed.filter((col) => !byKey.has(col.key));
  if (missing.length) {
    await ClientColumnModel.insertMany(missing);
  }

  const rows = missing.length ? await ClientColumnModel.find().lean() : existing;
  const columns = rows
    .map((row) => {
      const mapped = toColumn({
        key: row.key,
        label: row.label,
        kind: row.kind,
        type: String(row.type),
        sortOrder: row.sortOrder,
        visible: row.visible ?? undefined,
      });
      const builtin = BUILTIN_COLUMN_META[mapped.key];
      return builtin ? mergeColumn(mapped, builtin) : mapped;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  cache = { at: Date.now(), columns };
  return columns;
}

export async function columnsForRole(role: Role): Promise<ClientColumn[]> {
  const catalog = await getColumnCatalog();
  return catalog.filter((col) => col.visible[role]);
}

export async function canSeeColumn(role: Role, key: string) {
  const catalog = await getColumnCatalog();
  return Boolean(catalog.find((col) => col.key === key)?.visible[role]);
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addClientColumn,
  deleteClientColumn,
  setColumnVisibility,
} from "@/lib/actions/columns";
import { BUILTIN_COLUMN_META, isColumnLocked } from "@/lib/columns-policy";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CUSTOM_COLUMN_TYPE_LABELS,
  CUSTOM_COLUMN_TYPES,
  ROLE_LABELS,
  ROLES,
  type ClientColumn,
  type CustomColumnType,
  type Role,
} from "@/types";

const WORKING_ROLES: Role[] = ["MANAGER", "TEAM_LEAD", "TEAM_MEMBER"];

export function ColumnsMatrix({ columns }: { columns: ClientColumn[] }) {
  const [rows, setRows] = useState(columns);
  const ordered = useMemo(
    () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
    [rows],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Client columns</h2>
          <p className="text-sm text-muted-foreground">
            Choose what each role sees on Clients and Unassigned. Hidden amount fields are
            not sent to that role at all.
          </p>
        </div>
        <AddColumnDialog
          onCreated={(col) => setRows((prev) => [...prev, col])}
        />
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="h-12 px-4 text-left font-medium text-muted-foreground">Column</th>
              {ROLES.map((role) => (
                <th key={role} className="h-12 px-3 text-center font-medium text-muted-foreground">
                  {ROLE_LABELS[role]}
                </th>
              ))}
              <th className="h-12 w-12" />
            </tr>
          </thead>
          <tbody>
            {ordered.map((col) => (
              <tr key={col.key} className="border-b last:border-0">
                <td className="px-4 py-3 align-top">
                  <p className="font-medium">{col.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {col.kind === "custom"
                      ? `Custom · ${CUSTOM_COLUMN_TYPE_LABELS[col.type as CustomColumnType] ?? col.type}`
                      : BUILTIN_COLUMN_META[col.key]?.description ?? "Built-in field"}
                  </p>
                </td>
                {ROLES.map((role) => (
                  <td key={role} className="px-3 py-3 text-center">
                    <ColumnSwitch
                      columnKey={col.key}
                      label={col.label}
                      role={role}
                      enabled={col.visible[role]}
                      locked={isColumnLocked(col.key, role) || (col.kind === "custom" && role === "ADMIN")}
                      onChange={(value) =>
                        setRows((prev) =>
                          prev.map((row) =>
                            row.key === col.key
                              ? { ...row, visible: { ...row.visible, [role]: value } }
                              : row,
                          ),
                        )
                      }
                    />
                  </td>
                ))}
                <td className="px-2 py-3 text-center">
                  {col.kind === "custom" ? (
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                      aria-label={`Remove ${col.label}`}
                      onClick={() => {
                        if (!window.confirm(`Remove “${col.label}”? Values already filled stay in the database.`)) {
                          return;
                        }
                        void deleteClientColumn(col.key)
                          .then(() => {
                            setRows((prev) => prev.filter((row) => row.key !== col.key));
                            toast.success("Column removed");
                          })
                          .catch((error: unknown) => {
                            toast.error(error instanceof Error ? error.message : "Could not remove");
                          });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ColumnSwitch({
  columnKey,
  label,
  role,
  enabled,
  locked,
  onChange,
}: {
  columnKey: string;
  label: string;
  role: Role;
  enabled: boolean;
  locked: boolean;
  onChange: (value: boolean) => void;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${label} for ${ROLE_LABELS[role]}`}
      disabled={locked || pending}
      title={locked ? "Fixed for this role" : undefined}
      onClick={() => {
        const next = !enabled;
        onChange(next);
        start(async () => {
          try {
            await setColumnVisibility(columnKey, role, next);
            toast.success("Column updated");
          } catch (error) {
            onChange(enabled);
            toast.error(error instanceof Error ? error.message : "Could not update column");
          }
        });
      }}
      className={cn(
        "relative mx-auto inline-flex h-6 w-10 shrink-0 rounded-full transition-colors",
        enabled ? "bg-poster-viridian" : "bg-muted",
        (locked || pending) && "opacity-50",
        locked ? "cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all"
        style={{ left: enabled ? "1.125rem" : "0.125rem" }}
      />
    </button>
  );
}

function AddColumnDialog({ onCreated }: { onCreated: (col: ClientColumn) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomColumnType>("text");
  const [visible, setVisible] = useState<Record<Role, boolean>>({
    ADMIN: true,
    MANAGER: false,
    TEAM_LEAD: false,
    TEAM_MEMBER: false,
  });
  const [pending, start] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setLabel("");
          setType("text");
          setVisible({ ADMIN: true, MANAGER: false, TEAM_LEAD: false, TEAM_MEMBER: false });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4" />
          Add column
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add client column</DialogTitle>
          <DialogDescription>
            New fields are stored on the client. Pick who can see them. Admin always sees custom columns.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              try {
                const { key } = await addClientColumn({ label, type, visible });
                onCreated({
                  key,
                  label: label.trim(),
                  kind: "custom",
                  type,
                  sortOrder: 99,
                  visible: { ...visible, ADMIN: true },
                });
                toast.success("Column added");
                setOpen(false);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not add column");
              }
            });
          }}
        >
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Warehouse" required />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="flex flex-wrap gap-2">
              {CUSTOM_COLUMN_TYPES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setType(option)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    type === option ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
                  )}
                >
                  {CUSTOM_COLUMN_TYPE_LABELS[option]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Visible to</Label>
            <div className="space-y-2 rounded-xl border bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">Admin · always on</p>
              {WORKING_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={visible[role]}
                    onChange={(e) => setVisible((prev) => ({ ...prev, [role]: e.target.checked }))}
                  />
                  {ROLE_LABELS[role]}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={pending || label.trim().length < 2}>
            {pending ? "Adding…" : "Add column"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

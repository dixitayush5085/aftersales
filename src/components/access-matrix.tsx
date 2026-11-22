"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setRolePermission } from "@/lib/actions/access";
import { isLocked } from "@/lib/access-policy";
import { cn } from "@/lib/utils";
import {
  PERMISSION_META,
  PERMISSIONS,
  ROLE_LABELS,
  ROLES,
  type Permission,
  type PermissionSet,
  type Role,
} from "@/types";

export function AccessMatrix({ matrix }: { matrix: Record<Role, PermissionSet> }) {
  const [state, setState] = useState(matrix);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="h-12 px-4 text-left font-medium text-muted-foreground">Action</th>
            {ROLES.map((role) => (
              <th key={role} className="h-12 px-3 text-center font-medium text-muted-foreground">
                {ROLE_LABELS[role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map((permission) => (
            <tr key={permission} className="border-b last:border-0">
              <td className="px-4 py-3 align-top">
                <p className="font-medium">{PERMISSION_META[permission].label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {PERMISSION_META[permission].description}
                </p>
              </td>
              {ROLES.map((role) => (
                <td key={role} className="px-3 py-3 text-center">
                  <AccessSwitch
                    role={role}
                    permission={permission}
                    enabled={state[role][permission]}
                    locked={isLocked(role, permission)}
                    onChange={(value) =>
                      setState((prev) => ({
                        ...prev,
                        [role]: { ...prev[role], [permission]: value },
                      }))
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccessSwitch({
  role,
  permission,
  enabled,
  locked,
  onChange,
}: {
  role: Role;
  permission: Permission;
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
      aria-label={`${PERMISSION_META[permission].label} for ${ROLE_LABELS[role]}`}
      disabled={locked || pending}
      title={locked ? "Fixed for this role" : undefined}
      onClick={() => {
        const next = !enabled;
        onChange(next);
        start(async () => {
          try {
            await setRolePermission(role, permission, next);
            toast.success("Access updated");
          } catch (error) {
            onChange(enabled);
            toast.error(error instanceof Error ? error.message : "Could not update access");
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

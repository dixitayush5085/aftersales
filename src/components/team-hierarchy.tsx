"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { ChevronDown, Search, Users } from "lucide-react";
import { CopyLinkButton } from "@/components/copy-link-button";
import { PromoteButton } from "@/components/promote-button";
import { ReportsToSelect } from "@/components/reports-to-select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { countReports, type OrgChart, type StaffPerson, type TreeNode } from "@/lib/team-tree";
import { nextRole, ROLE_LABELS, type Role } from "@/types";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };
const EditCtx = createContext<{
  canLink: boolean;
  canPromote: boolean;
  superManagers: Option[];
  managers: Option[];
}>({ canLink: false, canPromote: false, superManagers: [], managers: [] });

const roleTone: Record<Role, string> = {
  ADMIN: "bg-poster-vermillion",
  SUPER_MANAGER: "bg-poster-cobalt",
  MANAGER: "bg-poster-chrome",
  TEAM_MEMBER: "bg-poster-violet",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function matchesQuery(person: StaffPerson, q: string) {
  if (!q) return true;
  const hay = `${person.name} ${person.email} ${ROLE_LABELS[person.role]}`.toLowerCase();
  return hay.includes(q);
}

function branchVisible(node: TreeNode, q: string): boolean {
  if (matchesQuery(node, q)) return true;
  return node.reports.some((child) => branchVisible(child, q));
}

export function TeamHierarchy({
  org,
  origin,
  currentUserId,
  canLink,
  canPromote,
}: {
  org: OrgChart;
  origin: string;
  currentUserId: string;
  canLink: boolean;
  canPromote: boolean;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const visible = useMemo(() => {
    if (!query) return org;
    return {
      admins: org.admins.filter((p) => matchesQuery(p, query)),
      branches: org.branches.filter((n) => branchVisible(n, query)),
      unlinkedManagers: org.unlinkedManagers.filter((n) => branchVisible(n, query)),
      unlinkedAms: org.unlinkedAms.filter((p) => matchesQuery(p, query)),
    };
  }, [org, query]);

  const empty =
    visible.admins.length +
      visible.branches.length +
      visible.unlinkedManagers.length +
      visible.unlinkedAms.length ===
    0;

  const superManagers = org.branches.map((n) => ({ id: n.id, name: n.name }));
  const managers = [
    ...org.branches.flatMap((sm) => sm.reports.map((m) => ({ id: m.id, name: m.name }))),
    ...org.unlinkedManagers.map((m) => ({ id: m.id, name: m.name })),
  ];

  return (
    <EditCtx.Provider value={{ canLink, canPromote, superManagers, managers }}>
    <div className="space-y-5">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find someone by name, email, or role"
          className="pl-9"
        />
      </div>

      {empty ? (
        <p className="rounded-2xl border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No one matches that search.
        </p>
      ) : (
        <div className="space-y-6">
          {visible.admins.length > 0 ? (
            <section className="space-y-3">
              <SectionLabel>Admin</SectionLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                {visible.admins.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    origin={origin}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {visible.branches.length > 0 ? (
            <section className="space-y-3">
              <SectionLabel>Reporting lines</SectionLabel>
              <div className="space-y-3">
                {visible.branches.map((node) => (
                  <Branch
                    key={node.id}
                    node={node}
                    origin={origin}
                    currentUserId={currentUserId}
                    query={query}
                    depth={0}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {visible.unlinkedManagers.length > 0 ? (
            <section className="space-y-3">
              <SectionLabel>
                {org.branches.length > 0 ? "Managers not linked to a Super Manager" : "Your team"}
              </SectionLabel>
              <div className="space-y-3">
                {visible.unlinkedManagers.map((node) => (
                  <Branch
                    key={node.id}
                    node={node}
                    origin={origin}
                    currentUserId={currentUserId}
                    query={query}
                    depth={0}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {visible.unlinkedAms.length > 0 ? (
            <section className="space-y-3">
              <SectionLabel>Account managers without a manager</SectionLabel>
              <div className="space-y-2">
                {visible.unlinkedAms.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    origin={origin}
                    currentUserId={currentUserId}
                    parentId={person.managerId}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
    </EditCtx.Provider>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
  );
}

function Branch({
  node,
  origin,
  currentUserId,
  query,
  depth,
}: {
  node: TreeNode;
  origin: string;
  currentUserId: string;
  query: string;
  depth: number;
}) {
  const [open, setOpen] = useState(true);
  const under = countReports(node);
  const showKids = open || Boolean(query);

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card",
        depth === 0 && "shadow-[0_1px_0_rgba(20,26,56,0.04)]",
      )}
    >
      <PersonCard
        person={node}
        origin={origin}
        currentUserId={currentUserId}
        groupName={node.groupName}
        parentId={node.parentId}
        under={under}
        expandable={node.reports.length > 0}
        open={showKids}
        onToggle={() => setOpen((v) => !v)}
      />
      {node.reports.length > 0 && showKids ? (
        <ul className="space-y-2 border-t px-3 py-3 sm:px-4">
          {node.reports.map((child) => (
            <li key={child.id} className="relative pl-4 sm:pl-5">
              <span className="absolute left-0 top-0 h-full w-px bg-border" />
              <span className="absolute left-0 top-6 h-px w-4 bg-border sm:w-5" />
              {child.role === "MANAGER" ? (
                <Branch
                  node={child}
                  origin={origin}
                  currentUserId={currentUserId}
                  query={query}
                  depth={depth + 1}
                />
              ) : (
                <PersonCard
                  person={child}
                  origin={origin}
                  currentUserId={currentUserId}
                  parentId={child.parentId}
                  compact
                />
              )}
            </li>
          ))}
        </ul>
      ) : node.reports.length === 0 && (node.role === "SUPER_MANAGER" || node.role === "MANAGER") ? (
        <p className="flex items-center gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {node.role === "SUPER_MANAGER" ? "No managers reporting yet" : "No account managers reporting yet"}
        </p>
      ) : null}
    </div>
  );
}

function PersonCard({
  person,
  origin,
  currentUserId,
  groupName,
  parentId,
  under,
  expandable,
  open,
  onToggle,
  compact,
}: {
  person: StaffPerson;
  origin: string;
  currentUserId: string;
  groupName?: string;
  parentId?: string;
  under?: number;
  expandable?: boolean;
  open?: boolean;
  onToggle?: () => void;
  compact?: boolean;
}) {
  const you = person.id === currentUserId;
  const url = person.inviteToken ? `${origin}/invite/${person.inviteToken}` : "";

  return (
    <div className={cn("flex flex-wrap items-center gap-3 p-3 sm:p-4", compact && "rounded-xl border bg-background/70 p-3")}>
      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", open ? "rotate-0" : "-rotate-90")} />
        </button>
      ) : null}
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold text-white",
          roleTone[person.role],
        )}
      >
        {initials(person.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{person.name}</p>
          {you ? (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              You
            </Badge>
          ) : null}
          <Badge variant={person.isActive ? "success" : "warning"}>
            {person.isActive ? "Active" : "Invited"}
          </Badge>
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {ROLE_LABELS[person.role]}
          {groupName ? ` · ${groupName}` : ""}
          {` · ${person.email}`}
        </p>
        {under ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {under} {under === 1 ? "person" : "people"} report here
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ReportsControl person={person} parentId={parentId} />
        <PromoteControl person={person} currentUserId={currentUserId} />
        {url ? <CopyLinkButton url={url} /> : null}
      </div>
    </div>
  );
}

function ReportsControl({ person, parentId }: { person: StaffPerson; parentId?: string }) {
  const { canLink, superManagers, managers } = useContext(EditCtx);
  if (!canLink) return null;
  if (person.role === "MANAGER") {
    return (
      <ReportsToSelect
        userId={person.id}
        value={parentId || ""}
        options={superManagers}
        placeholder="Link Super Manager"
      />
    );
  }
  if (person.role === "TEAM_MEMBER") {
    return (
      <ReportsToSelect
        userId={person.id}
        value={person.managerId || parentId || ""}
        options={managers}
        placeholder="Link Manager"
      />
    );
  }
  return null;
}

function PromoteControl({
  person,
  currentUserId,
}: {
  person: StaffPerson;
  currentUserId: string;
}) {
  const { canPromote } = useContext(EditCtx);
  if (!canPromote) return null;
  if (person.id === currentUserId) return null;
  if (!nextRole(person.role)) return null;
  return <PromoteButton userId={person.id} name={person.name} role={person.role} />;
}

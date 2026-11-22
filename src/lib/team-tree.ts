import type { Role } from "@/types";

export type StaffPerson = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  managerId: string;
  groupId: string;
  inviteToken: string;
};

export type StaffGroup = {
  id: string;
  name: string;
  smUserId: string;
};

export type TreeNode = StaffPerson & {
  reports: TreeNode[];
  groupName?: string;
  parentId?: string;
};

export type OrgChart = {
  admins: StaffPerson[];
  branches: TreeNode[];
  unlinkedManagers: TreeNode[];
  unlinkedAms: StaffPerson[];
};

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name);
}

export function buildOrg(staff: StaffPerson[], groups: StaffGroup[]): OrgChart {
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const groupsBySm = new Map<string, StaffGroup[]>();
  for (const g of groups) {
    const list = groupsBySm.get(g.smUserId) ?? [];
    list.push(g);
    groupsBySm.set(g.smUserId, list);
  }

  const admins = staff.filter((s) => s.role === "ADMIN").sort(byName);
  const sms = staff.filter((s) => s.role === "SUPER_MANAGER").sort(byName);
  const managers = staff.filter((s) => s.role === "MANAGER").sort(byName);
  const ams = staff.filter((s) => s.role === "TEAM_MEMBER").sort(byName);

  const usedManagers = new Set<string>();
  const usedAms = new Set<string>();

  function managerNode(manager: StaffPerson): TreeNode {
    const reports = ams
      .filter((a) => a.managerId === manager.id)
      .map((a) => {
        usedAms.add(a.id);
        return { ...a, reports: [], parentId: manager.id };
      });
    return {
      ...manager,
      reports,
      groupName: groupById.get(manager.groupId)?.name,
    };
  }

  const branches = sms.map((sm) => {
    const smGroupIds = new Set((groupsBySm.get(sm.id) ?? []).map((g) => g.id));
    const reports = managers
      .filter((m) => m.groupId && smGroupIds.has(m.groupId))
      .map((m) => {
        usedManagers.add(m.id);
        return { ...managerNode(m), parentId: sm.id };
      });
    return { ...sm, reports };
  });

  const unlinkedManagers = managers.filter((m) => !usedManagers.has(m.id)).map(managerNode);
  const unlinkedAms = ams.filter((a) => !usedAms.has(a.id));

  return { admins, branches, unlinkedManagers, unlinkedAms };
}

export function countReports(node: TreeNode): number {
  return node.reports.reduce((sum, child) => sum + 1 + countReports(child), 0);
}

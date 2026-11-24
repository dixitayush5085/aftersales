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

export type TreeNode = StaffPerson & {
  reports: TreeNode[];
  parentId?: string;
};

export type OrgChart = {
  admins: StaffPerson[];
  branches: TreeNode[];
  unlinkedLeads: TreeNode[];
  unlinkedMembers: StaffPerson[];
};

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name);
}

export function buildOrg(staff: StaffPerson[]): OrgChart {
  const admins = staff.filter((s) => s.role === "ADMIN").sort(byName);
  const managers = staff.filter((s) => s.role === "MANAGER").sort(byName);
  const leads = staff.filter((s) => s.role === "TEAM_LEAD").sort(byName);
  const members = staff.filter((s) => s.role === "TEAM_MEMBER").sort(byName);

  const usedLeads = new Set<string>();
  const usedMembers = new Set<string>();

  function leadNode(lead: StaffPerson): TreeNode {
    const reports = members
      .filter((member) => member.managerId === lead.id)
      .map((member) => {
        usedMembers.add(member.id);
        return { ...member, reports: [], parentId: lead.id };
      });
    return { ...lead, reports };
  }

  const branches = managers.map((manager) => {
    const reports = leads
      .filter((lead) => lead.managerId === manager.id)
      .map((lead) => {
        usedLeads.add(lead.id);
        return { ...leadNode(lead), parentId: manager.id };
      });
    return { ...manager, reports };
  });

  const unlinkedLeads = leads.filter((lead) => !usedLeads.has(lead.id)).map(leadNode);
  const unlinkedMembers = members.filter((member) => !usedMembers.has(member.id));

  return { admins, branches, unlinkedLeads, unlinkedMembers };
}

export function countReports(node: TreeNode): number {
  return node.reports.reduce((sum, child) => sum + 1 + countReports(child), 0);
}

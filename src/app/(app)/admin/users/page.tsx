import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessTeam, canInviteUsers, canPromoteUsers, canSetReportsTo } from "@/lib/rbac";
import { listGroups, listStaff } from "@/lib/actions/users";
import { InviteDialog } from "@/components/invite-dialog";
import { TeamHierarchy } from "@/components/team-hierarchy";
import { buildOrg } from "@/lib/team-tree";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) return null;
  if (!(await canAccessTeam(session.user.role))) redirect("/");

  const [staff, groups, canInvite, canPromote, canLink] = await Promise.all([
    listStaff(),
    listGroups(),
    canInviteUsers(session.user.role),
    canPromoteUsers(session.user.role),
    canSetReportsTo(session.user.role),
  ]);
  const org = buildOrg(staff, groups);
  const origin = process.env.APP_URL || process.env.AUTH_URL || "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            Super Manager → Manager → Account Manager. Copy a password link from anyone’s row.
          </p>
        </div>
        {canInvite ? <InviteDialog actorRole={session.user.role} staff={staff} /> : null}
      </div>

      <TeamHierarchy
        org={org}
        origin={origin}
        currentUserId={session.user.id}
        canLink={canLink}
        canPromote={canPromote}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessTeam, canInviteUsers, canPromoteUsers, canSetReportsTo } from "@/lib/rbac";
import { listStaff } from "@/lib/actions/users";
import { InviteDialog } from "@/components/invite-dialog";
import { TeamHierarchy } from "@/components/team-hierarchy";
import { buildOrg } from "@/lib/team-tree";
import { normalizeRole } from "@/types";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = normalizeRole(session.user.role);
  if (!(await canAccessTeam(role))) redirect("/");

  const [staff, canInvite, canPromote, canLink] = await Promise.all([
    listStaff(),
    canInviteUsers(role),
    canPromoteUsers(role),
    canSetReportsTo(role),
  ]);
  const org = buildOrg(staff);
  const origin = process.env.APP_URL || process.env.AUTH_URL || "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            Admin → Manager → Team Lead → Team Member. Copy a password link from anyone’s row.
          </p>
        </div>
        {canInvite ? <InviteDialog actorRole={role} staff={staff} /> : null}
      </div>

      <TeamHierarchy
        org={org}
        origin={origin}
        currentUserId={session.user.id}
        canLink={canLink}
        canPromote={canPromote}
        actorRole={role}
      />
    </div>
  );
}

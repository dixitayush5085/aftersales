import Link from "next/link";
import { ArrowRight, Inbox, RotateCcw, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDashboard } from "@/lib/queries/clients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TargetProgress } from "@/components/target-progress";
import { RelativeTime } from "@/components/relative-time";
import { formatInr } from "@/lib/format";
import { PLATFORM_LABELS, ROLE_LABELS } from "@/types";
import { canAssignClients, canSeeRolledBack } from "@/lib/rbac";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;
  const data = await getDashboard(session.user);
  const canInbox = await canAssignClients(session.user.role);
  const canRolled = await canSeeRolledBack(session.user.role);

  const cards: {
    href: string;
    title: string;
    value: number;
    icon: typeof Users;
    hint: string;
    tone: "cobalt" | "vermillion" | "chrome";
  }[] = [
    {
      href: "/clients",
      title: "Active clients",
      value: data.counts.active,
      icon: Users,
      hint: "In your current view",
      tone: "cobalt",
    },
    ...(canInbox
      ? [
          {
            href: "/inbox",
            title: "Unassigned",
            value: data.counts.unassigned,
            icon: Inbox,
            hint: "Waiting for a team member",
            tone: "vermillion" as const,
          },
        ]
      : []),
  ];

  if (canRolled) {
    cards.push({
      href: "/clients",
      title: "Rolled back",
      value: data.counts.rolledBack,
      icon: RotateCcw,
      hint: "Hidden from working pools",
      tone: "chrome" as const,
    });
  }

  const toneBar = {
    cobalt: "bg-poster-cobalt",
    vermillion: "bg-poster-vermillion",
    chrome: "bg-poster-chrome",
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back, {session.user.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {ROLE_LABELS[session.user.role]} dashboard
        </h1>
      </div>
      <TargetProgress
        amount={data.target.amount}
        personal={data.target.personal}
        achieved={data.target.achieved}
        monthLabel={data.target.monthLabel}
        scopeLabel={data.target.scopeLabel}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href}>
              <Card className="overflow-hidden transition-colors hover:border-primary/30">
                <div className={`h-1.5 ${toneBar[card.tone]}`} />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold tabular-nums">{card.value}</div>
                  <p className="text-xs text-muted-foreground">{card.hint}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {canInbox ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Needs assignment</CardTitle>
              <Link href="/inbox" className="flex items-center gap-1 text-xs font-medium text-primary">
                Open inbox <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.unassigned.length === 0 ? (
                <p className="text-sm text-muted-foreground">Inbox is clear.</p>
              ) : (
                data.unassigned.map((row) => (
                  <Link
                    key={row.id}
                    href={`/clients/${row.id}`}
                    className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2.5 transition-colors hover:border-primary/30"
                  >
                    <div>
                      <p className="text-sm font-medium">{row.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.mobile}
                        {row.createdAt ? (
                          <>
                            {" · "}
                            <RelativeTime iso={row.createdAt} />
                          </>
                        ) : null}
                      </p>
                    </div>
                    {row.salesAmount != null ? (
                      <p className="text-sm font-medium tabular-nums">{formatInr(row.salesAmount)}</p>
                    ) : null}
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Blocked steps</CardTitle>
            <p className="text-xs text-muted-foreground">{data.counts.openSteps} open in your view</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.blocked.length === 0 ? (
              <p className="text-sm text-muted-foreground">No blocked marketplace steps.</p>
            ) : (
              data.blocked.map((row) => (
                <Link
                  key={row.id}
                  href={`/clients/${row.clientId}`}
                  className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2.5 transition-colors hover:border-primary/30"
                >
                  <div>
                    <p className="text-sm font-medium">{row.clientTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {PLATFORM_LABELS[row.platform]} · {row.label}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className={canInbox ? "lg:col-span-2" : ""}>
          <CardHeader>
            <CardTitle className="text-base">Recent clients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clients in your view yet.</p>
            ) : (
              data.recent.map((row) => (
                <Link
                  key={row.id}
                  href={`/clients/${row.id}`}
                  className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2.5 transition-colors hover:border-primary/30"
                >
                  <div>
                    <p className="text-sm font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">{row.mobile}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <RelativeTime iso={row.createdAt} />
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

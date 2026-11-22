import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createGroup, listGroups, listStaff } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function GroupsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");
  const [groups, staff] = await Promise.all([listGroups(), listStaff()]);
  const sms = staff.filter((s) => s.role === "SUPER_MANAGER");
  const smName = new Map(staff.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
        <p className="text-sm text-muted-foreground">
          Named groups of managers under a Super Manager.
        </p>
      </div>
      <form
        className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-3"
        action={async (formData) => {
          "use server";
          await createGroup(String(formData.get("name") ?? ""), String(formData.get("smUserId") ?? ""));
        }}
      >
        <div className="space-y-1">
          <Label>Group name</Label>
          <Input name="name" required />
        </div>
        <div className="space-y-1">
          <Label>Super Manager</Label>
          <select name="smUserId" className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm" required>
            {sms.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full" disabled={sms.length === 0}>
            Create group
          </Button>
        </div>
      </form>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Super Manager</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell>{smName.get(g.smUserId) || g.smUserId}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

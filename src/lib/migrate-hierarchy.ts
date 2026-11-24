import type { Db } from "mongodb";

const FLAG_ID = "hierarchy-v2";

type MetaDoc = { _id: string; status?: string; at?: Date };

function metaCollection(db: Db) {
  return db.collection<MetaDoc>("app_meta");
}

let pending: Promise<void> | null = null;

/**
 * One-time rename of the old ladder onto Admin → Manager → Team Lead → Team Member.
 *
 * Order is load-bearing: existing `MANAGER` rows are the old middle tier and must
 * become `TEAM_LEAD` before `SUPER_MANAGER` rows become `MANAGER`. A done flag
 * stops that rename from running again. Steps are also conditional so a retry
 * after a crash does not turn the new Manager back into a Team Lead.
 *
 * Reporting: Team Leads that were linked only through a Group (`smUserId`) get
 * `managerId` set to that user. Team Members already point at their lead via
 * `managerId`, and those user ids do not change.
 */
export function ensureHierarchyMigration() {
  if (!pending) {
    pending = run().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

async function run() {
  const mongoose = (await import("mongoose")).default;
  const db = mongoose.connection.db;
  if (!db) return;

  const meta = metaCollection(db);
  const existing = await meta.findOne({ _id: FLAG_ID });
  if (existing?.status === "done") return;

  const staleBefore = new Date(Date.now() - 60_000);
  if (existing?.status === "running" && existing.at instanceof Date && existing.at < staleBefore) {
    await meta.deleteOne({ _id: FLAG_ID, status: "running" });
  } else if (existing?.status === "running") {
    const finished = await waitForDone(meta);
    if (finished) return;
  }

  try {
    await meta.insertOne({ _id: FLAG_ID, status: "running", at: new Date() });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 11000) throw error;
    const finished = await waitForDone(meta);
    if (finished) return;
    return;
  }

  try {
    await applyHierarchyMigration(db);
    await meta.updateOne({ _id: FLAG_ID }, { $set: { status: "done", at: new Date() } });
  } catch (error) {
    await meta.deleteOne({ _id: FLAG_ID, status: "running" });
    throw error;
  }
}

async function waitForDone(meta: ReturnType<typeof metaCollection>) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const current = await meta.findOne({ _id: FLAG_ID });
    if (current?.status === "done") return true;
    if (!current) return false;
  }
  return false;
}

async function pickCollection(db: Db, names: string[]) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name));
  return db.collection(names.find((name) => existing.has(name)) ?? names[0]);
}

async function applyHierarchyMigration(db: Db) {
  const users = await pickCollection(db, ["users"]);
  const access = await pickCollection(db, ["roleaccesses", "roleaccess"]);
  const columns = await pickCollection(db, ["clientcolumns"]);
  const groups = await pickCollection(db, ["groups"]);
  const meta = metaCollection(db);

  const userPhaseId = "hierarchy-v2-users";
  const userPhase = await meta.findOne({ _id: userPhaseId });
  if (userPhase?.status !== "done") {
    if (userPhase?.status === "leads-renamed") {
      await users.updateMany({ role: "SUPER_MANAGER" }, { $set: { role: "MANAGER" } });
    } else {
      const superManagers = await users.countDocuments({ role: "SUPER_MANAGER" });
      if (superManagers > 0) {
        await users.updateMany({ role: "MANAGER" }, { $set: { role: "TEAM_LEAD" } });
        await meta.updateOne(
          { _id: userPhaseId },
          { $set: { status: "leads-renamed", at: new Date() } },
          { upsert: true },
        );
        await users.updateMany({ role: "SUPER_MANAGER" }, { $set: { role: "MANAGER" } });
      } else if ((await users.countDocuments({ role: "TEAM_LEAD" })) === 0) {
        // No Super Manager rows. The stored Manager tier is the old middle role.
        await users.updateMany({ role: "MANAGER" }, { $set: { role: "TEAM_LEAD" } });
      }
    }
    await meta.updateOne(
      { _id: userPhaseId },
      { $set: { status: "done", at: new Date() } },
      { upsert: true },
    );
  }

  const smAccess = await access.findOne({ role: "SUPER_MANAGER" });
  const managerAccess = await access.findOne({ role: "MANAGER" });
  const leadAccess = await access.findOne({ role: "TEAM_LEAD" });
  if (smAccess && managerAccess && !leadAccess) {
    await access.updateOne({ _id: managerAccess._id }, { $set: { role: "TEAM_LEAD" } });
    await access.updateOne({ _id: smAccess._id }, { $set: { role: "MANAGER" } });
  } else if (smAccess && leadAccess && !managerAccess) {
    await access.updateOne({ _id: smAccess._id }, { $set: { role: "MANAGER" } });
  } else if (smAccess && !managerAccess && !leadAccess) {
    await access.updateOne({ _id: smAccess._id }, { $set: { role: "MANAGER" } });
  } else if (!smAccess && managerAccess && !leadAccess) {
    await access.updateOne({ _id: managerAccess._id }, { $set: { role: "TEAM_LEAD" } });
  }

  await columns.updateMany(
    {
      "visible.SUPER_MANAGER": { $exists: true },
      "visible.TEAM_LEAD": { $exists: false },
      "visible.MANAGER": { $exists: true },
    },
    { $rename: { "visible.MANAGER": "visible.TEAM_LEAD" } },
  );
  await columns.updateMany(
    { "visible.SUPER_MANAGER": { $exists: true } },
    { $rename: { "visible.SUPER_MANAGER": "visible.MANAGER" } },
  );

  const groupDocs = await groups.find({}).toArray();
  for (const group of groupDocs) {
    if (!group.smUserId) continue;
    await users.updateMany(
      {
        role: "TEAM_LEAD",
        groupId: group._id,
        $or: [{ managerId: null }, { managerId: { $exists: false } }],
      },
      { $set: { managerId: group.smUserId } },
    );
  }
}

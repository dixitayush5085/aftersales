import crypto from "crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Group } from "../src/models/group";
import { User } from "../src/models/user";
import type { Role } from "../src/types";

const uri = process.env.MONGODB_URI ?? "";
if (!uri) {
  throw new Error("MONGODB_URI is required");
}

const password = process.env.ADMIN_PASSWORD || "change-me";

async function upsertPerson(input: {
  name: string;
  email: string;
  role: Role;
  managerId?: mongoose.Types.ObjectId | null;
  groupId?: mongoose.Types.ObjectId | null;
  passwordHash: string;
}) {
  const email = input.email.toLowerCase();
  const token = crypto.randomBytes(24).toString("base64url");
  const existing = await User.findOne({ email });
  if (existing) {
    existing.name = input.name;
    existing.role = input.role;
    existing.isActive = true;
    existing.passwordHash = input.passwordHash;
    existing.managerId = input.managerId ?? null;
    existing.groupId = input.groupId ?? null;
    if (!existing.inviteToken) existing.inviteToken = token;
    await existing.save();
    return existing;
  }
  return User.create({
    name: input.name,
    email,
    role: input.role,
    isActive: true,
    passwordHash: input.passwordHash,
    managerId: input.managerId ?? null,
    groupId: input.groupId ?? null,
    inviteToken: token,
  });
}

async function upsertGroup(name: string, smUserId: mongoose.Types.ObjectId) {
  const existing = await Group.findOne({ smUserId, name });
  if (existing) return existing;
  return Group.create({ name, smUserId });
}

async function main() {
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || "aftersales" });
  const passwordHash = await bcrypt.hash(password, 10);

  const northSm = await upsertPerson({
    name: "Kavya — North Super Manager",
    email: "north.sm@ziloty.demo",
    role: "SUPER_MANAGER",
    passwordHash,
  });
  const northGroup = await upsertGroup("North", northSm._id);

  const northManager = await upsertPerson({
    name: "Rohan — North Manager",
    email: "north.manager@ziloty.demo",
    role: "MANAGER",
    groupId: northGroup._id,
    passwordHash,
  });

  await upsertPerson({
    name: "Neha — AM under Rohan",
    email: "north.am1@ziloty.demo",
    role: "TEAM_MEMBER",
    managerId: northManager._id,
    groupId: northGroup._id,
    passwordHash,
  });
  await upsertPerson({
    name: "Arjun — AM under Rohan",
    email: "north.am2@ziloty.demo",
    role: "TEAM_MEMBER",
    managerId: northManager._id,
    groupId: northGroup._id,
    passwordHash,
  });

  const southSm = await upsertPerson({
    name: "Meera — South Super Manager",
    email: "south.sm@ziloty.demo",
    role: "SUPER_MANAGER",
    passwordHash,
  });
  const southGroup = await upsertGroup("South", southSm._id);

  const southManager = await upsertPerson({
    name: "Vikram — South Manager",
    email: "south.manager@ziloty.demo",
    role: "MANAGER",
    groupId: southGroup._id,
    passwordHash,
  });

  await upsertPerson({
    name: "Isha — AM under Vikram",
    email: "south.am@ziloty.demo",
    role: "TEAM_MEMBER",
    managerId: southManager._id,
    groupId: southGroup._id,
    passwordHash,
  });

  console.log("Seeded demo org. Password for all demo users:", password);
  console.log(`
North group (Kavya)
  └─ Rohan (Manager)
       ├─ Neha (Account Manager)
       └─ Arjun (Account Manager)

South group (Meera)
  └─ Vikram (Manager)
       └─ Isha (Account Manager)

Login as admin to see both on Team and Groups.
Login as north.sm@ziloty.demo to see only North.
`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

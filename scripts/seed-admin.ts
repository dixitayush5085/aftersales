import crypto from "crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../src/models/user";
import { MilestoneTemplate } from "../src/models/platform";
import { PLATFORMS } from "../src/types";

const uri = process.env.MONGODB_URI ?? "";
if (!uri) {
  throw new Error("MONGODB_URI is required");
}

const email = (process.env.ADMIN_EMAIL || "admin@ziloty.in").toLowerCase();
const password = process.env.ADMIN_PASSWORD || "change-me";

async function main() {
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || "aftersales" });

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await User.findOne({ email });
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.isActive = true;
    existing.role = "ADMIN";
    if (!existing.inviteToken) {
      existing.inviteToken = crypto.randomBytes(24).toString("base64url");
    }
    await existing.save();
    console.log(`Updated admin ${email}`);
  } else {
    await User.create({
      name: "Admin",
      email,
      passwordHash,
      role: "ADMIN",
      isActive: true,
      inviteToken: crypto.randomBytes(24).toString("base64url"),
    });
    console.log(`Created admin ${email}`);
  }

  const defaults = [
    { key: "account", label: "Account creation", sortOrder: 0 },
    { key: "listing", label: "Marketplace listing", sortOrder: 1 },
    { key: "catalog", label: "Catalog / SEO", sortOrder: 2 },
    { key: "notes", label: "Notes / blockers", sortOrder: 3 },
  ];
  for (const platform of PLATFORMS) {
    for (const row of defaults) {
      await MilestoneTemplate.updateOne(
        { platform, key: row.key },
        { $set: { ...row, platform } },
        { upsert: true },
      );
    }
  }
  console.log("Seeded milestone templates");
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

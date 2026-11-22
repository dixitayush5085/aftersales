/**
 * One-off copy of already-converted LMS leads into After Sales Unassigned.
 * Uses the same snapshot shape as the convert webhook. Does not share LMS
 * collections at runtime. Safe to re-run: existing clients are updated in place.
 *
 * Usage:
 *   npm run import:lms
 *   npm run import:lms -- --limit=20
 */
import mongoose from "mongoose";
import { dbConnect } from "../src/lib/db";
import { upsertConvertedClient } from "../src/lib/ingest";

type LmsLead = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  mobile?: string;
  email?: string;
  state?: string;
  city?: string;
  address?: string;
  pincode?: string;
  gstStatus?: string;
  salesAmount?: number | null;
  conversionDate?: Date;
  createdBy?: mongoose.Types.ObjectId;
  influencerId?: mongoose.Types.ObjectId;
  sourceCode?: string;
};

type LmsSale = {
  _id: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  saleAmount?: number;
  saleDate?: Date;
  gstStatus?: string;
};

const uri = process.env.MONGODB_URI ?? "";
if (!uri) {
  throw new Error("MONGODB_URI is required");
}

const lmsDbName = process.env.LMS_MONGODB_DB || "lead-management";
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.slice("--limit=".length)) : 0;

async function main() {
  await dbConnect();
  const lms = await mongoose.createConnection(uri, { dbName: lmsDbName }).asPromise();
  const db = lms.db;
  if (!db) {
    throw new Error(`Could not open LMS database "${lmsDbName}"`);
  }

  const collections = await db.listCollections().toArray();
  const names = new Set(collections.map((c) => c.name));
  if (!names.has("leads")) {
    throw new Error(
      `No "leads" collection in "${lmsDbName}". Found: ${[...names].join(", ") || "(empty)"}`,
    );
  }

  const query = db.collection<LmsLead>("leads").find({ converted: true }).sort({ conversionDate: -1 });
  if (limit > 0) query.limit(limit);
  const leads = await query.toArray();

  if (!leads.length) {
    console.log(`No converted leads in ${lmsDbName}.leads`);
    await lms.close();
    return;
  }

  console.log(`Found ${leads.length} converted lead(s) in ${lmsDbName}. Importing into After Sales…`);

  const leadIds = leads.map((lead) => lead._id);
  const sales = names.has("sales")
    ? await db
        .collection<LmsSale>("sales")
        .find({ leadId: { $in: leadIds } })
        .toArray()
    : [];
  const saleByLead = new Map(sales.map((sale) => [String(sale.leadId), sale]));

  let imported = 0;
  let failed = 0;
  for (const lead of leads) {
    const leadId = String(lead._id);
    const sale = saleByLead.get(leadId);
    try {
      await upsertConvertedClient({
        event: "client.converted",
        lmsLeadId: leadId,
        lmsSaleId: sale ? String(sale._id) : null,
        name: lead.name,
        mobile: lead.mobile,
        email: lead.email,
        state: lead.state,
        city: lead.city,
        address: lead.address,
        pincode: lead.pincode,
        gstStatus: lead.gstStatus ?? sale?.gstStatus,
        saleAmount: Number(sale?.saleAmount ?? lead.salesAmount ?? 0) || 0,
        saleDate: (lead.conversionDate ?? sale?.saleDate)?.toISOString(),
        salesExecutiveId: lead.createdBy ? String(lead.createdBy) : "",
        influencerId: lead.influencerId ? String(lead.influencerId) : "",
        sourceCode: lead.sourceCode,
      });
      imported += 1;
      if (imported % 25 === 0) {
        console.log(`Imported ${imported}/${leads.length}`);
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed ${leadId} (${lead.mobile ?? "no mobile"}): ${message}`);
    }
  }

  await lms.close();
  await mongoose.disconnect();
  console.log(
    `Done. ${imported} converted lead(s) in After Sales Unassigned, ${failed} failed, ${leads.length} read from LMS.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

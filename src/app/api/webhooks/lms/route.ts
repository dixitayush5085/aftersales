import { ingestLmsEvent, verifyLmsSignature, type LmsWebhookPayload } from "@/lib/ingest";

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-aftersales-signature");
  if (!verifyLmsSignature(raw, signature)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: LmsWebhookPayload;
  try {
    payload = JSON.parse(raw) as LmsWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.event || !payload.lmsLeadId) {
    return Response.json({ error: "Missing event or lmsLeadId" }, { status: 400 });
  }

  try {
    const result = await ingestLmsEvent(payload);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingest failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

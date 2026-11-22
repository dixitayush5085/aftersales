import { notFound } from "next/navigation";
import { getPublicProgress } from "@/lib/queries/clients";
import { PublicTracking } from "@/components/public-tracking";

export default async function PublicTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPublicProgress(token);
  if (!data) notFound();
  return <PublicTracking data={data} />;
}

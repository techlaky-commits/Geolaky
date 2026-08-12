import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { MapClientWrapper } from "@/components/MapClientWrapper";

export default async function MapPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) notFound();

  return <MapClientWrapper initialProjectId={searchParams.projectId} />;
}

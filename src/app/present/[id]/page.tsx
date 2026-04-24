import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PresentationView } from "@/components/analysis/presentation-view";

export default async function PresentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const analysis = await db.analysis.findFirst({
    where: { id, userId: user.id },
    include: { variants: { orderBy: { matchScore: "desc" } } },
  });
  if (!analysis || analysis.status !== "COMPLETED") notFound();

  await db.usageEvent.create({
    data: { userId: user.id, kind: "PRESENTATION_OPENED", metadata: { analysisId: id } },
  });

  return <PresentationView analysis={analysis} />;
}

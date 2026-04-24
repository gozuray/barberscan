import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Play } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AnalysisResults } from "@/components/analysis/analysis-results";
import { Button } from "@/components/ui/button";

export default async function AnalysisPage({
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

  if (!analysis) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        {analysis.status === "COMPLETED" && (
          <Button asChild variant="gold">
            <Link href={`/present/${analysis.id}`} target="_blank">
              <Play className="h-4 w-4" /> Present to client
            </Link>
          </Button>
        )}
      </div>
      <AnalysisResults initialAnalysis={analysis} />
    </div>
  );
}

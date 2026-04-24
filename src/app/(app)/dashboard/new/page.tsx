import { NewAnalysisForm } from "@/components/analysis/new-analysis-form";
import { requireUser } from "@/lib/auth/session";
import { getQuotaStatus } from "@/lib/auth/quota";
import { Badge } from "@/components/ui/badge";
import { DEV_NO_AUTH, USE_CUSTOM_PROMPT } from "@/lib/dev-mode";

export default async function NewAnalysisPage() {
  const user = await requireUser();
  const quota = await getQuotaStatus(user);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Badge variant="outline" className="uppercase tracking-[0.18em]">New analysis</Badge>
        <h1 className="mt-3 font-display text-3xl font-semibold md:text-4xl">
          Upload your client's photo
        </h1>
        <p className="mt-2 text-muted-foreground">
          {USE_CUSTOM_PROMPT
            ? "Test mode: we'll send exactly one prompt from src/lib/ai/custom-prompt.ts to the AI and show the result."
            : "A clear, front-facing photo works best. We'll generate 8 hairstyle previews in about a minute."}
        </p>
      </div>
      <NewAnalysisForm
        quota={quota}
        allowPasteUrl={DEV_NO_AUTH}
        customPromptMode={USE_CUSTOM_PROMPT}
      />
    </div>
  );
}

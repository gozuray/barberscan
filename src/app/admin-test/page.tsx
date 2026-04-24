import Link from "next/link";
import { AdminTestForm } from "./admin-test-form";

export const metadata = {
  title: "Admin Test · BarberScan",
};

export default function AdminTestPage() {
  return (
    <main className="min-h-screen bg-brand-cream px-4 py-8 text-brand-ink md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Local admin test
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold md:text-5xl">
              Probar prompt con IA
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
              Sube una foto, elige OpenAI o NanoBananaPRO, envía el prompt directamente a la API y mira el resultado aquí.
              No usa usuarios, Docker, Postgres, clientes ni UploadThing.
            </p>
          </div>
          <Link href="/" className="text-sm font-medium underline underline-offset-4">
            Volver al inicio
          </Link>
        </div>

        <AdminTestForm />
      </div>
    </main>
  );
}

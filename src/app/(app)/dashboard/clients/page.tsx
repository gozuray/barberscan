import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Users } from "lucide-react";

export default async function ClientsPage() {
  const user = await requireUser();
  const clients = await db.client.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { analyses: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="uppercase tracking-[0.18em]">Clients</Badge>
        <h1 className="mt-3 font-display text-3xl font-semibold">Your client book</h1>
      </div>
      {clients.length === 0 ? (
        <div className="card-surface flex flex-col items-center gap-4 p-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-beige">
            <Users className="h-6 w-6 text-brand-ink" />
          </div>
          <h3 className="font-display text-xl">No clients yet</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Clients are created automatically when you save an analysis with a name. You can also add them manually.
          </p>
        </div>
      ) : (
        <div className="card-surface divide-y divide-border">
          {clients.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-5">
              <div>
                <div className="font-medium">{c.name ?? "Unnamed client"}</div>
                <div className="text-xs text-muted-foreground">
                  {c._count.analyses} analyses · added {formatDate(c.createdAt)}
                </div>
              </div>
              {c.phone && <div className="text-sm text-muted-foreground">{c.phone}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

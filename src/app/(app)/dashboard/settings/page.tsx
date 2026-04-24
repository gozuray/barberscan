import { requireUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Badge variant="outline" className="uppercase tracking-[0.18em]">Settings</Badge>
        <h1 className="mt-3 font-display text-3xl font-semibold">Account</h1>
      </div>
      <div className="card-surface space-y-4 p-6 text-sm">
        <Row label="Name" value={user.name ?? "—"} />
        <Row label="Email" value={user.email} />
        <Row label="Role" value={user.role} />
      </div>
      <p className="text-sm text-muted-foreground">
        Manage your profile details directly from the avatar menu in the top right (powered by Clerk).
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-3 last:border-none last:pb-0">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

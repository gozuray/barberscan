import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Sparkles,
  Users,
  CreditCard,
  Settings,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getQuotaStatus } from "@/lib/auth/quota";
import { Progress } from "@/components/ui/progress";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/new", label: "New Analysis", icon: Sparkles },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const quota = await getQuotaStatus(user);
  const pct = Number.isFinite(quota.limit)
    ? Math.min(100, Math.round((quota.used / Math.max(1, quota.limit)) * 100))
    : 0;

  return (
    <div className="flex min-h-screen bg-brand-cream">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-white/60 backdrop-blur md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border/60 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-ink text-brand-cream">
            <span className="font-display text-sm">B</span>
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">BarberScan</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="m-4 rounded-xl border border-border bg-white p-4">
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
            <span>{quota.tier} plan</span>
            <span>
              {quota.used}
              {Number.isFinite(quota.limit) ? ` / ${quota.limit}` : " / ∞"}
            </span>
          </div>
          <Progress value={pct} className="mt-2" />
          <Link
            href="/dashboard/billing"
            className="mt-3 inline-block text-xs font-medium text-brand-ink hover:underline"
          >
            Manage plan →
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border/60 bg-white/70 px-6 backdrop-blur">
          <div className="text-sm text-muted-foreground">
            Welcome back, <span className="font-medium text-foreground">{user.name ?? user.email}</span>
          </div>
          <UserButton afterSignOutUrl="/" />
        </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}

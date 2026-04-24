import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-cream text-brand-ink">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-brand-cream/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-ink text-brand-cream">
              <span className="font-display text-sm">B</span>
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">BarberScan</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <Link href="/#how" className="hover:text-foreground">How it works</Link>
            <Link href="/#features" className="hover:text-foreground">Features</Link>
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            <SignedOut>
              <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
                Sign in
              </Link>
              <Button asChild size="sm" variant="gold">
                <Link href="/sign-up">Start free trial</Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <Button asChild size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            </SignedIn>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-border/60 bg-brand-cream/50">
        <div className="container flex flex-col items-start justify-between gap-6 py-10 md:flex-row md:items-center">
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} BarberScan. Built for barbers.
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/pricing">Pricing</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

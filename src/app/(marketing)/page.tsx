import Link from "next/link";
import { ArrowRight, Sparkles, Scissors, Timer, Users, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-brand-beige/50 blur-3xl" />
        </div>
        <div className="container flex flex-col items-center gap-8 py-20 text-center md:py-28">
          <Badge variant="gold" className="uppercase tracking-[0.18em]">
            <Sparkles className="h-3 w-3" /> AI for modern barbers
          </Badge>
          <h1 className="max-w-4xl font-display text-4xl font-semibold tracking-tight md:text-6xl">
            Show your clients their next haircut{" "}
            <span className="italic text-brand-gold">before</span> you pick up the scissors.
          </h1>
          <p className="max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
            BarberScan analyzes a single photo and generates realistic previews across 8 premium hairstyles
            in seconds. Upsell with confidence, reduce regret, and elevate every chair experience.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild size="xl" variant="gold">
              <Link href="/sign-up">
                Start free trial <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">7-day free trial · No credit card required</p>
        </div>
      </section>

      {/* Value props */}
      <section id="features" className="container grid gap-6 pb-20 md:grid-cols-3">
        {[
          {
            icon: Timer,
            title: "Under 30 seconds per client",
            body: "One photo. Eight looks. Side-by-side. Your chair stays productive.",
          },
          {
            icon: Scissors,
            title: "Tailored to face + hair",
            body: "Our engine reads face shape, hair type and density to rank the most flattering cuts.",
          },
          {
            icon: Users,
            title: "Built for teams",
            body: "Add stylists, share analyses, and maintain your client book in one place.",
          },
        ].map((f) => (
          <div key={f.title} className="card-surface p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand-beige">
              <f.icon className="h-5 w-5 text-brand-ink" />
            </div>
            <h3 className="font-display text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section id="how" className="bg-white py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="mb-4 uppercase tracking-[0.18em]">How it works</Badge>
            <h2 className="font-display text-3xl font-semibold md:text-4xl">
              Three steps to a confident client
            </h2>
          </div>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { n: "01", t: "Upload a photo", d: "Snap or import a clear front-facing photo of your client." },
              { n: "02", t: "AI analyzes face & hair", d: "Face shape, hair type and density detected automatically." },
              { n: "03", t: "Present in fullscreen", d: "Walk your client through the best styles with one tap." },
            ].map((s) => (
              <li key={s.n} className="card-surface p-8">
                <div className="font-display text-3xl text-brand-gold">{s.n}</div>
                <h3 className="mt-2 font-display text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Social proof */}
      <section className="container py-20">
        <div className="card-surface flex flex-col items-center gap-6 bg-brand-ink p-10 text-center text-brand-cream md:p-16">
          <BadgeCheck className="h-8 w-8 text-brand-gold" />
          <h2 className="max-w-3xl font-display text-3xl md:text-4xl">
            "My clients book premium styles they'd never tried before. This is a no-brainer."
          </h2>
          <p className="text-sm uppercase tracking-[0.18em] text-brand-gold-soft">
            Diego V. · Owner, Atelier Barbers
          </p>
          <Button asChild size="lg" variant="gold">
            <Link href="/sign-up">Start your 7-day trial</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

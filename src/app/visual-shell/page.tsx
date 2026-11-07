import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  ArrowLeftRight,
  Package,
  ChefHat,
  ShoppingCart,
  Scale,
  ChartNoAxesColumn,
  CalendarDays,
  Settings,
  Search,
  Users,
  Wallet,
  Pencil,
  Plus,
} from "lucide-react";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { ForceDark } from "@/components/dashboard/force-dark";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { RecipePromo } from "@/components/dashboard/recipe-promo";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { EmptyState } from "@/components/ui";

/** Dev-only chrome preview for visual QA (empty states only — no invented money). */
export default function VisualShellPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const nav = [
    { label: "Dashboard", icon: LayoutDashboard, active: true },
    { label: "Tranzacții", icon: ArrowLeftRight },
    { label: "Produse", icon: Package },
    { label: "Rețete", icon: ChefHat },
    { label: "Liste de cumpărături", icon: ShoppingCart },
    { label: "Comparare prețuri", icon: Scale },
    { label: "Statistici", icon: ChartNoAxesColumn },
    { label: "Plan de mese", icon: CalendarDays },
    { label: "Setări", icon: Settings },
  ] as const;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15.5rem_1fr]">
      <ForceDark />
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 bg-sidebar p-3 text-sidebar-fg md:flex lg:p-4">
        <div className="flex items-center gap-2.5 px-2 pt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon.svg" alt="" width={36} height={36} className="rounded-[12px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold tracking-tight">Bugetify</p>
            <p className="truncate text-[11px] text-sidebar-muted">Plan. Cumpără. Economisește.</p>
          </div>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-0.5">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <span
                key={item.label}
                className={
                  "active" in item && item.active
                    ? "brand-gradient flex min-h-11 items-center gap-3 rounded-full px-3.5 text-sm font-medium text-brand-fg shadow-[0_10px_28px_-14px_#7c5cff]"
                    : "flex min-h-11 items-center gap-3 rounded-full px-3.5 text-sm font-medium text-sidebar-muted"
                }
              >
                <Icon size={18} aria-hidden />
                {item.label}
              </span>
            );
          })}
        </nav>
        <ThemeToggle variant="pill" />
      </aside>

      <div className="min-w-0 bg-bg">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/90 px-4 py-3 backdrop-blur md:px-7">
          <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3">
            <div className="relative hidden min-w-0 flex-1 md:block">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <div className="flex h-11 items-center rounded-full border border-border bg-surface pl-10 pr-4 text-sm text-muted">
                Caută produse, rețete sau magazine...
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="relative inline-flex size-10 items-center justify-center rounded-full border border-border bg-surface text-muted">
                <Bell size={17} aria-hidden />
                <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-danger" />
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-2.5">
                <span className="inline-flex size-8 items-center justify-center rounded-full brand-gradient text-xs font-semibold text-brand-fg">
                  I
                </span>
                <span className="text-sm font-medium">Ionut</span>
                <ChevronDown size={14} className="text-muted" aria-hidden />
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 md:px-8 md:pt-6">
          <section className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)] lg:items-center">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-[2.25rem]">Salut, Ionut!</h1>
              <p className="mt-2 text-sm text-muted sm:text-[15px]">Hai să vedem cum stăm cu bugetul în această lună.</p>
            </div>
            <div className="relative min-h-[12rem] overflow-hidden rounded-[22px] shadow-[var(--shadow-card)] lg:min-h-[13.5rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/dashboard-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <p className="font-script absolute inset-x-0 bottom-0 p-5 text-[1.85rem] leading-tight text-white sm:p-6 sm:text-[2.1rem]">
                Mănâncă bine, trăiește echilibrat!
              </p>
            </div>
          </section>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              tone="blue"
              icon={<Wallet size={18} aria-hidden />}
              label="Buget lunar"
              value="—"
              hint="Limita perioadei curente"
              action={<span className="inline-flex size-8 items-center justify-center rounded-full text-muted"><Pencil size={14} aria-hidden /></span>}
            />
            <SummaryCard
              tone="green"
              icon={<Wallet size={18} aria-hidden />}
              label="Cheltuit până acum"
              value="—"
              hint="Cheltuit până acum"
              trailing={<ProgressRing value={0} max={1} label="0%" tone="ok" />}
            />
            <SummaryCard tone="purple" icon={<Wallet size={18} aria-hidden />} label="Rămas" value="—" />
            <SummaryCard
              tone="orange"
              icon={<Users size={18} aria-hidden />}
              label="Persoane în buget"
              value={
                <span className="flex items-center gap-2">
                  <span className="inline-flex size-9 items-center justify-center rounded-full brand-gradient text-[11px] font-semibold text-brand-fg">I</span>
                  <span className="inline-flex size-9 items-center justify-center rounded-full border border-dashed border-border text-muted"><Plus size={16} aria-hidden /></span>
                </span>
              }
            />
          </div>

          <div className="mb-5 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
            <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
              <h2 className="mb-4 text-sm font-semibold">Evoluția cheltuielilor</h2>
              <div className="relative flex h-40 items-end gap-1.5">
                <div className="pointer-events-none absolute inset-x-0 top-[28%] border-t border-dashed border-fg/40" />
                {[22, 48, 70, 36, 58, 42, 80, 28, 62, 34, 52, 66].map((h, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-t-md opacity-70"
                    style={{ height: `${h}%`, background: "linear-gradient(#a78bfa,#6366f1)" }}
                  />
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-muted">
                Structural preview — live dashboard bars come from real daily expenses
              </p>
            </section>
            <CategoryDonut
              title="După categorie"
              detailsLabel="Vezi detalii"
              emptyTitle="Nicio cheltuială în perioada asta."
              slices={[]}
              centerLabel="Total cheltuit"
              totalLabel="—"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
              <h2 className="mb-3 text-sm font-semibold">Ultimele cumpărături</h2>
              <EmptyState compact title="Nicio tranzacție încă" />
            </section>
            <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
              <h2 className="mb-3 text-sm font-semibold">Produse populare</h2>
              <EmptyState compact title="Niciun produs frecvent încă." />
            </section>
            <RecipePromo
              title="Rețetă recomandată"
              body="Adaugă o rețetă ca să apară o recomandare aici."
              cta="Explorează rețete"
              recipe={null}
            />
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            Dev preview only · <Link href="/login" className="text-brand-strong hover:underline">Login</Link>
          </p>
        </main>
      </div>
    </div>
  );
}

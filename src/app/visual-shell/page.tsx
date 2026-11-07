import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ChartNoAxesColumn,
  ChevronDown,
  LayoutDashboard,
  ArrowLeftRight,
  Package,
  ChefHat,
  ShoppingBasket,
  ShoppingCart,
  Scale,
  Settings,
  Search,
  Target,
  Wallet,
} from "lucide-react";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { ForceDark } from "@/components/dashboard/force-dark";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { QuickLists } from "@/components/dashboard/quick-lists";
import { RecentPurchases } from "@/components/dashboard/recent-purchases";
import { RecipePromo } from "@/components/dashboard/recipe-promo";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { buildEvolutionSeries } from "@/lib/dashboard-charts";
import { BudgetEvolutionChart } from "@/components/dashboard/budget-evolution-chart";

/** Dev-only dense chrome preview (skeleton density, no invented money). */
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
    { label: "Setări", icon: Settings },
  ] as const;

  const emptySeries = {
    "7d": buildEvolutionSeries({ today: "2026-11-07", range: "7d", expenses: [], budgetLimit: null }),
    "30d": buildEvolutionSeries({ today: "2026-11-07", range: "30d", expenses: [], budgetLimit: null }),
    "3m": buildEvolutionSeries({ today: "2026-11-07", range: "3m", expenses: [], budgetLimit: null }),
    "12m": buildEvolutionSeries({ today: "2026-11-07", range: "12m", expenses: [], budgetLimit: null }),
  };

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
          <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Salut, Ionut!</h1>
              <p className="mt-1 max-w-xl text-sm text-muted">Hai să vedem cum stăm cu bugetul în această lună.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-medium">
                <CalendarDays size={16} className="text-muted" aria-hidden />
                <span>Noiembrie 2026</span>
                <ChevronDown size={14} className="text-muted" aria-hidden />
              </div>
            </div>
          </header>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard tone="green" icon={<Wallet size={18} aria-hidden />} label="Disponibil" value="—" hint="Sold inițial + venituri − cheltuieli − economii" />
            <SummaryCard tone="blue" icon={<ShoppingBasket size={18} aria-hidden />} label="Cheltuieli lunare" value="—" />
            <SummaryCard tone="purple" icon={<Target size={18} aria-hidden />} label="Alocație zilnică" value="—" hint="Mâine: —" />
            <SummaryCard
              tone="orange"
              icon={<Target size={18} aria-hidden />}
              label="Rămâne de cheltuit"
              value="—"
              hint="Setează o limită lunară ca să vezi ritmul zilnic."
              trailing={<ProgressRing value={0} max={1} label="—" tone="orange" />}
            />
          </div>

          <div className="mb-5 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <BudgetEvolutionChart seriesByRange={emptySeries} currency="RON" />
            <CategoryDonut
              title="Categorie cheltuieli"
              detailsLabel="Vezi detalii"
              emptyTitle="Nicio cheltuială în perioada asta."
              slices={[]}
              centerLabel="Total cheltuit"
              totalLabel="—"
              insight="Adaugă cheltuieli ca să vezi insight-uri pe categorii."
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <RecentPurchases
              title="Ultimele cumpărături"
              viewAll="Vezi toate"
              emptyTitle="Nicio tranzacție încă"
              emptyBody="Adaugă o cheltuială sau un venit ca să începi."
              transactions={[]}
              categories={[]}
              currency="RON"
              locale="ro"
              t={(k) => String(k)}
              today="2026-11-07"
            />
            <QuickLists
              title="Liste rapide"
              viewAll="Vezi toate"
              emptyTitle="Nicio listă activă."
              addLabel="Adaugă pe listă"
              lists={[]}
              canAdd
            />
            <RecipePromo
              title="Rețete inteligente pentru bugetul tău!"
              body="Descoperă rețete gustoase cu produsele pe care le cumperi deja."
              cta="Explorează rețete"
              recipe={null}
            />
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            Dev preview · dense empty chrome · <Link href="/login" className="text-brand-strong hover:underline">Login</Link>
          </p>
        </main>
      </div>
    </div>
  );
}

import type { Metadata, Viewport } from "next";
import { Caveat, Geist_Mono, Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/provider";
import { getTranslator } from "@/lib/i18n/server";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { ThemeProvider } from "@/components/theme-provider";
import { parseThemePreference, themeHtmlClass, THEME_COOKIE } from "@/lib/theme";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700", "800"],
});
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin", "latin-ext"],
  weight: ["600"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return {
    title: { default: t("app.name"), template: `%s · ${t("app.name")}` },
    description: t("app.tagline"),
    applicationName: t("app.name"),
    appleWebApp: {
      capable: true,
      title: t("app.name"),
      statusBarStyle: "default",
    },
    formatDetection: { telephone: false },
    icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5fb" },
    { media: "(prefers-color-scheme: dark)", color: "#090b12" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale, messages } = await getTranslator();
  const themePreference = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);
  const themeClass = themeHtmlClass(themePreference);

  return (
    <html
      lang={locale}
      className={[
        inter.variable,
        caveat.variable,
        geistMono.variable,
        "h-full antialiased",
        themeClass,
      ]
        .filter(Boolean)
        .join(" ")}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans">
        <ThemeProvider>
          <I18nProvider locale={locale} messages={messages}>
            {children}
          </I18nProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

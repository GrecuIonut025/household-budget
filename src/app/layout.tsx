import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/provider";
import { getTranslator } from "@/lib/i18n/server";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { ThemeProvider, THEME_BOOT_SCRIPT } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
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
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d10" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale, messages } = await getTranslator();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Native blocking boot script (not next/script): React 19 warns when a
          <script> is rendered via a client component / next/script on the client,
          and those tags never re-execute. SSR into <head> still prevents FOUC.
        */}
        <script
          id="hb-theme-boot"
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
      </head>
      <body className="min-h-full">
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

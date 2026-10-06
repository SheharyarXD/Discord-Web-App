import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE, getMessages } from "@/i18n";
import { I18nProvider } from "@/i18n/client";
import "./globals.css";

const messages = getMessages(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: { default: messages.app.name, template: `%s · ${messages.app.name}` },
  description: messages.app.tagline,
  robots: { index: false, follow: false }, // private application
};

export const viewport: Viewport = { themeColor: "#0b0d12", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE}>
      <body className="min-h-dvh">
        <I18nProvider locale={DEFAULT_LOCALE}>{children}</I18nProvider>
      </body>
    </html>
  );
}

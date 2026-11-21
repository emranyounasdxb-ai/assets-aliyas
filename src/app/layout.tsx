import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import "./brand.css";
export const metadata: Metadata = {
  title: {
    default: "Aliyas Real Estate · Property management",
    template: "%s · Aliyas Real Estate",
  },
  description: "Your properties, tenants and rental accounts in one workspace.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={GeistSans.variable}>{children}</body>
    </html>
  );
}

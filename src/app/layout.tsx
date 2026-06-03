import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayMatch - GHL Stripe Reconciliation",
  description: "Read-only month-end reconciliation for GHL invoices, Stripe transactions, and unpaid subscriptions.",
  icons: {
    icon: "/favicon.svg"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

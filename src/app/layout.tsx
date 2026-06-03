import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayMatch - Stripe Reconciliation",
  description: "Read-only month-end reconciliation for invoices, payment transactions, and unpaid subscriptions.",
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

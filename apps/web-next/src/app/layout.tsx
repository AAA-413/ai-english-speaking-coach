import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI English Speaking Coach",
  description: "Scenario-based English speaking practice shell",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

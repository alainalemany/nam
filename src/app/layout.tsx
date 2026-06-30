import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "NAM Dashboard",
  description: "Personal mining operations dashboard foundation.",
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

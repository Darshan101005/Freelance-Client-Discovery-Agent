import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Client Hunter — Research workspace",
  description: "Find the right businesses. Verify the opportunity. Start a better conversation.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

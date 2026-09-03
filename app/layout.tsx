import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "High Dive",
  description: "Recruitment CRM and calling-operations platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={inter.className}
        style={{ fontFamily: `${inter.style.fontFamily}, -apple-system, sans-serif` }}
      >
        {children}
      </body>
    </html>
  );
}

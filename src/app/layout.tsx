import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Matches basePath in next.config.ts; static files in /public are served under it.
const BASE_PATH = "/db-viewer";

export const metadata: Metadata = {
  title: "DB Viewer PostgreSQL Admin",
  manifest: `${BASE_PATH}/site.webmanifest`,
  icons: {
    icon: [
      { url: `${BASE_PATH}/favicon-32x32.png`, sizes: "32x32", type: "image/png" },
      { url: `${BASE_PATH}/favicon-16x16.png`, sizes: "16x16", type: "image/png" },
    ],
    apple: { url: `${BASE_PATH}/apple-touch-icon.png`, sizes: "180x180" },
  },
  description:
    "Lightweight PostgreSQL database administration tool built with Next.js",
};

const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem("db-viewer-theme");
    if (t === "light" || t === "dark" || t === "dracula") {
      document.documentElement.classList.add(t);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.add("light");
    }
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

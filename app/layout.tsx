import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/app/service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "RozFit · Small steps, every day",
  description: "A simple, rule-based workout planner for steady beginner progress.",
  applicationName: "RozFit",
  appleWebApp: { capable: true, title: "RozFit", statusBarStyle: "default" },
  // The browser tab shows the simple "R" logo (Rozi's fur is lost at 16–32 px); home screens get Rozi's face.
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/logo-r-180.png", sizes: "180x180", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eceae6",
};

const THEME_SCRIPT = `try{if(localStorage.getItem("fittrack-theme")==="light"){document.documentElement.dataset.theme="light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#ece9f8")}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before the first paint, so the page never flashes the other theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}<ServiceWorkerRegistration /></body>
    </html>
  );
}

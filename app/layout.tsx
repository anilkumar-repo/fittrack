import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/app/service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "RozFit · Small steps, every day",
  description: "A simple, rule-based workout planner for steady beginner progress.",
  applicationName: "RozFit",
  appleWebApp: { capable: true, title: "RozFit", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e1614",
};

const THEME_SCRIPT = `try{var p=localStorage.getItem("fittrack-theme");if(p==="light"||(p==="auto"&&matchMedia("(prefers-color-scheme: light)").matches)){document.documentElement.dataset.theme="light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#ece9f8")}}catch(e){}`;

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

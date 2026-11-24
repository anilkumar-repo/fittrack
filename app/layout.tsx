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
  // Behave like an installed app: no pinch or double-tap zoom.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0f12",
};

const APP_FEEL_SCRIPT = `try{var s=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;if(s){document.documentElement.classList.add("standalone");document.addEventListener("gesturestart",function(e){e.preventDefault()},{passive:false});document.addEventListener("touchmove",function(e){if(e.touches&&e.touches.length>1)e.preventDefault()},{passive:false})}}catch(e){}`;

const THEME_SCRIPT = `try{var t=localStorage.getItem("fittrack-theme");if(t===null||t==="dark"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.dataset.theme="dark";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#0b0f12")}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before the first paint, so the page never flashes the other theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* In the installed Home Screen app, block pinch zoom so it feels like a native app. */}
        <script dangerouslySetInnerHTML={{ __html: APP_FEEL_SCRIPT }} />
      </head>
      <body>{children}<ServiceWorkerRegistration /></body>
    </html>
  );
}

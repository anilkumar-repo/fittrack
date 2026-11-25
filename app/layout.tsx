import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/app/service-worker-registration";
import "./globals.css";
import SPLASH_DEVICES from "@/lib/splash-devices.json";

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

// iOS can't switch a Home Screen web app's icon with the system appearance: it copies the icon once, when the app is
// added. So the page offers the icon that matches the phone right now — dark Rozi when the phone is in dark mode —
// and iOS keeps whichever one is current at "Add to Home Screen". (Native-only: dark/tinted icons that change later.)
const ICON_SCRIPT = `try{var q=matchMedia("(prefers-color-scheme: dark)");var f=function(){var l=document.querySelector('link[rel="apple-touch-icon"]');if(l)l.href=q.matches?"/icons/apple-touch-icon-dark.png":"/icons/apple-touch-icon.png"};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",f);else f();q.addEventListener("change",f)}catch(e){}`;

const THEME_SCRIPT = `try{var t=localStorage.getItem("fittrack-theme");if(t===null||t==="dark"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.dataset.theme="dark";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#0b0f12")}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before the first paint, so the page never flashes the other theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* In the installed Home Screen app, block pinch zoom so it feels like a native app. */}
        <script dangerouslySetInnerHTML={{ __html: APP_FEEL_SCRIPT }} />
        {/* iPhone launch pictures (scripts/build-splash.mjs): the opening's first frame instead of a black screen.
            Written here, not in `metadata`, because Next streams metadata into the body and iOS only reads the head. */}
        {SPLASH_DEVICES.flatMap(({ w, h, dpr }) => (["light", "dark"] as const).map((look) => (
          <link key={`${w}x${h}@${dpr}-${look}`} rel="apple-touch-startup-image" href={`/splash/${w}x${h}@${dpr}-${look}.png`}
            media={`(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait) and (prefers-color-scheme: ${look})`} />
        )))}
      </head>
      <body>{children}<ServiceWorkerRegistration /><script dangerouslySetInnerHTML={{ __html: ICON_SCRIPT }} /></body>
    </html>
  );
}

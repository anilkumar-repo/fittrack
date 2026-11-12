import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/app/service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitTrack · Training, made steady",
  description: "A simple, rule-based workout planner for steady beginner progress.",
  applicationName: "FitTrack",
  appleWebApp: { capable: true, title: "FitTrack", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#745be0",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<ServiceWorkerRegistration /></body>
    </html>
  );
}

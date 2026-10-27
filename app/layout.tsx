import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitTrack · Training, made steady",
  description: "A simple, rule-based workout planner for steady beginner progress.",
  applicationName: "FitTrack",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

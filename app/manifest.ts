import type { MetadataRoute } from "next";

/** Lets phones and computers install FitTrack to the home screen and open it like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FitTrack",
    short_name: "FitTrack",
    description: "A simple, rule-based workout planner for steady beginner progress.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e1614",
    theme_color: "#0e1614",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

import { AppShell } from "@/components/app/app-shell";
import { FitTrackProvider } from "@/components/app/fit-track-provider";

/** Keeps the signed-in state and navigation mounted while moving between pages. */
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <FitTrackProvider><AppShell>{children}</AppShell></FitTrackProvider>;
}

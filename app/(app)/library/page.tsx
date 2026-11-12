import type { Metadata } from "next";
import { LibraryScreen } from "@/components/screens/library-screen";

export const metadata: Metadata = { title: "Exercise library · FitTrack" };

export default function Page() {
  return <LibraryScreen />;
}

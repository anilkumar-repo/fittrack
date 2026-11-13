import type { Metadata } from "next";
import { LibraryScreen } from "@/components/screens/library-screen";

export const metadata: Metadata = { title: "Exercise library · RozFit" };

export default function Page() {
  return <LibraryScreen />;
}

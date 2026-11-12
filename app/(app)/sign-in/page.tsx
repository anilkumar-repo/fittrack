import type { Metadata } from "next";
import { AccountCard } from "@/components/app/account-cards";

export const metadata: Metadata = { title: "Sign in · FitTrack" };

export default function Page() {
  return <section className="sign-in-page"><AccountCard /></section>;
}

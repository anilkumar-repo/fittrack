import type { Metadata } from "next";
import { AccountCard } from "@/components/app/account-cards";

export const metadata: Metadata = { title: "Sign in · FitTrack" };

export default function Page() {
  return (
    <section className="sign-in-page">
      <div className="sign-in-hero"><h2>Keep your progress safe</h2><p>Sign in with your email to save your workouts and see them on any phone or computer.</p></div>
      <AccountCard />
    </section>
  );
}

import type { Metadata } from "next";
import { AccountCard } from "@/components/app/account-cards";
import { Rozi } from "@/components/app/rozi";

export const metadata: Metadata = { title: "Sign in · RozFit" };

export default function Page() {
  return (
    <section className="sign-in-page">
      <div className="sign-in-hero"><Rozi mood="signin" size={130} priority className="sign-in-rozi" /><h2>Keep your progress safe</h2><p>Sign in with your email to save your workouts and see them on any phone or computer.</p></div>
      <AccountCard />
    </section>
  );
}

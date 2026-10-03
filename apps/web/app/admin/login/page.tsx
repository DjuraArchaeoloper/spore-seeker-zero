import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentAdmin } from "../../../lib/adminApi";
import { AdminLoginForm } from "./AdminLoginForm";

export const metadata: Metadata = {
  title: "Admin sign in · SPØR",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");
  return (
    <main className="adminRoot">
      <div className="adminAmbient" aria-hidden="true" />
      <div className="adminBrand"><span>SPØR</span><i /><span>ADMIN</span></div>
      <section className="adminPanel" aria-labelledby="admin-login-title">
        <p className="adminEyebrow">INTERNAL ACCESS</p>
        <h1 className="adminTitle" id="admin-login-title">Sign in.</h1>
        <p className="adminIntro">Enter your approved email to receive a one-time code.</p>
        <AdminLoginForm />
      </section>
      <p className="adminFootnote">SPØR · SEEKER ZERO</p>
    </main>
  );
}

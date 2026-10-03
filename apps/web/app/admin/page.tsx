import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentAdmin } from "../../lib/adminApi";
import { AdminLogoutButton } from "./AdminLogoutButton";
import { AdminDashboard } from "./AdminDashboard";

export const metadata: Metadata = {
  title: "Admin · SPØR",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return (
    <main className="adminRoot">
      <div className="adminAmbient" aria-hidden="true" />
      <div className="adminBrand"><span>SPØR</span><i /><span>ADMIN</span></div>
      <div className="adminDashboardFrame">
        <header className="adminDashboardHeader">
          <div><p className="adminEyebrow">INTERNAL ACCESS</p><h1 className="adminTitle" id="admin-title">Control.</h1></div>
          <div className="adminDashboardIdentity"><span>{admin.email}</span><AdminLogoutButton /></div>
        </header>
        <AdminDashboard />
      </div>
    </main>
  );
}

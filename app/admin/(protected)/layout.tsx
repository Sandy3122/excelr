import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { ADMIN_COOKIE, verifyAdminSessionToken } from "@/lib/admin/session";

export const metadata: Metadata = {
  title: "Admin — ExcelR Placement Drive",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) {
    redirect("/admin/login");
  }
  return <AdminShell>{children}</AdminShell>;
}

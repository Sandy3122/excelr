"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, LogOut, Menu, Send, Users } from "lucide-react";
import { RightDrawer } from "@/components/admin/right-drawer";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Leads", icon: Users },
  { href: "/admin/automations", label: "Automations", icon: Send },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F4F6FB] text-ink">
      <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-white/10 bg-navy-900 text-white md:flex">
        <div className="shrink-0 px-5 py-6">
          <div className="font-heading text-sm font-semibold tracking-wide text-white/70">
            ExcelR
          </div>
          <div className="mt-1 font-heading text-lg font-bold">Placement Admin</div>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3">
          {NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="m-3 flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="font-heading font-bold">Placement Admin</div>
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="rounded-full p-2 text-navy-900 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-6 md:px-8">
          {children}
        </main>
      </div>

      <RightDrawer open={navOpen} title="Menu" onClose={() => setNavOpen(false)}>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                  active ? "bg-navy-900 text-white" : "text-ink hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="mt-6 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-muted hover:bg-slate-50 hover:text-ink"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </RightDrawer>
    </div>
  );
}

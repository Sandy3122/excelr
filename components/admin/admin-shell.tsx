"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Settings,
  Users,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Leads", icon: Users },
  { href: "/admin/automations", label: "Automations", icon: Send },
  // { href: "/admin/settings", label: "Settings", icon: Settings },
];

const SIDEBAR_KEY = "admin-sidebar-collapsed";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.replace("/admin/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F4F6FB] text-ink">
      <aside
        className={`hidden h-full shrink-0 flex-col border-r border-white/10 bg-navy-900 text-white lg:flex ${
          collapsed ? "w-[4.5rem]" : "w-60"
        }`}
      >
        <div className={`shrink-0 ${collapsed ? "px-3 py-5" : "px-5 py-6"}`}>
          {collapsed ? (
            <div className="text-center font-heading text-sm font-bold">E</div>
          ) : (
            <>
              <div className="font-heading text-sm font-semibold tracking-wide text-white/70">
                ExcelR
              </div>
              <div className="mt-1 font-heading text-lg font-bold">Placement Admin</div>
            </>
          )}
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2">
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
                title={item.label}
                className={`flex items-center rounded-xl py-2.5 text-sm font-medium transition ${
                  collapsed ? "justify-center px-2" : "gap-3 px-3"
                } ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 space-y-1 p-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Minimize sidebar"}
            className={`flex w-full items-center rounded-xl py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white ${
              collapsed ? "justify-center px-2" : "gap-3 px-3"
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                Minimize
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            title="Log out"
            className={`flex w-full items-center rounded-xl py-2.5 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white ${
              collapsed ? "justify-center px-2" : "gap-3 px-3"
            }`}
          >
            <LogOut className="h-4 w-4" />
            {collapsed ? <span className="sr-only">Log out</span> : "Log out"}
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="font-heading font-bold">Placement Admin</div>
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="text-sm text-muted"
          >
            Log out
          </button>
        </header>
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 lg:hidden">
          {NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                  active ? "bg-navy-900 text-white" : "text-muted"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-4 sm:py-6 lg:px-6 xl:px-8">
          {children}
        </main>
      </div>

      {logoutOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-card-lg sm:p-6">
            <h2
              id="logout-confirm-title"
              className="font-heading text-lg font-bold text-navy-900"
            >
              Log out?
            </h2>
            <p className="mt-2 text-sm text-muted">
              You will need to sign in again to open Placement Admin.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setLogoutOpen(false)}
                className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => void handleLogout()}
                className="btn-gradient py-2.5 text-sm disabled:opacity-60"
              >
                {loggingOut ? "Logging out…" : "Log out"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

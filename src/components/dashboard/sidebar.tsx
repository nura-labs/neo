"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  GitFork,
  Settings,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/knowledge", label: "Knowledge", icon: FileText },
  { href: "/graph", label: "Graph", icon: GitFork },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("neo-sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("neo-sidebar-collapsed", String(next));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await signOut();
    router.push("/login");
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 240 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col border-r h-screen overflow-hidden"
      style={{
        background: "var(--neo-surface)",
        borderColor: "var(--neo-border)",
      }}
    >
      {/* Logo */}
      <div
        className="flex h-14 items-center px-4 shrink-0"
        style={{ borderBottom: "1px solid var(--neo-border)" }}
      >
        <Link href="/" className="flex items-center gap-2 overflow-hidden">
          <div
            className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold"
            style={{ background: "var(--neo-accent)", color: "#fff" }}
          >
            N
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="flex flex-col overflow-hidden whitespace-nowrap"
              >
                <span className="neo-heading text-sm">Neo</span>
                <span className="neo-label" style={{ fontSize: 9, marginTop: -2 }}>
                  by Nura Labs
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors relative"
              style={{
                color: active ? "var(--neo-accent)" : "var(--neo-fg-secondary)",
                background: active ? "var(--neo-accent-muted)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "var(--neo-surface-hover)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className="shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* User section + collapse toggle */}
      <div
        className="p-2 space-y-1 shrink-0"
        style={{ borderTop: "1px solid var(--neo-border)" }}
      >
        {/* User info */}
        {user && (
          <div
            className="flex items-center gap-3 rounded-md px-3 py-2 overflow-hidden"
          >
            <div
              className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-medium"
              style={{ background: "var(--neo-surface2)", color: "var(--neo-fg-secondary)" }}
            >
              {(user.displayName ?? user.email ?? "U")[0].toUpperCase()}
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs truncate"
                  style={{ color: "var(--neo-fg-secondary)" }}
                >
                  {user.displayName ?? user.email}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm w-full transition-colors"
          style={{ color: "var(--neo-fg-muted)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--neo-surface-hover)";
            e.currentTarget.style.color = "var(--neo-fg-secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--neo-fg-muted)";
          }}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut size={16} className="shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Sign out
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm w-full transition-colors"
          style={{ color: "var(--neo-fg-muted)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--neo-surface-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {collapsed ? (
            <ChevronsRight size={16} className="shrink-0" />
          ) : (
            <>
              <ChevronsLeft size={16} className="shrink-0" />
              <span className="overflow-hidden whitespace-nowrap">Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}

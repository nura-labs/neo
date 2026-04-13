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
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
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

  const photoURL = user?.photoURL;

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 240 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col h-screen overflow-hidden shrink-0"
      style={{
        background: "var(--neo-surface)",
        borderRight: "1px solid var(--neo-border)",
      }}
    >
      {/* Logo + collapse toggle */}
      <div
        className="flex items-center justify-between h-12 px-3 shrink-0"
        style={{ borderBottom: "1px solid var(--neo-border)" }}
      >
        <Link href="/" className="flex items-center gap-2 overflow-hidden min-w-0">
          <AnimatePresence mode="wait">
            {!collapsed ? (
              <motion.div
                key="full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col leading-none"
              >
                <span className="text-sm font-semibold" style={{ color: "var(--neo-fg)" }}>
                  Neo
                </span>
                <span className="neo-label" style={{ fontSize: 8, marginTop: 1 }}>
                  by Nura Labs
                </span>
              </motion.div>
            ) : (
              <motion.span
                key="short"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-semibold"
                style={{ color: "var(--neo-fg)" }}
              >
                N
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        <button
          onClick={toggleCollapse}
          className="p-1 rounded transition-colors shrink-0"
          style={{ color: "var(--neo-fg-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neo-fg-secondary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--neo-fg-muted)")}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
              style={{
                color: active ? "var(--neo-fg)" : "var(--neo-fg-muted)",
                background: active ? "rgba(255, 255, 255, 0.06)" : "transparent",
                fontWeight: active ? 500 : 400,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                  e.currentTarget.style.color = "var(--neo-fg-secondary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--neo-fg-muted)";
                }
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

      {/* Bottom section */}
      <div
        className="px-2 py-2 space-y-0.5 shrink-0"
        style={{ borderTop: "1px solid var(--neo-border)" }}
      >
        {/* Support */}
        <a
          href="mailto:support@nura.sh"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
          style={{ color: "var(--neo-fg-muted)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
            e.currentTarget.style.color = "var(--neo-fg-secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--neo-fg-muted)";
          }}
          title={collapsed ? "Support" : undefined}
        >
          <HelpCircle size={18} className="shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Support
              </motion.span>
            )}
          </AnimatePresence>
        </a>

        {/* User */}
        {user && (
          <div className="flex items-center gap-3 rounded-md px-3 py-2 overflow-hidden">
            {photoURL ? (
              <img
                src={photoURL}
                alt=""
                className="h-7 w-7 rounded-full shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-xs font-medium"
                style={{ background: "rgba(255, 255, 255, 0.10)", color: "var(--neo-fg-secondary)" }}
              >
                {(user.displayName ?? user.email ?? "U")[0].toUpperCase()}
              </div>
            )}
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 min-w-0 flex items-center justify-between"
                >
                  <span
                    className="text-sm truncate"
                    style={{ color: "var(--neo-fg)" }}
                  >
                    {user.displayName ?? user.email}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="p-1 rounded transition-colors shrink-0"
                    style={{ color: "var(--neo-fg-muted)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neo-fg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--neo-fg-muted)")}
                    title="Sign out"
                  >
                    <LogOut size={14} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.aside>
  );
}

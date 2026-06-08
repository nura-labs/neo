"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { usePlatform } from "@/contexts/platform-context";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { DOCS_URL } from "@/lib/constants/urls";
import {
  LayoutDashboard,
  FileText,
  GitFork,
  Activity,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  Building2,
  Users,
  Key,
  BarChart3,
  BookOpen,
} from "lucide-react";

const personalNavItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/knowledge", label: "Knowledge", icon: FileText },
  { href: "/graph", label: "Graph", icon: GitFork },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

const platformNavItems = [
  { href: "/platform", label: "Overview", icon: LayoutDashboard },
  { href: "/platform/tenants", label: "Tenants", icon: Users },
  { href: "/platform/keys", label: "API Keys", icon: Key },
  { href: "/platform/usage", label: "Usage", icon: BarChart3 },
  { href: "/platform/settings", label: "Settings", icon: Settings },
  { href: DOCS_URL, label: "Docs", icon: BookOpen, external: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { isPlatformEnabled, mode, setMode } = usePlatform();
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("neo-sidebar-collapsed") === "true"
  );

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
    href === "/" || href === "/platform"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  const navItems = mode === "platform" ? platformNavItems : personalNavItems;
  const photoURL = user?.photoURL;

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 260 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col h-screen overflow-hidden shrink-0"
      style={{
        background: "var(--neo-bg)",
        borderRight: "1px solid var(--neo-border)",
      }}
    >
      {/* Logo + collapse */}
      <div
        className="flex items-center justify-between h-14 px-4 shrink-0"
        style={{ borderBottom: "1px solid var(--neo-border)" }}
      >
        <Link href={mode === "platform" ? "/platform" : "/"} className="flex items-center gap-2 overflow-hidden min-w-0">
          <AnimatePresence mode="wait">
            {!collapsed ? (
              <motion.div key="full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col leading-none">
                <span className="text-[15px] font-semibold" style={{ color: "var(--neo-fg)" }}>Neo</span>
                <span className="neo-label" style={{ fontSize: 9, marginTop: 2 }}>by Nura Labs</span>
              </motion.div>
            ) : (
              <motion.span key="short" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[15px] font-semibold" style={{ color: "var(--neo-fg)" }}>
                N
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        <button
          onClick={toggleCollapse}
          className="p-1.5 rounded-md transition-colors shrink-0"
          style={{ color: "var(--neo-fg-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neo-fg-secondary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--neo-fg-muted)")}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Mode switcher — only when current workspace has Platform enabled */}
      {isPlatformEnabled && !collapsed && (
        <div className="px-3 pt-3">
          <div
            className="flex rounded-lg p-0.5"
            style={{ background: "var(--neo-surface2)", border: "1px solid var(--neo-border)" }}
          >
            {(["personal", "platform"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  router.push(m === "platform" ? "/platform" : "/");
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors capitalize"
                style={{
                  background: mode === m ? "var(--neo-surface-hover)" : "transparent",
                  color: mode === m ? "var(--neo-fg)" : "var(--neo-fg-muted)",
                }}
              >
                {m === "platform" && <Building2 size={12} />}
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {isPlatformEnabled && collapsed && (
        <div className="px-3 pt-3 flex justify-center">
          <button
            onClick={() => {
              const next = mode === "personal" ? "platform" : "personal";
              setMode(next);
              router.push(next === "platform" ? "/platform" : "/");
            }}
            className="p-2 rounded-md transition-colors"
            style={{ color: "var(--neo-fg-muted)", background: "var(--neo-surface2)" }}
            title={mode === "personal" ? "Switch to Platform" : "Switch to Personal"}
          >
            <Building2 size={16} />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-1">
        {navItems.map((item) => {
          const active = !("external" in item && item.external) && isActive(item.href);
          const className = "flex items-center gap-3.5 rounded-lg px-3 py-2.5 text-[15px] transition-colors";
          const style = {
            color: active ? "var(--neo-fg)" : "var(--neo-fg-muted)",
            background: active ? "var(--neo-surface-hover)" : "transparent",
            fontWeight: active ? 500 : 400,
          } as const;
          const hoverHandlers = {
            onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
              if (!active) {
                e.currentTarget.style.background = "var(--neo-surface-hover)";
                e.currentTarget.style.color = "var(--neo-fg-secondary)";
              }
            },
            onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
              if (!active) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--neo-fg-muted)";
              }
            },
          };
          const content = (
            <>
              <item.icon size={20} className="shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="overflow-hidden whitespace-nowrap">
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </>
          );

          if ("external" in item && item.external) {
            return (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
                style={style}
                {...hoverHandlers}
                title={collapsed ? item.label : undefined}
              >
                {content}
              </a>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={className}
              style={style}
              {...hoverHandlers}
              title={collapsed ? item.label : undefined}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 space-y-1 shrink-0" style={{ borderTop: "1px solid var(--neo-border)" }}>
        <a
          href="mailto:support@nura.sh"
          className="flex items-center gap-3.5 rounded-lg px-3 py-2.5 text-[15px] transition-colors"
          style={{ color: "var(--neo-fg-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--neo-surface-hover)"; e.currentTarget.style.color = "var(--neo-fg-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--neo-fg-muted)"; }}
          title={collapsed ? "Support" : undefined}
        >
          <HelpCircle size={20} className="shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="overflow-hidden whitespace-nowrap">Support</motion.span>
            )}
          </AnimatePresence>
        </a>

        {user && (
          <div className={`flex items-center gap-3 rounded-lg py-2.5 overflow-hidden ${collapsed ? "justify-center px-0" : "px-3"}`}>
            {photoURL ? (
              <img src={photoURL} alt="" className="h-8 w-8 rounded-full shrink-0 object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-sm font-medium" style={{ background: "var(--neo-surface2)", color: "var(--neo-fg-muted)" }}>
                {(user.displayName ?? user.email ?? "U")[0].toUpperCase()}
              </div>
            )}
            <AnimatePresence>
              {!collapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0 flex items-center justify-between">
                  <span className="text-sm truncate" style={{ color: "var(--neo-fg)" }}>
                    {user.displayName ?? user.email}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <ThemeToggle />
                    <button
                      onClick={handleLogout}
                      className="p-1.5 rounded-md transition-colors"
                      style={{ color: "var(--neo-fg-muted)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neo-fg)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--neo-fg-muted)")}
                      title="Sign out"
                    >
                      <LogOut size={15} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Overview", icon: "~" },
  { href: "/graph", label: "Graph", icon: "G" },
  { href: "/knowledge", label: "Knowledge", icon: "K" },
  { href: "/settings", label: "Settings", icon: "S" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r bg-muted/30">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex flex-col">
          <span className="text-lg font-bold tracking-tight">Neo</span>
          <span className="text-[10px] text-muted-foreground -mt-1">by Nura Labs</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-bold">
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

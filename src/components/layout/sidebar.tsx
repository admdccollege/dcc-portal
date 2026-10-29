"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Award, BarChart3, BookOpen, CalendarCheck, CalendarClock, ChevronsLeft, ChevronsRight, ClipboardList,
  FilePen, GraduationCap, IndianRupee, LayoutDashboard, Megaphone, Settings, ShieldCheck, User, UserCog, Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/navigation";

const ICONS: Record<string, LucideIcon> = {
  Award, BarChart3, BookOpen, CalendarCheck, CalendarClock, ClipboardList, FilePen, GraduationCap, IndianRupee,
  LayoutDashboard, Megaphone, Settings, ShieldCheck, User, UserCog, Users,
};

export function CollegeMark({ collapsed, shortName, name }: { collapsed?: boolean; shortName: string; name: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      {/* Logo placeholder — replace via Settings › Institution (logo upload) */}
      <div
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-active font-bold text-sidebar shadow-inner"
      >
        {shortName.slice(0, 3)}
      </div>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          <p className="text-xs text-sidebar-muted">Education Portal</p>
        </div>
      )}
    </div>
  );
}

export function NavLinks({ items, collapsed, onNavigate }: { items: NavItem[]; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active =
          item.href === "/my" ? pathname === "/my" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-white"
                : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-white",
              collapsed && "justify-center px-2",
            )}
          >
            <Icon className={cn("size-[18px] shrink-0", active ? "text-sidebar-active" : "text-sidebar-muted group-hover:text-white")} aria-hidden />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ items, shortName, name }: { items: NavItem[]; shortName: string; name: string }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore persisted UI preference after hydration
      setCollapsed(localStorage.getItem("dcc.sidebar") === "collapsed");
    } catch {}
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("dcc.sidebar", c ? "expanded" : "collapsed");
      } catch {}
      return !c;
    });
  };
  return (
    <aside
      className={cn(
        "no-print sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <CollegeMark collapsed={collapsed} shortName={shortName} name={name} />
      <NavLinks items={items} collapsed={collapsed} />
      <button
        type="button"
        onClick={toggle}
        className="m-2 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-sidebar-muted hover:bg-sidebar-accent hover:text-white cursor-pointer"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
      </button>
    </aside>
  );
}

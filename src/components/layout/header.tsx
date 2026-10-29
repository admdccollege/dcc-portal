"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { Bell, KeyRound, LogOut, Menu, Moon, Sun, User } from "lucide-react";
import { Dialog, SheetContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CollegeMark, NavLinks } from "./sidebar";
import type { NavItem } from "@/lib/navigation";
import { signOut } from "@/server/auth-actions";
import { markNotificationsRead } from "@/server/notification-actions";
import { formatDate } from "@/lib/utils";

export type HeaderNotification = { id: string; title: string; body: string | null; link: string | null; created_at: string; read_at: string | null };

export function Header({
  items, userName, roleLabel, notifications, shortName, name, profileHref,
}: {
  items: NavItem[];
  userName: string;
  roleLabel: string;
  notifications: HeaderNotification[];
  shortName: string;
  name: string;
  profileHref: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [, startTransition] = useTransition();
  const unread = notifications.filter((n) => !n.read_at).length;
  const initials = userName.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur sm:px-5">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
        <Menu />
      </Button>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent className="flex flex-col bg-sidebar text-sidebar-foreground" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <CollegeMark shortName={shortName} name={name} />
          <NavLinks items={items} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Dialog>

      <p className="truncate text-sm font-semibold text-foreground lg:hidden">{shortName} Portal</p>
      <div className="flex-1" />

      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle dark mode"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        <Sun className="hidden dark:block" />
        <Moon className="dark:hidden" />
      </Button>

      <DropdownMenu
        onOpenChange={(open) => {
          if (!open && unread > 0) startTransition(() => markNotificationsRead());
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} className="relative">
            <Bell />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifications.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">No notifications</p>}
          {notifications.map((n) => (
            <DropdownMenuItem key={n.id} asChild>
              <Link href={n.link ?? "#"} className="flex flex-col items-start gap-0.5">
                <span className="flex w-full items-center gap-2 font-medium">
                  {!n.read_at && <span className="size-2 rounded-full bg-primary" aria-label="Unread" />}
                  {n.title}
                </span>
                {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                <span className="text-[11px] text-muted-foreground">{formatDate(n.created_at, true)}</span>
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/notices" className="justify-center text-primary">View notice board</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md p-1 pr-2 hover:bg-muted cursor-pointer" aria-label="Account menu">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials || "U"}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-40 truncate text-sm font-medium">{userName}</span>
              <span className="block text-xs text-muted-foreground">{roleLabel}</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="font-normal">
            <p className="font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={profileHref}><User /> My profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/account/password"><KeyRound /> Change password</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => startTransition(() => signOut())} className="text-destructive focus:text-destructive">
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

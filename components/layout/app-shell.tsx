"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  Bot,
  LayoutDashboard,
  LogOut
} from "lucide-react";
import { RealtimeSync } from "@/components/layout/realtime-sync";
import { QuickAddTransaction } from "@/components/transactions/quick-add";
import type { Account, Category } from "@/lib/finance-types";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/insights", label: "Insights", icon: Activity },
  { href: "/assistant", label: "Ask Nivora", icon: Bot }
];

export function AppShell({
  children,
  userEmail,
  displayName,
  categories,
  accounts
}: {
  children: React.ReactNode;
  userEmail: string;
  displayName: string;
  categories: Category[];
  accounts: Account[];
}) {
  const pathname = usePathname();
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="Main navigation">
        <Link className="wordmark sidebar-brand" href="/dashboard" aria-label="Nivora overview">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>Nivora</span>
        </Link>
        <div className="sidebar-caption">YOUR MONEY</div>
        <nav className="sidebar-nav">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
            return (
              <Link key={href} href={href} className={`nav-link${active ? " nav-link-active" : ""}`} aria-current={active ? "page" : undefined}>
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
                {href === "/assistant" && <span className="nav-new">AI</span>}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note"><span className="privacy-indicator" /><span>Private workspace</span></div>
          <div className="sidebar-profile">
            <span className="avatar" aria-hidden="true">{initials || "N"}</span>
            <span className="profile-copy"><strong>{displayName}</strong><small>{userEmail}</small></span>
            <form action="/auth/signout" method="post">
              <button className="icon-button signout-button" type="submit" aria-label="Sign out" title="Sign out">
                <LogOut size={17} aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <Link className="wordmark mobile-brand" href="/dashboard" aria-label="Nivora overview">
            <span className="brand-mark" aria-hidden="true"><span /></span><span>Nivora</span>
          </Link>
          <div className="topbar-meta"><RealtimeSync /><span className="topbar-divider" /><span>INR · India</span></div>
          <QuickAddTransaction categories={categories} accounts={accounts} compact />
        </header>
        <main className="page-content">{children}</main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return <Link key={href} href={href} aria-label={label} aria-current={active ? "page" : undefined} className={active ? "mobile-nav-active" : ""}><Icon size={19} aria-hidden="true" /><span>{label}</span></Link>;
        })}
      </nav>
    </div>
  );
}

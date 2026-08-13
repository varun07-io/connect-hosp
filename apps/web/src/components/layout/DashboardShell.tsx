import * as React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { LogOut, ExternalLink, Menu, User } from "lucide-react";
import { cn, firstName, initials } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface DashboardNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

interface DashboardShellProps {
  roleLabel: string;
  navItems: DashboardNavItem[];
}

function SidebarNav({ navItems, onNavigate }: { navItems: DashboardNavItem[]; onNavigate?: () => void }) {
  return (
    <>
      <Link to="/" className="flex h-16 shrink-0 items-center border-b border-border px-5">
        <img src="/logo.png" alt="Connect Hospital" className="h-9 w-auto object-contain" />
      </Link>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-primary-50 text-primary-700" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
          Back to public site
        </Link>
      </div>
    </>
  );
}

export function DashboardShell({ roleLabel, navItems }: DashboardShellProps) {
  const { me, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-background md:flex">
        <SidebarNav navItems={navItems} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-3 sm:px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-muted md:hidden" aria-label="Open navigation">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 md:hidden">
                <SidebarNav navItems={navItems} onNavigate={() => setMobileNavOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{roleLabel}</p>
              <p className="truncate font-display text-sm font-semibold">Welcome{me ? `, ${firstName(me.user.name)}` : ""}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {me?.hospital && (
              <Badge variant={me.hospital.status === "APPROVED" ? "success" : "warning"} className="hidden sm:inline-flex">
                {me.hospital.name}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full">
                  <Avatar>
                    <AvatarFallback>{me ? initials(me.user.name) : "?"}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {me?.user.name}
                  {me?.hospital && <span className="mt-0.5 block font-normal normal-case text-muted-foreground sm:hidden">{me.hospital.name}</span>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/")}>
                  <User className="h-4 w-4" /> Public site
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:bg-red-50 focus:text-destructive">
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

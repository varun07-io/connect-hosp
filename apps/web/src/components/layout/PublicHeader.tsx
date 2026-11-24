import * as React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogIn, LogOut, Menu, User, HeartHandshake, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { ROLE_HOME, ROLE_LABEL } from "@/lib/roles";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";

const NAV_LINKS = [
  { to: "/search", label: "Find a hospital", icon: Building2 },
  { to: "/search?intent=second-opinion", label: "Get a second opinion", icon: HeartHandshake },
  { to: "/list-your-hospital", label: "For hospitals", icon: User },
];

export function PublicHeader() {
  const { me, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src="/logo.png" alt="Connect Hospital" className="h-10 w-auto object-contain" />
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              className={({ isActive }) => (isActive ? "text-primary-700" : "transition-colors hover:text-foreground")}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated && me ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 text-sm font-medium hover:bg-muted">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>{initials(me.user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline">{ROLE_LABEL[me.user.role]}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{me.user.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(ROLE_HOME[me.user.role])}>
                  <LayoutDashboard className="h-4 w-4" /> Go to dashboard
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    void signOut();
                    navigate("/login");
                  }}
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => navigate("/login")}>
              <LogIn className="h-4 w-4" />
              Log in
            </Button>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-muted md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0">
              <div className="flex h-16 items-center border-b border-border px-5">
                <img src="/logo.png" alt="Connect Hospital" className="h-9 w-auto object-contain" />
              </div>
              <nav className="flex flex-col gap-1 p-3">
                {NAV_LINKS.map((link) => (
                  <SheetClose asChild key={link.label}>
                    <NavLink
                      to={link.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                          isActive ? "bg-primary-50 text-primary-700" : "text-foreground hover:bg-muted"
                        }`
                      }
                    >
                      <link.icon className="h-4 w-4" />
                      {link.label}
                    </NavLink>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-auto border-t border-border p-3">
                {isAuthenticated && me ? (
                  <div className="space-y-1">
                    <SheetClose asChild>
                      <button
                        onClick={() => navigate(ROLE_HOME[me.user.role])}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted"
                      >
                        <LayoutDashboard className="h-4 w-4" /> Go to dashboard
                      </button>
                    </SheetClose>
                    <button
                      onClick={() => {
                        void signOut();
                        navigate("/login");
                        setMobileOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                ) : (
                  <SheetClose asChild>
                    <Button className="w-full" onClick={() => navigate("/login")}>
                      <LogIn className="h-4 w-4" /> Log in
                    </Button>
                  </SheetClose>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

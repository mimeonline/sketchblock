"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FilePenLine,
  Gauge,
  GitBranch,
  LogOut,
  Menu,
  MonitorCog,
  Settings,
  SquareDashedMousePointer,
  Tag,
  Users,
  X,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PocMarker } from "@/features/home/atoms/PocMarker";
import { SketchblockLogo } from "@/features/home/atoms/SketchblockLogo";
import type { HomeView } from "@/features/home/types/home-view";
import { cn } from "@/lib/utils";

type NavItem = {
  view: HomeView;
  href: string;
  label: string;
  mobileLabel?: string;
  icon: ComponentType<{ className?: string }>;
};

const workspaceItems: NavItem[] = [
  { view: "dashboard", href: "/", label: "Overview", mobileLabel: "Home", icon: Gauge },
  { view: "drawings", href: "/drawings", label: "Boards", icon: FilePenLine },
  {
    view: "sessions",
    href: "/sessions",
    label: "Collaboration",
    mobileLabel: "Live",
    icon: SquareDashedMousePointer,
  },
];

const managementItems: NavItem[] = [
  { view: "repositories", href: "/repositories", label: "Repository", icon: GitBranch },
  { view: "users", href: "/users", label: "Users", icon: Users },
  { view: "system", href: "/system", label: "System", icon: MonitorCog },
  { view: "settings", href: "/settings", label: "Settings", icon: Settings },
];

const appVersion = process.env.NEXT_PUBLIC_SKETCHBLOCK_VERSION || "local";

function isItemActive(pathname: string, item: NavItem) {
  if (item.view === "dashboard") {
    return pathname === "/";
  }

  if (item.view === "drawings" && pathname.startsWith("/editor")) {
    return true;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function DesktopNavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = isItemActive(pathname, item);

  return (
    <Link
      href={item.href}
      title={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "relative h-11 w-full justify-center gap-3 px-3 text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/45 lg:justify-start",
        active &&
          "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_var(--sidebar-border)] before:absolute before:inset-y-2.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary",
      )}
    >
      <Icon className="size-[1.125rem] shrink-0" />
      <span className="sr-only min-w-0 truncate lg:not-sr-only lg:inline">{item.label}</span>
    </Link>
  );
}

function MobileNavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isItemActive(pathname, item);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.6875rem] font-medium text-sidebar-foreground/65 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
    >
      <Icon className={cn("size-5", active && "text-sidebar-primary")} />
      <span className="max-w-full truncate">{item.mobileLabel || item.label}</span>
    </Link>
  );
}

export function AppSidebar({ role }: { role: "instance_owner" | "user" }) {
  const pathname = usePathname();
  const t = useTranslations("Navigation");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [health, setHealth] = useState<{ status: "operational" | "degraded" | "unknown"; label: string } | null>(null);
  const translatedWorkspaceItems = workspaceItems.map((item) => ({
    ...item,
    label: item.view === "dashboard" ? t("overview") : item.view === "drawings" ? t("boards") : t("collaboration"),
    mobileLabel: item.view === "dashboard" ? t("start") : item.view === "sessions" ? t("live") : undefined,
  }));
  const translatedManagementItems = managementItems.map((item) => ({
    ...item,
    label: item.view === "repositories" ? t("repository") : item.view === "users" ? t("users") : item.view === "system" ? t("system") : t("settings"),
  }));
  const visibleManagementItems = translatedManagementItems.filter(
    (item) => !["users", "system"].includes(item.view) || role === "instance_owner",
  );
  const managementActive = visibleManagementItems.some((item) => isItemActive(pathname, item));

  useEffect(() => {
    if (role !== "instance_owner") return;
    let active = true;
    async function loadHealth() {
      try {
        const response = await fetch("/api/admin/health", { cache: "no-store" });
        const payload = (await response.json()) as { health?: { status: "operational" | "degraded" | "unknown"; label: string } };
        if (active && response.ok && payload.health) setHealth(payload.health);
      } catch {
        if (active) setHealth({ status: "unknown", label: "Systemstatus unbekannt" });
      }
    }
    void loadHealth();
    const intervalId = window.setInterval(() => { if (document.visibilityState === "visible") void loadHealth(); }, 60_000);
    const handleVisibility = () => { if (document.visibilityState === "visible") void loadHealth(); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { active = false; window.clearInterval(intervalId); document.removeEventListener("visibilitychange", handleVisibility); };
  }, [role]);

  return (
    <>
      <aside className="sketchblock-sidebar sticky top-0 hidden h-screen w-20 shrink-0 flex-col border-r border-sidebar-border px-3 py-4 text-sidebar-foreground md:flex lg:w-60 lg:px-4">
        <Link
          aria-label={t("toOverview")}
          className="flex min-h-11 items-center justify-center gap-3 rounded-xl px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar lg:justify-start"
          href="/"
        >
          <SketchblockLogo className="size-9 shrink-0" />
          <div className="hidden min-w-0 items-center gap-2 lg:flex">
            <span className="truncate text-sm font-semibold tracking-[-0.01em]">Sketchblock</span>
            <PocMarker />
          </div>
        </Link>

        <div className="mt-7 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <nav className="grid gap-1" aria-label={t("workspace")}>
            <p className="mb-2 hidden px-3 text-[0.6875rem] font-semibold tracking-[0.12em] text-sidebar-foreground/45 uppercase lg:block">
              {t("workspace")}
            </p>
            {translatedWorkspaceItems.map((item) => (
              <DesktopNavLink key={item.view} item={item} pathname={pathname} />
            ))}
          </nav>

          <nav className="mt-6 grid gap-1 border-t border-sidebar-border pt-5" aria-label={t("manage")}>
            <p className="mb-2 hidden px-3 text-[0.6875rem] font-semibold tracking-[0.12em] text-sidebar-foreground/45 uppercase lg:block">
              {t("manage")}
            </p>
            {visibleManagementItems.map((item) => (
              <DesktopNavLink key={item.view} item={item} pathname={pathname} />
            ))}
          </nav>
        </div>

        <div className="mt-4 border-t border-sidebar-border pt-4">
          {role === "instance_owner" ? (
            <Link
              href="/system"
              className="mb-2 flex min-h-10 items-center justify-center gap-3 rounded-xl px-3 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring lg:justify-start"
              title={health?.label || t("healthChecking")}
            >
              <span className={cn("size-2 shrink-0 rounded-full", health?.status === "operational" ? "bg-success" : health?.status === "degraded" ? "bg-destructive" : "bg-sidebar-foreground/35")} />
              <span className="sr-only min-w-0 truncate text-xs lg:not-sr-only lg:inline">{health?.label || t("healthChecking")}</span>
            </Link>
          ) : null}
          <form action="/api/auth/logout" method="post">
            <button
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-11 w-full justify-center gap-3 px-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/45 lg:justify-start",
              )}
              title={t("signOut")}
              type="submit"
            >
              <LogOut className="size-[1.125rem] shrink-0" />
              <span className="sr-only lg:not-sr-only lg:inline">{t("signOut")}</span>
            </button>
          </form>

          <div
            className="mt-2 flex min-h-10 items-center justify-center gap-2 px-3 text-sidebar-foreground/50 lg:justify-start"
            title={`Sketchblock ${appVersion}`}
            aria-label={`Sketchblock ${appVersion}`}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-sidebar-primary shadow-[0_0_0_3px_color-mix(in_oklch,var(--sidebar-primary)_14%,transparent)]" />
            <Tag className="size-3.5 shrink-0 lg:hidden" />
            <span className="hidden min-w-0 truncate text-xs lg:inline">{t("localInstance")}</span>
            <span className="hidden font-mono text-[0.6875rem] text-sidebar-foreground/65 lg:inline">
              {appVersion}
            </span>
          </div>
        </div>
      </aside>

      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <nav
          data-sketchblock-mobile-navigation
          aria-label={t("mobileNavigation")}
          className="sketchblock-sidebar sketchblock-mobile-navigation fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] text-sidebar-foreground md:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
            {translatedWorkspaceItems.map((item) => (
              <MobileNavLink key={item.view} item={item} pathname={pathname} />
            ))}
            <DialogTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.6875rem] font-medium text-sidebar-foreground/65 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                    (managementActive || mobileMenuOpen) &&
                      "bg-sidebar-accent text-sidebar-accent-foreground",
                  )}
                />
              }
            >
              <Menu className={cn("size-5", managementActive && "text-sidebar-primary")} />
              <span>{t("more")}</span>
            </DialogTrigger>
          </div>
        </nav>

        <DialogContent
          showCloseButton={false}
          className="sketchblock-sidebar top-auto bottom-[calc(5rem+env(safe-area-inset-bottom))] max-h-[calc(100dvh-6.5rem)] translate-y-0 gap-5 overflow-y-auto rounded-2xl border border-sidebar-border p-4 text-sidebar-foreground ring-0 md:hidden"
        >
          <DialogHeader className="pr-10">
            <div className="flex items-center gap-3">
              <SketchblockLogo className="size-9 shrink-0" />
              <div className="min-w-0">
                <DialogTitle className="text-sidebar-foreground">Sketchblock</DialogTitle>
                <DialogDescription className="mt-1 text-sidebar-foreground/55">
                  {t("manageWorkspace")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogClose
            render={
              <button
                type="button"
                aria-label={t("closeMenu")}
                className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-xl text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              />
            }
          >
            <X className="size-5" />
          </DialogClose>

          <nav className="grid gap-1" aria-label={t("moreAreas")}>
            {visibleManagementItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(pathname, item);

              return (
                <Link
                  key={item.view}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    active && "bg-sidebar-accent text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className={cn("size-5 shrink-0", active && "text-sidebar-primary")} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border pt-4">
            <form action="/api/auth/logout" method="post">
              <button
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                type="submit"
              >
                <LogOut className="size-5 shrink-0" />
                <span>{t("signOut")}</span>
              </button>
            </form>
            <div className="mt-2 flex items-center gap-2 px-3 py-2 text-xs text-sidebar-foreground/45">
              <span className="size-1.5 rounded-full bg-sidebar-primary" />
              <span>{t("localInstance")}</span>
              <span className="font-mono text-sidebar-foreground/60">{appVersion}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

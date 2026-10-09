import { useRouterState } from "@tanstack/react-router";
import { Bell, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { activity } from "@/lib/demo-data";
import { findCrumbs } from "./nav";

export function Topbar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const crumbs = findCrumbs(path);
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
        {crumbs.map((c, i) => (
          <span key={c} className="flex items-center gap-1.5 truncate">
            {i > 0 && <span className="text-muted-foreground/60">/</span>}
            <span className={i === crumbs.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"}>{c}</span>
          </span>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search the workspace" placeholder="Search clients, receipts, pages…" className="h-9 w-72 bg-card pl-8" />
        </div>
        <Badge variant="demo" className="hidden sm:inline-flex">Demo data</Badge>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
              <Bell className="size-4" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-gold" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="border-b px-4 py-3 text-sm font-medium">Notifications</div>
            <ul className="divide-y">
              {activity.slice(0, 4).map((a) => (
                <li key={a.text} className="px-4 py-3 text-sm">
                  <p className="text-foreground">{a.text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.time}</p>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}

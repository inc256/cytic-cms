import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, ChevronsUpDown, LogOut, User } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NAV } from "./nav";

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile } = useSidebar();
  const close = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary font-display text-sm font-semibold text-primary-foreground">C</div>
          <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <div className="font-display text-sm font-semibold tracking-tight text-foreground">CYTIC <span className="font-normal text-muted-foreground">Creatives</span></div>
            <div className="truncate text-[11px] text-muted-foreground">Namielus Group workspace</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV.map((g) => {
              const Icon = g.icon;
              if (g.to) {
                return (
                  <SidebarMenuItem key={g.title}>
                    <SidebarMenuButton asChild isActive={path === g.to} tooltip={g.title}>
                      <Link to={g.to} onClick={close}>
                        <Icon />
                        <span>{g.title}</span>
                        {g.num && <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{g.num}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              }
              const active = g.sections!.some((s) => s.items.some((i) => i.to === path));
              return (
                <Collapsible key={g.title} defaultOpen={active || g.title === "Website"} className="group/collapsible" asChild>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={g.title} className={active ? "font-medium text-primary" : ""}>
                        <Icon />
                        <span>{g.title}</span>
                        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{g.num}</span>
                        <ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {g.sections!.map((s, si) => (
                          <div key={si} className={si > 0 ? "mt-2" : ""}>
                            {s.label && <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">{s.label}</div>}
                            {s.items.map((i) => (
                              <SidebarMenuSubItem key={i.to}>
                                <SidebarMenuSubButton asChild isActive={path === i.to}
                                  className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground">
                                  <Link to={i.to} onClick={close}>{i.title}</Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </div>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip="Account">
              <Avatar className="size-8 rounded-md"><AvatarFallback className="rounded-md bg-sand text-xs font-medium text-gold-foreground">AN</AvatarFallback></Avatar>
              <div className="grid text-left text-xs leading-tight">
                <span className="font-medium text-foreground">Amara Nalwoga</span>
                <span className="text-muted-foreground">Owner</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">amara@cytic.co</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link to="/settings"><User className="size-4" /> Profile & settings</Link></DropdownMenuItem>
            <DropdownMenuItem><LogOut className="size-4" /> Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

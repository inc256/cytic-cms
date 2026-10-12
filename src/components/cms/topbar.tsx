import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Download, Moon, Search, Sun } from "lucide-react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { findCrumbs } from "./nav";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function Topbar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const crumbs = findCrumbs(path);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("wpa-theme");
    const initialTheme = savedTheme === "dark" ? "dark" : "light";
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem("wpa-theme", nextTheme);
  };

  const installApp = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch (error) {
      toast.error(
        `Could not install WPA: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setInstallPrompt(null);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
        {crumbs.map((c, i) => (
          <span key={c} className="flex items-center gap-1.5 truncate">
            {i > 0 && <span className="text-muted-foreground/60">/</span>}
            <span
              className={
                i === crumbs.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"
              }
            >
              {c}
            </span>
          </span>
        ))}
      </nav>
      <div className="ml-auto hidden md:block">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search the workspace"
            placeholder="Search clients, receipts, pages…"
            className="h-9 w-72 bg-card pl-8"
          />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-1 md:ml-0">
        {installPrompt && (
          <Button variant="outline" size="sm" onClick={() => void installApp()}>
            <Download className="size-4" />
            <span className="hidden sm:inline">Install WPA</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          onClick={toggleTheme}
        >
          {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </Button>
      </div>
    </header>
  );
}

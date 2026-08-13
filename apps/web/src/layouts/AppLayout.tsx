import type {
  ReactNode,
} from "react";

import type {
  GitHubUser,
} from "@homemade-cicd/core";

import {
  Activity,
  GitBranch,
  GitFork,
  RefreshCw,
  Server,
} from "lucide-react";

import { NavLink } from "react-router";

interface AppLayoutProps {
  children: ReactNode;
  title: string;

  user:
    | GitHubUser
    | undefined;

  isRefreshing: boolean;

  onRefresh: () => void;
}

export function AppLayout({
  children,
  user,
  isRefreshing,
  title,
  onRefresh,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-800 bg-zinc-950 lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-950">
            <Activity size={20} />
          </div>

          <div>
            <div className="font-semibold tracking-tight">
              Homemade CI/CD
            </div>

            <div className="text-xs text-zinc-500">
              Personal DevOps
            </div>
          </div>
        </div>

        <nav className="space-y-1 p-4">
          <SidebarLink
            to="/projects"
            icon={<Server size={18} />}
          >
            Projects
          </SidebarLink>

          <SidebarLink
            to="/runs"
            icon={<Activity size={18} />}
          >
            Runs
          </SidebarLink>

          <SidebarLink
            to="/pipelines"
            icon={
              <GitBranch size={18} />
            }
          >
            Pipelines
          </SidebarLink>
        </nav>

        <div className="absolute bottom-0 w-full border-t border-zinc-800 p-4">
          {user ? (
            <div className="flex items-center gap-3">
              <img
                src={user.avatarUrl}
                alt=""
                className="h-9 w-9 rounded-full"
              />

              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {user.name ?? user.login}
                </div>

                <div className="truncate text-xs text-zinc-500">
                  @{user.login}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-zinc-500">
              GitHub connection...
            </div>
          )}
        </div>
      </aside>

      <main className="lg:ml-64">
        <header className="flex h-16 items-center justify-between border-b border-zinc-800 px-6 lg:px-8">
          <h1 className="font-semibold">
            {title}
          </h1>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-sm text-zinc-500 sm:flex">
              <GitFork size={17} />

              {user
                ? `Connected as ${user.login}`
                : "Connecting..."}
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex h-9 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm hover:bg-zinc-900 disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={
                  isRefreshing
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

function SidebarLink({
  to,
  icon,
  children,
}: {
  to: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
          isActive
            ? "bg-zinc-900 font-medium text-zinc-100"
            : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
        ].join(" ")
      }
    >
      {icon}
      {children}
    </NavLink>
  );
}
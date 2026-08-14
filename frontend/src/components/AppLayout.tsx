import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useLogout, useMe } from "../lib/api";

export default function AppLayout() {
  const logout = useLogout();
  const { data } = useMe();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-[var(--looply-background)]">
        <div className="mx-auto w-full px-6 py-6 lg:px-8">
          <div className="mb-4 flex items-center justify-end gap-3 text-sm">
            <span className="text-neutral-500">{data?.user?.name}</span>
            <button
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
            >
              Sair
            </button>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

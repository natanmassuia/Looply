import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useLogout, useMe } from "../lib/api";

export default function AppLayout() {
  const logout = useLogout();
  const { data } = useMe();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-[var(--looply-color-bg-canvas)]">
        <div className="mx-auto w-full px-6 py-6 lg:px-8">
          <div className="mb-4 flex items-center justify-end gap-3 text-sm">
            <span className="text-[var(--looply-color-text-muted)]">{data?.user?.name}</span>
            <button
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="btn-secondary btn-sm"
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

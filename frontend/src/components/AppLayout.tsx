import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-[var(--looply-background)]">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

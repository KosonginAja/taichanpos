"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Database, Coffee, ShoppingBag, BarChart3, LogOut, User, Menu, X, Settings, Wallet, Landmark, TrendingUp, PieChart } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    // Fetch user info
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          router.push("/login");
        }
      } catch (err) {
        router.push("/login");
      }
    };
    fetchUser();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const navGroups = [
    {
      label: "Operasional",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: Home },
        { name: "POS / Kasir", href: "/dashboard/orders", icon: ShoppingBag },
        { name: "Gudang Bahan Baku", href: "/dashboard/ingredients", icon: Database },
        { name: "Produk & HPP", href: "/dashboard/products", icon: Coffee },
      ],
    },
    {
      label: "Keuangan",
      adminOnly: true,
      items: [
        { name: "Arus Kas", href: "/dashboard/cash", icon: Wallet },
        { name: "Kantong Kas", href: "/dashboard/pockets", icon: PieChart },
        { name: "Laba Rugi", href: "/dashboard/profit-loss", icon: TrendingUp },
        { name: "Riwayat Alokasi Laba", href: "/dashboard/profit-allocations", icon: BarChart3 },
      ],
    },
    {
      label: "Laporan",
      adminOnly: true,
      items: [
        { name: "Laporan & Ekspor", href: "/dashboard/reports", icon: BarChart3 },
        { name: "Lap. Arus Kas", href: "/dashboard/cashflow", icon: Landmark },
      ],
    },
    {
      label: "Sistem",
      adminOnly: true,
      items: [
        { name: "Pengaturan", href: "/dashboard/settings", icon: Settings },
      ],
    },
  ];

  const filteredNavGroups = navGroups.filter(
    (group) => !group.adminOnly || (user && user.role === "admin")
  );

  return (
    <div className="h-screen overflow-hidden flex bg-slate-50 font-sans text-slate-900">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-white border-r border-slate-200 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <Link href="/dashboard" className="text-xl font-bold text-orange-500">
            Gweh Food POS
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {filteredNavGroups.map((group) => (
            <div key={group.label} className="mb-6 last:mb-0">
              <h3 className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                {group.label}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? "bg-orange-500 text-white shadow-lg shadow-indigo-600/10"
                          : "text-slate-500 hover:bg-slate-100/60 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/40">
          <div className="flex items-center gap-3 p-2">
            <div className="w-10 h-10 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 font-bold shrink-0 uppercase">
              {user ? user.name.charAt(0) : <User className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{user ? user.name : "Loading..."}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  user?.role === "admin" ? "bg-orange-100 border border-orange-200 text-orange-600" : "bg-slate-100 border border-slate-200 text-slate-600"
                }`}>
                  {user ? user.role : "role"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-red-950/20 hover:border-red-950 text-slate-500 hover:text-red-400 text-sm font-medium transition-all"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar overlay & drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-slate-50/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}>
          <div
            className="w-72 max-w-[80vw] h-full bg-white border-r border-slate-200 flex flex-col p-4 animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between h-12 border-b border-slate-200 mb-6">
              <span className="text-lg font-bold text-orange-500">
                Gweh Food POS
              </span>
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg border border-slate-200 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1.5 overflow-y-auto">
              {filteredNavGroups.map((group) => (
                <div key={group.label} className="mb-6 last:mb-0">
                  <h3 className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {group.label}
                  </h3>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            isActive
                              ? "bg-orange-500 text-white shadow-lg shadow-indigo-600/10"
                              : "text-slate-500 hover:bg-slate-100/60 hover:text-slate-900"
                          }`}
                        >
                          <Icon className="w-5 h-5 shrink-0" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-slate-200 pt-4 bg-white">
              <div className="flex items-center gap-3 p-2 mb-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 font-bold shrink-0 uppercase">
                  {user ? user.name.charAt(0) : <User className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{user ? user.name : "Loading..."}</p>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-0.5 ${
                    user?.role === "admin" ? "bg-orange-100 border border-orange-200 text-orange-600" : "bg-slate-100 border border-slate-200 text-slate-600"
                  }`}>
                    {user ? user.role : "role"}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-red-950/20 hover:border-red-950 text-slate-500 hover:text-red-400 text-sm font-medium transition-all"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="h-16 flex items-center justify-between px-4 border-b border-slate-200 md:hidden bg-white shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 border border-slate-200 rounded-xl text-slate-500"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-md font-semibold text-slate-800">
            {navGroups.flatMap(g => g.items).find((n) => pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href)))?.name || "Gweh Food POS"}
          </span>
          <div className="w-9 h-9 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 font-bold shrink-0 uppercase text-xs">
            {user ? user.name.charAt(0) : "U"}
          </div>
        </header>

        {/* Content Panel */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

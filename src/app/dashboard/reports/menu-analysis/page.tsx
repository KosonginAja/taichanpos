"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  TrendingUp,
  Download,
  Calendar,
  Loader2,
  LineChart,
  Award,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MenuAnalysisPage() {
  const { data: userSession } = useSWR("/api/auth/me", fetcher);
  const isAdmin = userSession?.user?.role === "admin";

  const today = new Date().toISOString().split("T")[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today);

  const { data, error, isLoading } = useSWR(
    isAdmin && startDate && endDate
      ? `/api/reports/menu-analysis?startDate=${startDate}&endDate=${endDate}`
      : null,
    fetcher
  );

  const fmt = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(val);

  const exportCSV = () => {
    if (!data || data.length === 0) return;
    
    // CSV headers
    const headers = [
      "Nama Produk",
      "Harga Jual",
      "Qty Terjual",
      "Total Omzet",
      "Margin per Unit",
      "Total Kontribusi Profit",
      "Status Performa",
    ];

    const rows = data.map((item: any) => [
      item.name,
      item.sellPrice,
      item.qtySold,
      item.totalRevenue,
      item.marginPerUnit.toFixed(2),
      item.profitContribution,
      item.badge,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Analisis_Menu_${startDate}_to_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAdmin && userSession) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Anda tidak memiliki akses ke halaman ini.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <LineChart className="w-6 h-6 text-orange-500" />
            Analisis Menu & Kontribusi Profit
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Peringkat produk terlaris beserta margin dan kontribusi laba kotor terhadap usaha
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 px-2 border-r border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs bg-transparent text-slate-600 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 px-2">
            <span className="text-slate-500 text-xs">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs bg-transparent text-slate-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 text-red-400 border border-red-500/20 p-4 rounded-2xl">
          Gagal memuat data analisis menu.
        </div>
      )}

      {data && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Action buttons */}
          <div className="flex justify-end">
            <button
              onClick={exportCSV}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-orange-500/15"
            >
              <Download className="w-4 h-4" /> Ekspor ke CSV
            </button>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">No.</th>
                    <th className="px-6 py-4">Nama Produk</th>
                    <th className="px-6 py-4">Harga Jual</th>
                    <th className="px-6 py-4 text-center">Qty Terjual</th>
                    <th className="px-6 py-4">Total Omzet</th>
                    <th className="px-6 py-4">Margin / Porsi</th>
                    <th className="px-6 py-4">Kontribusi Profit</th>
                    <th className="px-6 py-4 text-center">Performa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.map((item: any, index: number) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/40 transition-all text-slate-700"
                    >
                      <td className="px-6 py-4.5 font-medium text-slate-400">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4.5 font-semibold text-slate-900">
                        {item.name}
                      </td>
                      <td className="px-6 py-4.5">{fmt(item.sellPrice)}</td>
                      <td className="px-6 py-4.5 text-center font-bold text-slate-800">
                        {item.qtySold}
                      </td>
                      <td className="px-6 py-4.5 font-semibold text-slate-900">
                        {fmt(item.totalRevenue)}
                      </td>
                      <td className="px-6 py-4.5 text-slate-600">
                        {fmt(item.marginPerUnit)}
                      </td>
                      <td className="px-6 py-4.5 font-bold text-emerald-600">
                        {fmt(item.profitContribution)}
                      </td>
                      <td className="px-6 py-4.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                            item.badge === "Best Seller"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                              : item.badge === "Kurang Laris"
                              ? "bg-amber-50 text-amber-600 border-amber-200"
                              : "bg-rose-50 text-rose-600 border-rose-200"
                          }`}
                        >
                          {item.badge === "Best Seller" && (
                            <Award className="w-3 h-3" />
                          )}
                          {item.badge === "Kurang Laris" && (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {item.badge === "Tidak Laku" && (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {item.badge}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-12 text-center text-slate-500 italic"
                      >
                        Tidak ada transaksi penjualan pada rentang tanggal ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

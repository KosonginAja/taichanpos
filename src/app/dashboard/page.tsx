"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  ArrowRight,
  Loader2,
  RefreshCw,
  Download,
  FileText,
} from "lucide-react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import jsPDF from "jspdf";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardPage() {
  const { data, error, mutate, isValidating } = useSWR("/api/reports/dashboard", fetcher);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500 gap-4">
        <p>Gagal memuat data dashboard.</p>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl hover:bg-white text-slate-800 transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Coba Lagi
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-500 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
        <span>Memuat metrik dashboard...</span>
      </div>
    );
  }

  const { summary, lowStockIngredients, lowStockProducts, recentOrders, chartData } = data;

  const downloadDailyPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    const todayStr = new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const revenue = parseFloat(summary.revenueToday || 0);
    const profit = parseFloat(summary.profitToday || 0);
    const hpp = revenue - profit;
    const expenses = parseFloat(summary.expensesToday || 0);
    const netProfit = profit - expenses;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("LAPORAN RINGKASAN HARIAN", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Tanggal Laporan: ${todayStr}`, 14, 27);
    doc.line(14, 31, 196, 31);

    let y = 42;
    const renderRow = (title: string, value: string, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(title, 14, y);
      doc.text(value, 196, y, { align: "right" });
      y += 8;
    };

    renderRow("Jumlah Pesanan Sukses", summary.totalOrdersToday.toString());
    renderRow("Total Omzet Kotor (Revenue)", formatRupiah(revenue));
    renderRow("Total Bahan Baku (HPP)", `- ${formatRupiah(hpp)}`);
    doc.line(14, y - 4, 196, y - 4);
    renderRow("Laba Kotor (Gross Profit)", formatRupiah(profit), true);
    y += 2;

    renderRow("Beban Operasional", "");
    if (data.expensesByCategoryToday && Object.keys(data.expensesByCategoryToday).length > 0) {
      Object.entries(data.expensesByCategoryToday).forEach(([cat, amt]) => {
        renderRow(`  - ${cat}`, `- ${formatRupiah(amt as number)}`);
      });
    } else {
      renderRow("  - Tidak ada pengeluaran hari ini", formatRupiah(0));
    }
    doc.line(14, y - 4, 196, y - 4);
    renderRow("Total Beban Operasional", `- ${formatRupiah(expenses)}`, true);
    
    y += 2;
    doc.setLineWidth(0.5);
    doc.line(14, y - 4, 196, y - 4);
    renderRow("LABA BERSIH HARIAN", formatRupiah(netProfit), true);
    doc.line(14, y - 4, 196, y - 4);

    y += 15;
    doc.text("Laporan ini diunduh secara otomatis dari sistem POS Taralaya.", 14, y);
    y += 15;
    doc.text("Disiapkan Oleh:", 14, y);
    doc.text("Diverifikasi Oleh:", 140, y);
    y += 20;
    doc.text("_______________________", 14, y);
    doc.text("_______________________", 140, y);

    const fileDate = new Date().toISOString().split("T")[0];
    doc.save(`Laporan_Harian_${fileDate}.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ikhtisar Usaha</h1>
          <p className="text-slate-500 mt-1">Laporan penjualan dan ketersediaan stok hari ini</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={downloadDailyPDF}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-orange-500/15"
          >
            <FileText className="w-4 h-4" /> Unduh PDF Harian
          </button>
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-800 hover:text-slate-900 text-sm font-semibold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? "animate-spin" : ""}`} />
            Segarkan Data
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Omzet Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full transition-all group-hover:scale-110" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Omzet Hari Ini</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-950/60 border border-indigo-900/60 flex items-center justify-center text-orange-500">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900 truncate">{formatRupiah(summary.revenueToday)}</h3>
            <p className="text-xs text-orange-500 mt-1 font-medium">Semua pesanan lunas</p>
          </div>
        </div>

        {/* Profit Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full transition-all group-hover:scale-110" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Profit Hari Ini</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-900/60 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900 truncate">{formatRupiah(summary.profitToday)}</h3>
            <p className="text-xs text-emerald-400 mt-1 font-medium">Setelah dikurangi HPP</p>
          </div>
        </div>

        {/* Orders Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full transition-all group-hover:scale-110" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Pesanan Hari Ini</span>
            <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-900/60 flex items-center justify-center text-amber-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900">{summary.totalOrdersToday}</h3>
            <p className="text-xs text-amber-400 mt-1 font-medium">Pesanan diproses</p>
          </div>
        </div>

        {/* Low Stock Gudang Warning Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full transition-all group-hover:scale-110" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Bahan Baku Kritis</span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              summary.lowStockCount > 0
                ? "bg-rose-950/60 border-rose-900/60 text-rose-400"
                : "bg-slate-50/60 border-slate-200 text-slate-500"
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900">{summary.lowStockCount}</h3>
            <p className={`text-xs mt-1 font-medium ${summary.lowStockCount > 0 ? "text-rose-400" : "text-slate-500"}`}>
              {summary.lowStockCount > 0 ? "Bahan perlu diisi ulang" : "Gudang bahan aman"}
            </p>
          </div>
        </div>

        {/* Low Stock Produk Warning Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full transition-all group-hover:scale-110" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Stok Produk Kritis</span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              (summary.lowStockProductCount || 0) > 0
                ? "bg-amber-950/60 border-amber-900/60 text-amber-400"
                : "bg-slate-50/60 border-slate-200 text-slate-500"
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900">{summary.lowStockProductCount || 0}</h3>
            <p className={`text-xs mt-1 font-medium ${(summary.lowStockProductCount || 0) > 0 ? "text-amber-400" : "text-slate-500"}`}>
              {(summary.lowStockProductCount || 0) > 0 ? "Perlu segera diproduksi" : "Stok produk cukup"}
            </p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Grafik Kinerja Penjualan (30 Hari Terakhir)</h3>
        <div className="w-full h-80">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(val) => `Rp ${val / 1000}k`}
                />
                <Tooltip
                  formatter={(value: any) => [formatRupiah(value), ""]}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "12px",
                    color: "#f1f5f9",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Omzet"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Profit Bersih"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              Loading Chart...
            </div>
          )}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Low Stock Alerts */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Bahan Baku Menipis / Habis</h3>
            <Link
              href="/dashboard/ingredients"
              className="text-xs font-semibold text-orange-500 hover:text-indigo-300 flex items-center gap-1 hover:underline"
            >
              Kelola Gudang <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto max-h-60 space-y-4">
            {lowStockIngredients.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-8">
                <CheckCircleComponent />
                <span className="text-sm mt-3">Semua bahan baku tercukupi!</span>
              </div>
            ) : (
              lowStockIngredients.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-slate-50/40 border border-slate-200/80 rounded-xl"
                >
                  <div>
                    <h4 className="font-semibold text-slate-800">{item.name}</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Min. Stok: {item.minStock} {item.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${
                      item.status === "Habis"
                        ? "bg-rose-950/60 border border-rose-950 text-rose-400"
                        : "bg-amber-950/60 border border-amber-950 text-amber-400"
                    }`}>
                      {item.stock.toFixed(2)} {item.unit} ({item.status})
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Transaksi Terbaru</h3>
            <Link
              href="/dashboard/orders"
              className="text-xs font-semibold text-orange-500 hover:text-indigo-300 flex items-center gap-1 hover:underline"
            >
              Kasir & Riwayat <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto max-h-60 space-y-4">
            {recentOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-8">
                <ShoppingCart className="w-8 h-8 text-slate-700" />
                <span className="text-sm mt-3">Belum ada transaksi hari ini.</span>
              </div>
            ) : (
              recentOrders.map((order: any) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 bg-slate-50/40 border border-slate-200/80 rounded-xl"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{order.orderNumber}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        order.status === "paid"
                          ? "bg-emerald-950 border border-emerald-900 text-emerald-400"
                          : "bg-red-950 border border-red-900 text-red-400"
                      }`}>
                        {order.status === "paid" ? "Paid" : "Cancelled"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {order.customerName ? `Pelanggan: ${order.customerName}` : "Pelanggan Umum"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-800 block">{formatRupiah(order.revenueTotal)}</span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(order.date).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckCircleComponent() {
  return (
    <svg
      className="w-8 h-8 text-emerald-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
  CheckCircle,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ReportsPage() {
  const { data: userSession } = useSWR("/api/auth/me", fetcher);
  const isAdmin = userSession?.user?.role === "admin";
  const { data: usersList, mutate: mutateUsers } = useSWR(isAdmin ? "/api/users" : null, fetcher);

  const [userLoading, setUserLoading] = useState(false);

  const handleApproveUser = async (userId: number) => {
    setUserLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/users/${userId}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyetujui user");
      setSuccessMsg("Akun berhasil disetujui.");
      mutateUsers();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyetujui user.");
    } finally {
      setUserLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Hapus pendaftaran akun ${userName}?`)) return;
    setUserLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/users/${userId}/approve`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus user");
      setSuccessMsg("Akun berhasil dihapus.");
      mutateUsers();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menghapus user.");
    } finally {
      setUserLoading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);
  };

  // Helper function to convert JSON to PDF and trigger download
  const downloadPDF = (filename: string, headers: string[], rows: any[], title: string) => {
    const doc = new jsPDF("landscape");
    
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 22);

    const tableData = rows.map((row) =>
      headers.map((header) => {
        const val = row[header];
        // Auto format currency for known financial columns
        if (
          typeof val === "number" &&
          (header.toLowerCase().includes("revenue") ||
            header.toLowerCase().includes("hpp") ||
            header.toLowerCase().includes("profit") ||
            header.toLowerCase().includes("price") ||
            header.toLowerCase().includes("subtotal") ||
            header.toLowerCase().includes("discount"))
        ) {
          return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);
        }
        return val === null || val === undefined ? "-" : String(val);
      })
    );

    // Make headers readable
    const formattedHeaders = headers.map(h => 
      h.charAt(0).toUpperCase() + h.slice(1).replace(/([A-Z])/g, ' $1').trim()
    );

    // Calculate totals for footer
    const footerData = headers.map((header, idx) => {
      if (idx === 0) return "TOTAL KESELURUHAN";
      
      // Check if this column is numeric across all rows
      const isNumericColumn = rows.every((row) => typeof row[header] === "number" || row[header] === null || row[header] === undefined);
      
      if (isNumericColumn) {
        const sum = rows.reduce((acc, row) => acc + (typeof row[header] === "number" ? row[header] : 0), 0);
        
        // Auto format currency for known financial columns
        if (
          header.toLowerCase().includes("revenue") ||
          header.toLowerCase().includes("hpp") ||
          header.toLowerCase().includes("profit") ||
          header.toLowerCase().includes("price") ||
          header.toLowerCase().includes("subtotal") ||
          header.toLowerCase().includes("discount")
        ) {
          return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(sum);
        }
        return sum.toLocaleString('id-ID'); // For qty / count
      }
      return "-";
    });

    autoTable(doc, {
      head: [formattedHeaders],
      body: tableData,
      foot: [footerData],
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [79, 70, 229] }, // Indigo-600 to match theme
      footStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: 'bold' } // slate-200 background for footer
    });

    doc.save(`${filename}.pdf`);
  };

  const handleExport = async (type: "summary" | "orders" | "items") => {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/reports/export?startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gagal mengunduh laporan.");

      const filePrefix = `Laporan_${startDate}_to_${endDate}`;

      if (type === "summary") {
        const headers = ["date", "ordersCount", "revenue", "hpp", "profit"];
        downloadPDF(`${filePrefix}_Ringkasan_Harian`, headers, data.dailySummary, "Ringkasan Laporan Harian");
      } else if (type === "orders") {
        const headers = [
          "orderNumber",
          "date",
          "customerName",
          "cashierName",
          "paymentMethod",
          "status",
          "subtotal",
          "discount",
          "revenueTotal",
          "hppTotal",
          "profitTotal",
        ];
        downloadPDF(`${filePrefix}_Daftar_Pesanan`, headers, data.ordersList, "Laporan Daftar Pesanan (Transaksi)");
      } else if (type === "items") {
        const headers = ["orderNumber", "date", "productName", "qty", "sellPrice", "hppPerUnit", "revenueTotal", "hppTotal"];
        downloadPDF(`${filePrefix}_Detail_Item`, headers, data.itemsList, "Laporan Detail Produk Terjual");
      }

      setSuccessMsg("Laporan PDF berhasil diunduh.");
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengekspor data.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500 gap-4">
        <AlertTriangle className="w-12 h-12 text-rose-500" />
        <p className="font-semibold text-lg text-slate-800">Akses Ditolak</p>
        <p className="text-sm max-w-sm text-center">
          Halaman Laporan Laba Rugi dan Ekspor data PDF hanya dapat diakses oleh Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Laporan & Ekspor Data</h1>
        <p className="text-slate-500 mt-1">Ekspor laporan penjualan, analisis HPP, dan profitabilitas usaha makanan</p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" /> <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" /> <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Export Form Pane */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-500" /> Rentang Tanggal
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Mulai Tanggal</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Hingga Tanggal</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="p-3.5 bg-indigo-950/20 border border-indigo-900 rounded-xl text-indigo-300 text-xs leading-relaxed">
            Data akan diekspor dalam format **Comma-Separated Values (.csv)** yang dapat dibuka di Microsoft Excel, Google Sheets, atau aplikasi sejenis.
          </div>
        </div>

        {/* Downloadable sheets */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-orange-500" /> Lembar Kerja Ekspor
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Sheet 1: Ringkasan Laba Rugi */}
            <div className="bg-slate-50/40 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-slate-800 text-sm">1. Ringkasan Harian</h4>
                <p className="text-xs text-slate-500 mt-2">
                  Laporan rekap laba rugi, omzet, dan total HPP yang diakumulasikan per tanggal transaksi.
                </p>
              </div>
              <button
                onClick={() => handleExport("summary")}
                disabled={loading}
                className="mt-6 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Unduh Rekap Harian
              </button>
            </div>

            {/* Sheet 2: Daftar Transaksi */}
            <div className="bg-slate-50/40 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-slate-800 text-sm">2. Daftar Transaksi</h4>
                <p className="text-xs text-slate-500 mt-2">
                  Rincian seluruh struk/invoice pesanan, termasuk nama pelanggan, kasir, diskon, omzet, HPP, profit, dan metode bayar.
                </p>
              </div>
              <button
                onClick={() => handleExport("orders")}
                disabled={loading}
                className="mt-6 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Unduh List Pesanan
              </button>
            </div>

            {/* Sheet 3: Rincian Produk Terjual */}
            <div className="bg-slate-50/40 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-slate-800 text-sm">3. Detail Penjualan Item</h4>
                <p className="text-xs text-slate-500 mt-2">
                  Rincian per item produk yang terjual per struk transaksi, snapshot HPP, dan pendapatan kotor per produk.
                </p>
              </div>
              <button
                onClick={() => handleExport("items")}
                disabled={loading}
                className="mt-6 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Unduh Detail Item
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* User Management Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-500" /> Persetujuan Akun Kasir Baru
        </h3>

        {!usersList ? (
          <div className="flex justify-center py-8 text-slate-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Memuat daftar akun...</span>
          </div>
        ) : usersList.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            Tidak ada pendaftaran akun kasir/admin lain.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs uppercase tracking-wider text-slate-500 bg-slate-50/40">
                <tr>
                  <th className="px-6 py-4 rounded-l-xl">Nama Lengkap</th>
                  <th className="px-6 py-4">Username</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Peran (Role)</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Tanggal Daftar</th>
                  <th className="px-6 py-4 text-right rounded-r-xl">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {usersList.map((usr: any) => (
                  <tr key={usr.id} className="hover:bg-slate-50/20 transition-all">
                    <td className="px-6 py-4 font-medium text-slate-800">{usr.name}</td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">@{usr.username}</td>
                    <td className="px-6 py-4">{usr.email}</td>
                    <td className="px-6 py-4 uppercase text-xs">{usr.role}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        usr.isApproved
                          ? "bg-emerald-950 border border-emerald-900 text-emerald-400"
                          : "bg-amber-950 border border-amber-900 text-amber-400"
                      }`}>
                        {usr.isApproved ? "Aktif" : "Menunggu Persetujuan"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(usr.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {!usr.isApproved && (
                        <button
                          onClick={() => handleApproveUser(usr.id)}
                          disabled={userLoading}
                          className="px-3 py-1 bg-orange-500 border border-indigo-900 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Setujui
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteUser(usr.id, usr.name)}
                        disabled={userLoading}
                        className="px-3 py-1 bg-slate-50 border border-slate-200 hover:bg-rose-950/30 text-rose-450 hover:text-rose-450 rounded-lg text-xs font-bold transition-all disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

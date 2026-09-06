"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  TrendingUp,
  Download,
  Calendar,
  Loader2,
  Percent,
  FileText,
  Printer,
  ChevronDown,
  Wallet,
  ShieldCheck,
  CreditCard,
  Banknote,
  DollarSign,
  PieChart,
} from "lucide-react";
import jsPDF from "jspdf";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MonthlyDistributionPage() {
  const { data: userSession } = useSWR("/api/auth/me", fetcher);
  const isAdmin = userSession?.user?.role === "admin";

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-indexed

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const getMonthDateRange = (year: number, month: number) => {
    const start = new Date(year, month - 1, 1);
    const startStr = start.toISOString().split("T")[0];
    const end = new Date(year, month, 0); // Last day of month
    const endStr = end.toISOString().split("T")[0];
    return { startStr, endStr };
  };

  const { startStr, endStr } = getMonthDateRange(selectedYear, selectedMonth);

  const { data, error, isLoading } = useSWR(
    isAdmin
      ? `/api/reports/profit-loss?startDate=${startStr}&endDate=${endStr}`
      : null,
    fetcher
  );

  const { data: pockets } = useSWR(isAdmin ? "/api/pocket-summary" : null, fetcher);

  const fmt = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(val);

  const months = [
    { value: 1, label: "Januari" },
    { value: 2, label: "Februari" },
    { value: 3, label: "Maret" },
    { value: 4, label: "April" },
    { value: 5, label: "Mei" },
    { value: 6, label: "Juni" },
    { value: 7, label: "Juli" },
    { value: 8, label: "Agustus" },
    { value: 9, label: "September" },
    { value: 10, label: "Oktober" },
    { value: 11, label: "November" },
    { value: 12, label: "Desember" },
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const getMonthLabel = (m: number) => months.find((x) => x.value === m)?.label || "";

  // Dynamic profit share stakeholders from cash_pockets
  const activeProfitPockets = (pockets || []).filter(
    (p: any) => p.type === "profit_share" && p.isActive
  );

  // Fallback if no custom profit pockets configured
  const defaultDistributions = [
    { label: "PIHAK PERTAMA (Investor)", percentage: 40 },
    { label: "PIHAK KEDUA (Operator / Pengelola)", percentage: 40 },
    { label: "Dana Cadangan Operasional", percentage: 10 },
    { label: "Dana Insentif / Bonus / Kas Usaha", percentage: 10 },
  ];

  const stakeholders =
    activeProfitPockets.length > 0
      ? activeProfitPockets.map((p: any) => ({
          label: p.label,
          percentage: p.percentage || 0,
          balance: p.balance || 0,
        }))
      : defaultDistributions;

  const downloadPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    const netProfit = data.summary.netProfit;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("LAPORAN DISTRIBUSI BULANAN & BAGI HASIL", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Periode Bulan: ${getMonthLabel(selectedMonth)} ${selectedYear}`, 14, 27);
    doc.text(`Rentang Tanggal: ${startStr} s/d ${endStr}`, 14, 32);
    doc.line(14, 36, 196, 36);

    let y = 45;
    const renderRow = (title: string, value: string, bold = false, indent = 0) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(" ".repeat(indent) + title, 14, y);
      doc.text(value, 196, y, { align: "right" });
      y += 7.5;
    };

    // A. Revenue
    renderRow("A. OMZET KOTOR (PENJUALAN)", fmt(data.summary.grossRevenue), true);
    if (data.summary.cashRevenue !== undefined && data.summary.nonCashRevenue !== undefined) {
      renderRow(`- Penerimaan Kas Tunai`, fmt(data.summary.cashRevenue), false, 2);
      renderRow(`- Penerimaan Non-Tunai (QRIS/Transfer Bank)`, fmt(data.summary.nonCashRevenue), false, 2);
    }
    y += 2;

    // B. Operating Expenses
    renderRow("B. BIAYA OPERASIONAL & HPP", "", true);
    renderRow("Bahan Baku (HPP Terkonsumsi)", `- ${fmt(data.summary.totalHpp)}`, false, 2);

    Object.entries(data.expensesByCategory).forEach(([cat, amt]) => {
      renderRow(`${cat}`, `- ${fmt(amt as number)}`, false, 2);
    });

    doc.line(14, y - 3, 196, y - 3);
    const totalOps = data.summary.totalHpp + data.summary.totalExpenses;
    renderRow("Total Biaya Operasional", `- ${fmt(totalOps)}`, true);

    if (data.summary.totalRoundingAdjustment !== 0) {
      renderRow(
        "Selisih Pembulatan POS",
        (data.summary.totalRoundingAdjustment > 0 ? "+ " : "") +
          fmt(data.summary.totalRoundingAdjustment),
        false
      );
    }

    y += 2;
    doc.setLineWidth(0.5);
    doc.line(14, y - 3, 196, y - 3);

    // C. Net Profit
    renderRow("C. LABA BERSIH (NET PROFIT)", fmt(netProfit), true);

    y += 3;
    doc.line(14, y - 3, 196, y - 3);

    // D. Profit Distribution to Stakeholders
    renderRow("D. DISTRIBUSI HAK LABA BERSIH", "", true);
    stakeholders.forEach((sh: any) => {
      const share = (netProfit * sh.percentage) / 100;
      renderRow(`${sh.label} (${sh.percentage}%)`, fmt(share), false, 2);
    });

    y += 12;
    doc.setFontSize(9);
    doc.text("Laporan ini dibuat otomatis secara transparan dari data transaksi kasir dan mutasi operasional.", 14, y);
    y += 12;

    // Signatures
    doc.setFont("helvetica", "normal");
    doc.text("Pihak Pertama (Investor)", 20, y);
    doc.text("Pihak Kedua (Pengelola/Operator)", 125, y);
    y += 22;
    doc.text("_______________________", 20, y);
    doc.text("_______________________", 125, y);

    doc.save(`Laporan_Distribusi_${getMonthLabel(selectedMonth)}_${selectedYear}.pdf`);
  };

  if (!isAdmin && userSession) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Anda tidak memiliki akses ke halaman ini.
      </div>
    );
  }

  const netProfit = data?.summary?.netProfit ?? 0;
  const totalOps = (data?.summary?.totalHpp ?? 0) + (data?.summary?.totalExpenses ?? 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Percent className="w-6 h-6 text-orange-500" />
              Laporan Distribusi & Bagi Hasil
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Transparan
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            Format laporan laba bersih & pembagian profit transparan untuk internal dan investor
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="text-xs bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="text-xs bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer border-l pl-2 border-slate-200"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 text-red-500 border border-red-500/20 p-4 rounded-2xl">
          Gagal memuat laporan distribusi bulanan.
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Quick Actions Bar */}
          <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                Data terverifikasi dari <b>{data.summary.totalOrders || 0}</b> pesanan lunas
              </span>
            </div>

            <button
              onClick={downloadPDF}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-orange-500/15"
            >
              <Printer className="w-4 h-4" /> Cetak & Unduh PDF Resmi
            </button>
          </div>

          {/* Report Sheet Layout */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="text-center border-b pb-6 border-slate-100">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full inline-block mb-2">
                Dokumen Laporan Keuangan
              </span>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                LAPORAN DISTRIBUSI BAGI HASIL
              </h2>
              <p className="text-slate-500 text-xs mt-1 uppercase tracking-wider font-medium">
                Periode: {getMonthLabel(selectedMonth)} {selectedYear} ({startStr} s/d {endStr})
              </p>
            </div>

            <div className="mt-8 space-y-6 text-slate-700">
              {/* Section A: Revenue */}
              <div className="space-y-2 pb-4 border-b border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">A. OMZET KOTOR (PENJUALAN)</span>
                  <span className="font-black text-slate-900 text-lg">{fmt(data.summary.grossRevenue)}</span>
                </div>

                {data.summary.cashRevenue !== undefined && data.summary.nonCashRevenue !== undefined && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Kas Tunai
                      </span>
                      <span className="font-bold text-slate-700">{fmt(data.summary.cashRevenue)}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Non-Tunai (QRIS/Transfer)
                      </span>
                      <span className="font-bold text-slate-700">{fmt(data.summary.nonCashRevenue)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Section B: Operating Expenses */}
              <div className="space-y-3 pb-4 border-b border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">B. BIAYA OPERASIONAL & HPP</span>
                </div>
                <div className="space-y-2 pl-4 border-l-2 border-slate-100 text-xs sm:text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Bahan Baku (HPP Terkonsumsi)</span>
                    <span className="font-semibold text-rose-600">- {fmt(data.summary.totalHpp)}</span>
                  </div>
                  {Object.entries(data.expensesByCategory).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between items-center">
                      <span className="text-slate-600">{cat}</span>
                      <span className="font-semibold text-rose-600">- {fmt(amt as number)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-2 text-sm border-t border-slate-100 border-dashed">
                  <span className="font-bold text-slate-700">Total Biaya Operasional</span>
                  <span className="font-black text-rose-600">- {fmt(totalOps)}</span>
                </div>
              </div>

              {/* Rounding Adjustment if exists */}
              {data.summary.totalRoundingAdjustment !== 0 && (
                <div className="flex justify-between items-center py-2 text-xs text-slate-500 border-b border-slate-100">
                  <span>Selisih Pembulatan POS</span>
                  <span className={data.summary.totalRoundingAdjustment > 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                    {data.summary.totalRoundingAdjustment > 0 ? "+ " : ""}{fmt(data.summary.totalRoundingAdjustment)}
                  </span>
                </div>
              )}

              {/* Section C: Net Profit */}
              <div className="flex justify-between items-center py-4 border-y-2 border-slate-200 bg-slate-50 px-5 rounded-2xl">
                <div>
                  <span className="font-black text-slate-900 text-base block">C. LABA BERSIH (NET PROFIT)</span>
                  <span className="text-[11px] text-slate-500">Dasar penghitungan pembagian hasil</span>
                </div>
                <span className={`font-black text-2xl font-mono ${netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {fmt(netProfit)}
                </span>
              </div>

              {/* Section D: Investor & Stakeholder Distribution */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">D. DISTRIBUSI HAK LABA BERSIH</span>
                    <p className="text-[11px] text-slate-500">
                      Berdasarkan aturan bagi hasil aktif yang terkonfigurasi di sistem
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {stakeholders.map((sh: any, index: number) => {
                    const shareAmount = (netProfit * sh.percentage) / 100;
                    return (
                      <div
                        key={index}
                        className="bg-orange-50/50 border border-orange-200/70 rounded-2xl p-4 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                              {sh.label}
                            </span>
                            <span className="text-xs font-black text-orange-600 px-2 py-0.5 rounded-full bg-orange-100 border border-orange-200">
                              {sh.percentage}%
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">Hak Bagi Hasil Periode Ini:</p>
                          <p className="text-xl font-black text-orange-600 mt-0.5 font-mono">
                            {fmt(shareAmount)}
                          </p>
                        </div>

                        {sh.balance !== undefined && (
                          <div className="mt-3 pt-2 border-t border-orange-200/50 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Saldo Kas Terkumpul:</span>
                            <span className="font-mono font-bold text-slate-700">{fmt(sh.balance)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Signature Area */}
            <div className="mt-14 pt-8 border-t border-slate-200 grid grid-cols-2 gap-4 text-center text-xs text-slate-500">
              <div className="space-y-16">
                <p className="font-medium">Pihak Pertama (Investor)</p>
                <p className="font-bold text-slate-800 underline">_______________________</p>
              </div>
              <div className="space-y-16">
                <p className="font-medium">Pihak Kedua (Pengelola / Operator)</p>
                <p className="font-bold text-slate-800 underline">_______________________</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

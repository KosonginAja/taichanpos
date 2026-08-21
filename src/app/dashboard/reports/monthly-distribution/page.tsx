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

  const downloadPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    const netProfit = data.summary.netProfit;
    const p1 = netProfit * 0.40;
    const p2 = netProfit * 0.40;
    const reserve = netProfit * 0.10;
    const incentive = netProfit * 0.10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("LAPORAN DISTRIBUSI BULANAN (SATELITE)", 14, 20);
    
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
      y += 8;
    };

    renderRow("A. OMZET KOTOR (PENJUALAN)", fmt(data.summary.grossRevenue), true);
    y += 2;

    renderRow("B. BIAYA OPERASIONAL", "", true);
    renderRow("Bahan Baku (HPP)", `- ${fmt(data.summary.totalHpp)}`, false, 2);
    
    // Sort and output other expenses
    Object.entries(data.expensesByCategory).forEach(([cat, amt]) => {
      renderRow(`${cat}`, `- ${fmt(amt as number)}`, false, 2);
    });

    doc.line(14, y - 4, 196, y - 4);
    const totalOps = data.summary.totalHpp + data.summary.totalExpenses;
    renderRow("Total Biaya Operasional", `- ${fmt(totalOps)}`, true);
    
    if (data.summary.totalRoundingAdjustment !== 0) {
      renderRow(
        "Selisih Pembulatan POS",
        (data.summary.totalRoundingAdjustment > 0 ? "+ " : "") + fmt(data.summary.totalRoundingAdjustment),
        false
      );
    }
    
    y += 2;
    doc.setLineWidth(0.5);
    doc.line(14, y - 4, 196, y - 4);
    renderRow("C. LABA BERSIH", fmt(netProfit), true);
    
    y += 4;
    doc.line(14, y - 4, 196, y - 4);
    renderRow("D. DISTRIBUSI LABA BERSIH (Pasal 3 & 4)", "", true);
    renderRow("PIHAK PERTAMA (Investor - 40%)", fmt(p1), false, 2);
    renderRow("PIHAK KEDUA (Operator - 40%)", fmt(p2), false, 2);
    renderRow("Dana Cadangan Operasional (10%)", fmt(reserve), false, 2);
    renderRow("Dana Insentif / THR / Bonus (10%)", fmt(incentive), false, 2);

    y += 15;
    doc.text("Tanda Tangan Pihak Pertama", 14, y);
    doc.text("Tanda Tangan Pihak Kedua", 140, y);
    y += 20;
    doc.text("_______________________", 14, y);
    doc.text("_______________________", 140, y);

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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Percent className="w-6 h-6 text-orange-500" />
            Laporan Distribusi Bulanan
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Format laporan laba bersih & pembagian profit sesuai Perjanjian SATELITE
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2.5">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="text-xs bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
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
            className="text-xs bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer border-l pl-2 border-slate-200"
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
        <div className="bg-red-500/10 text-red-400 border border-red-500/20 p-4 rounded-2xl">
          Gagal memuat laporan distribusi bulanan.
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="flex justify-end gap-2">
            <button
              onClick={downloadPDF}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-orange-500/15"
            >
              <Printer className="w-4 h-4" /> Cetak & Unduh PDF
            </button>
          </div>

          {/* Report Sheet Layout */}
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <div className="text-center border-b pb-6 border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 tracking-wide">
                LAPORAN DISTRIBUSI BAGI HASIL
              </h2>
              <p className="text-slate-500 text-xs mt-1 uppercase tracking-wider">
                Periode: {getMonthLabel(selectedMonth)} {selectedYear}
              </p>
            </div>

            <div className="mt-8 space-y-6 text-slate-700">
              {/* Section A: Revenue */}
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="font-bold text-slate-800">A. OMZET KOTOR (PENJUALAN)</span>
                <span className="font-bold text-slate-800 text-lg">{fmt(data.summary.grossRevenue)}</span>
              </div>

              {/* Section B: Operating Expenses */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800">B. BIAYA OPERASIONAL</span>
                </div>
                <div className="space-y-2.5 pl-4 border-l-2 border-slate-100 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Bahan Baku (HPP)</span>
                    <span className="font-medium text-red-500">- {fmt(data.summary.totalHpp)}</span>
                  </div>
                  {Object.entries(data.expensesByCategory).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between items-center">
                      <span className="text-slate-500">{cat}</span>
                      <span className="font-medium text-red-500">- {fmt(amt as number)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-2 text-sm border-t border-slate-50 border-dashed">
                  <span className="font-semibold text-slate-600">Total Biaya Operasional</span>
                  <span className="font-bold text-red-500">- {fmt(totalOps)}</span>
                </div>
              </div>

              {/* Rounding Adjustment if exists */}
              {data.summary.totalRoundingAdjustment !== 0 && (
                <div className="flex justify-between items-center py-2 text-sm text-slate-500 border-t border-slate-100">
                  <span>Selisih Pembulatan POS</span>
                  <span className={data.summary.totalRoundingAdjustment > 0 ? "text-emerald-500" : "text-red-500"}>
                    {data.summary.totalRoundingAdjustment > 0 ? "+ " : ""}{fmt(data.summary.totalRoundingAdjustment)}
                  </span>
                </div>
              )}

              {/* Section C: Net Profit */}
              <div className="flex justify-between items-center py-4 border-y-2 border-slate-100 bg-slate-50/50 px-4 rounded-xl">
                <span className="font-bold text-slate-800">C. LABA BERSIH (NET PROFIT)</span>
                <span className={`font-black text-xl ${netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {fmt(netProfit)}
                </span>
              </div>

              {/* Section D: Investor Distribution */}
              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800">D. DISTRIBUSI LABA BERSIH (Pasal 3 & 4)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      PIHAK PERTAMA (Investor - 40%)
                    </p>
                    <p className="text-lg font-bold text-orange-600 mt-1">{fmt(netProfit * 0.40)}</p>
                  </div>
                  <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      PIHAK KEDUA (Operator - 40%)
                    </p>
                    <p className="text-lg font-bold text-orange-600 mt-1">{fmt(netProfit * 0.40)}</p>
                  </div>
                  <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      Dana Cadangan Operasional (10%)
                    </p>
                    <p className="text-lg font-bold text-indigo-600 mt-1">{fmt(netProfit * 0.10)}</p>
                  </div>
                  <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      Dana Insentif / THR / Bonus (10%)
                    </p>
                    <p className="text-lg font-bold text-indigo-600 mt-1">{fmt(netProfit * 0.10)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Signature Area */}
            <div className="mt-12 pt-8 border-t border-slate-100 grid grid-cols-2 gap-4 text-center text-xs text-slate-500">
              <div className="space-y-16">
                <p>Pihak Pertama (Investor)</p>
                <p className="font-semibold text-slate-700 underline">_______________________</p>
              </div>
              <div className="space-y-16">
                <p>Pihak Kedua (Operator)</p>
                <p className="font-semibold text-slate-700 underline">_______________________</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

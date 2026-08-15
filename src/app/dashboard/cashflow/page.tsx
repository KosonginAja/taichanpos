"use client";

import { useState } from "react";
import useSWR from "swr";
import { TrendingUp, Download, Calendar, Loader2, ArrowUpCircle, ArrowDownCircle, Landmark } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CashflowPage() {
  const { data: userSession } = useSWR("/api/auth/me", fetcher);
  const isAdmin = userSession?.user?.role === "admin";

  const today = new Date().toISOString().split("T")[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today);
  const [openingBalance, setOpeningBalance] = useState("0");

  const { data, error, isLoading } = useSWR(
    isAdmin && startDate && endDate
      ? `/api/reports/cashflow?startDate=${startDate}&endDate=${endDate}&openingBalance=${openingBalance}`
      : null,
    fetcher
  );

  const fmt = (v: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v);

  const downloadPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    const { summary, inByCategory, outByCategory } = data;

    doc.setFontSize(16);
    doc.text("Laporan Arus Kas", 14, 18);
    doc.setFontSize(10);
    doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 25);

    let y = 36;
    const row = (label: string, value: string, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(label, 14, y);
      doc.text(value, 196, y, { align: "right" });
      y += 8;
    };

    row("Saldo Awal Periode", fmt(summary.openingBalance));
    y += 2;

    doc.setFont("helvetica", "bold");
    doc.text("KAS MASUK", 14, y); y += 8;
    Object.entries(inByCategory).forEach(([cat, amt]) => row(`  ${cat}`, fmt(amt as number)));
    doc.line(14, y - 2, 196, y - 2);
    row("Total Kas Masuk", fmt(summary.totalIn), true);
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.text("KAS KELUAR", 14, y); y += 8;
    Object.entries(outByCategory).forEach(([cat, amt]) => row(`  ${cat}`, fmt(amt as number)));
    doc.line(14, y - 2, 196, y - 2);
    row("Total Kas Keluar", fmt(summary.totalOut), true);
    y += 6;

    doc.setLineWidth(1);
    doc.line(14, y - 2, 196, y - 2);
    row("SALDO AKHIR", fmt(summary.closingBalance), true);

    doc.save(`Arus_Kas_${startDate}_to_${endDate}.pdf`);
  };

  if (!isAdmin && userSession) {
    return <div className="flex h-full items-center justify-center text-slate-500">Anda tidak memiliki akses.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Landmark className="w-6 h-6 text-blue-400" />
          Laporan Arus Kas
        </h1>

        <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl p-2">
          <div className="flex items-center gap-2 px-2 border-r border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs bg-transparent text-slate-600 focus:outline-none" />
          </div>
          <div className="flex items-center gap-2 px-2">
            <span className="text-slate-500 text-xs">s/d</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs bg-transparent text-slate-600 focus:outline-none" />
          </div>
        </div>
      </div>

      {/* Opening balance input */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
          <Landmark className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Saldo Awal Periode (Rp)</label>
          <input
            type="number"
            step="any"
            min="0"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            placeholder="0"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 focus:outline-none focus:border-orange-500"
          />
        </div>
        <p className="text-xs text-slate-500 max-w-[180px]">Input saldo kas awal periode sebagai baseline laporan.</p>
      </div>

      {isLoading && <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-orange-600 animate-spin" /></div>}
      {error && <div className="bg-red-500/20 text-red-400 border border-red-500/30 p-4 rounded-xl text-sm">Gagal memuat laporan arus kas.</div>}

      {data && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={downloadPDF} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-orange-500/20">
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Saldo Awal", value: data.summary.openingBalance, color: "blue" },
              { label: "Total Masuk", value: data.summary.totalIn, color: "emerald" },
              { label: "Total Keluar", value: data.summary.totalOut, color: "red" },
              { label: "Saldo Akhir", value: data.summary.closingBalance, color: data.summary.closingBalance >= 0 ? "indigo" : "orange" },
            ].map((card) => (
              <div key={card.label} className={`rounded-2xl p-4 border bg-${card.color}-500/10 border-${card.color}-500/20`}>
                <p className={`text-xs font-semibold text-${card.color}-400 uppercase tracking-wider`}>{card.label}</p>
                <p className={`text-xl font-bold text-${card.color}-400 mt-1 truncate`}>{fmt(card.value)}</p>
              </div>
            ))}
          </div>

          {/* Kas Masuk Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <ArrowUpCircle className="w-5 h-5 text-emerald-400" /> Rincian Kas Masuk
            </h2>
            {Object.keys(data.inByCategory).length === 0 ? (
              <p className="text-slate-500 text-sm italic">Tidak ada kas masuk pada periode ini.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(data.inByCategory).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between items-center py-2 border-b border-slate-200/50 last:border-0">
                    <span className="text-slate-600 text-sm">{cat}</span>
                    <span className="font-semibold text-emerald-400">+{fmt(amt as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-3 border-t border-slate-300 font-bold">
                  <span className="text-slate-800">Total Kas Masuk</span>
                  <span className="text-emerald-400 text-lg">+{fmt(data.summary.totalIn)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Kas Keluar Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <ArrowDownCircle className="w-5 h-5 text-red-400" /> Rincian Kas Keluar
            </h2>
            {Object.keys(data.outByCategory).length === 0 ? (
              <p className="text-slate-500 text-sm italic">Tidak ada kas keluar pada periode ini.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(data.outByCategory).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between items-center py-2 border-b border-slate-200/50 last:border-0">
                    <span className="text-slate-600 text-sm">{cat}</span>
                    <span className="font-semibold text-red-400">-{fmt(amt as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-3 border-t border-slate-300 font-bold">
                  <span className="text-slate-800">Total Kas Keluar</span>
                  <span className="text-red-400 text-lg">-{fmt(data.summary.totalOut)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Saldo Akhir */}
          <div className={`rounded-2xl p-6 border flex justify-between items-center ${data.summary.closingBalance >= 0 ? "bg-indigo-500/10 border-orange-500/20" : "bg-orange-500/10 border-orange-500/20"}`}>
            <span className="text-lg font-bold text-slate-900">Saldo Akhir Periode</span>
            <span className={`text-2xl font-black ${data.summary.closingBalance >= 0 ? "text-orange-500" : "text-orange-400"}`}>
              {fmt(data.summary.closingBalance)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

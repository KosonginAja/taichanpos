"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  TrendingUp,
  DollarSign,
  Download,
  Calendar,
  Loader2,
  Wallet,
  Info,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ProfitLossPage() {
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
      ? `/api/reports/profit-loss?startDate=${startDate}&endDate=${endDate}`
      : null,
    fetcher,
  );

  const fmt = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(val);

  const downloadPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Laporan Laba Rugi", 14, 20);
    doc.setFontSize(10);
    doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 27);

    let y = 40;
    const renderRow = (title: string, value: string, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(title, 14, y);
      doc.text(value, 196, y, { align: "right" });
      y += 8;
    };

    renderRow("Pendapatan Kotor (Revenue)", fmt(data.summary.grossRevenue));
    renderRow("Harga Pokok Penjualan (HPP)", `- ${fmt(data.summary.totalHpp)}`);
    doc.line(14, y - 4, 196, y - 4);
    renderRow("Laba Kotor", fmt(data.summary.grossProfit), true);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Beban Operasional", 14, y);
    y += 8;
    Object.entries(data.expensesByCategory).forEach(([cat, amt]) =>
      renderRow(`  - ${cat}`, `- ${fmt(amt as number)}`),
    );
    doc.line(14, y - 4, 196, y - 4);
    renderRow("Total Beban Operasional", `- ${fmt(data.summary.totalExpenses)}`, true);
    if (data.summary.totalRoundingAdjustment !== 0) {
      renderRow(
        "Selisih Pembulatan",
        (data.summary.totalRoundingAdjustment > 0 ? "+ " : "") +
          fmt(data.summary.totalRoundingAdjustment),
        false,
      );
    }
    y += 4;
    doc.setLineWidth(1);
    doc.line(14, y - 4, 196, y - 4);
    renderRow("Laba Bersih (Net Profit)", fmt(data.summary.netProfit), true);

    doc.save(`Laba_Rugi_${startDate}_to_${endDate}.pdf`);
  };

  if (!isAdmin && userSession) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Anda tidak memiliki akses ke halaman ini.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-emerald-400" />
          Laporan Laba Rugi
        </h1>
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

      {/* Info banner — alokasi otomatis */}
      <div className="flex items-start gap-3 bg-purple-500/10 border border-orange-500/20 rounded-xl p-4 text-sm text-purple-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-orange-500" />
        <div>
          <span className="font-semibold">Alokasi laba kini berjalan otomatis.</span>{" "}
          Setiap pesanan masuk, laba bersih otomatis dibagi ke{" "}
          <a href="/dashboard/pockets" className="underline hover:text-purple-200 font-medium inline-flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5" /> Kantong Kas
          </a>{" "}
          sesuai persentase yang diatur di Pengaturan Usaha. Tidak perlu alokasi manual lagi.
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
        </div>
      )}
      {error && (
        <div className="bg-red-500/20 text-red-400 border border-red-500/30 p-4 rounded-xl">
          Gagal memuat laporan laba rugi.
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={downloadPDF}
              className="bg-slate-100 hover:bg-slate-700 text-slate-600 rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-colors border border-slate-300"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-8 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <DollarSign className="w-64 h-64" />
            </div>
            <div className="relative z-10 space-y-6 text-sm">
              <div className="flex justify-between items-center py-3 border-b border-slate-200/50">
                <span className="text-slate-500">Pendapatan Kotor (Revenue)</span>
                <span className="font-medium text-slate-800">{fmt(data.summary.grossRevenue)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-200/50">
                <span className="text-slate-500">Harga Pokok Penjualan (HPP)</span>
                <span className="font-medium text-red-400">- {fmt(data.summary.totalHpp)}</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b border-slate-300 text-base">
                <span className="font-semibold text-slate-600">Laba Kotor</span>
                <span className="font-bold text-emerald-400">{fmt(data.summary.grossProfit)}</span>
              </div>

              <div className="pt-2">
                <span className="font-semibold text-slate-600 block mb-4">Beban Operasional</span>
                {Object.keys(data.expensesByCategory).length === 0 ? (
                  <div className="text-slate-500 italic py-2">
                    Tidak ada beban operasional pada periode ini.
                  </div>
                ) : (
                  <div className="space-y-3 pl-4 border-l-2 border-slate-200">
                    {Object.entries(data.expensesByCategory).map(([cat, amt]) => (
                      <div key={cat} className="flex justify-between items-center">
                        <span className="text-slate-500">{cat}</span>
                        <span className="font-medium text-red-400">- {fmt(amt as number)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center py-4 border-y border-slate-300 text-base">
                <span className="font-semibold text-slate-600">Total Beban Operasional</span>
                <span className="font-bold text-red-400">- {fmt(data.summary.totalExpenses)}</span>
              </div>

              {data.summary.totalRoundingAdjustment !== 0 && (
                <div className="flex justify-between items-center py-3 border-b border-slate-300">
                  <span className="font-semibold text-slate-600">Selisih Pembulatan</span>
                  <span className={`font-bold ${data.summary.totalRoundingAdjustment > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {data.summary.totalRoundingAdjustment > 0 ? "+ " : ""}
                    {fmt(data.summary.totalRoundingAdjustment)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-6 pb-2 text-xl">
                <span className="font-bold text-white">Laba Bersih</span>
                <span className={`font-black ${data.summary.netProfit >= 0 ? "text-emerald-400" : "text-red-500"}`}>
                  {fmt(data.summary.netProfit)}
                </span>
              </div>

              <div className="flex justify-between text-xs text-slate-500 pt-4 border-t border-slate-200 border-dashed">
                <span>Pajak Dipungut: {fmt(data.summary.totalTax)}</span>
                <span>Service Charge: {fmt(data.summary.totalServiceCharge)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

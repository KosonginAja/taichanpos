"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardCheck,
  History,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Check,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Eye,
  Info,
  RotateCcw,
  Sparkles,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatQty = (val: number | string) => {
  const num = typeof val === "number" ? val : parseFloat(val?.toString() || "0");
  return isNaN(num) ? "0" : parseFloat(num.toFixed(3)).toString();
};

const fmtRp = (v: number) =>
  "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(v));

export default function StockOpnamePage() {
  const { data: ingredients, mutate: mutateIng } = useSWR("/api/ingredients", fetcher);
  const { data: sessions, mutate: mutateSessions } = useSWR("/api/ingredients/opname", fetcher);

  const [activeTab, setActiveTab] = useState<"worksheet" | "history">("worksheet");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "raw" | "intermediate">("all");
  const [notes, setNotes] = useState("");

  // Worksheet state: mapping ingredientId => physicalStock string
  const [physicalStocks, setPhysicalStocks] = useState<Record<number, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({});

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailSessionId, setDetailSessionId] = useState<number | null>(null);
  const [detailSessionData, setDetailSessionData] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [applyingId, setApplyingId] = useState<number | null>(null);

  // Quick fill: copy system stock to physical stock for all active items
  const handleCopySystemStock = () => {
    if (!ingredients || !Array.isArray(ingredients)) return;
    const filled: Record<number, string> = {};
    ingredients.forEach((ing: any) => {
      filled[ing.id] = formatQty(ing.stock);
    });
    setPhysicalStocks(filled);
  };

  // Reset worksheet
  const handleResetWorksheet = () => {
    if (confirm("Reset semua input stok fisik pada lembar kerja?")) {
      setPhysicalStocks({});
      setItemNotes({});
      setNotes("");
    }
  };

  // Filter ingredients
  const filteredIngredients = (ingredients || []).filter((ing: any) => {
    const matchSearch = ing.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = filterType === "all" || ing.type === filterType;
    return matchSearch && matchType;
  });

  // Calculate live statistics
  let totalAudited = 0;
  let totalMatch = 0;
  let totalDiscrepancies = 0;
  let netDiscrepancyCost = 0;

  (ingredients || []).forEach((ing: any) => {
    const inputVal = physicalStocks[ing.id];
    if (inputVal !== undefined && inputVal.trim() !== "") {
      totalAudited++;
      const sysStock = parseFloat(ing.stock.toString());
      const physStock = parseFloat(inputVal);
      if (!isNaN(physStock)) {
        const diff = Math.round((physStock - sysStock) * 1000) / 1000;
        const unitCost = parseFloat(ing.price.toString());
        netDiscrepancyCost += diff * unitCost;

        if (Math.abs(diff) < 0.0001) {
          totalMatch++;
        } else {
          totalDiscrepancies++;
        }
      }
    }
  });

  // Submit Opname
  const handleSubmitOpname = async (applyImmediately: boolean) => {
    if (totalAudited === 0) {
      alert("Masukkan minimal 1 stok fisik bahan baku untuk disimpan.");
      return;
    }

    const confirmMsg = applyImmediately
      ? `Terapkan Rekonsiliasi Sekarang?\n\nStok pada ${totalAudited} bahan baku di database akan langsung disesuaikan dengan hasil audit fisik, dan riwayat mutasi penyesuaian akan dibuat.\n\nTotal Selisih Nominal: ${fmtRp(netDiscrepancyCost)}`
      : "Simpan audit stok fisik ini sebagai DRAF? Stok gudang belum akan diubah sampai direkonsiliasi.";

    if (!confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      const itemsPayload: Array<{ ingredientId: number; physicalStock: number; note?: string }> = [];

      (ingredients || []).forEach((ing: any) => {
        const inputVal = physicalStocks[ing.id];
        if (inputVal !== undefined && inputVal.trim() !== "") {
          const phys = parseFloat(inputVal);
          if (!isNaN(phys)) {
            itemsPayload.push({
              ingredientId: ing.id,
              physicalStock: phys,
              note: itemNotes[ing.id] || undefined,
            });
          }
        }
      });

      const res = await fetch("/api/ingredients/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes || (applyImmediately ? "Opname & Rekonsiliasi Cepat" : "Draf Opname Fisik"),
          applyImmediately,
          items: itemsPayload,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Opname berhasil diproses!");
        mutateIng();
        mutateSessions();
        setPhysicalStocks({});
        setItemNotes({});
        setNotes("");
        setActiveTab("history");
      } else {
        alert(data.error || "Gagal menyimpan opname.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Apply a draft session from history
  const handleApplyDraft = async (sessionId: number, sessionNum: string) => {
    if (!confirm(`Terapkan rekonsiliasi stok untuk sesi ${sessionNum} sekarang? Stok gudang akan otomatis disesuaikan.`)) {
      return;
    }

    setApplyingId(sessionId);
    try {
      const res = await fetch(`/api/ingredients/opname/${sessionId}/apply`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Rekonsiliasi berhasil diterapkan!");
        mutateIng();
        mutateSessions();
        if (detailSessionId === sessionId) {
          fetchSessionDetail(sessionId);
        }
      } else {
        alert(data.error || "Gagal menerapkan rekonsiliasi");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan jaringan");
    } finally {
      setApplyingId(null);
    }
  };

  // Fetch session details for modal
  const fetchSessionDetail = async (id: number) => {
    setDetailSessionId(id);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/ingredients/opname?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailSessionData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/dashboard/ingredients"
                className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Gudang Bahan Baku
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-semibold text-slate-500">Stock Opname</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <ClipboardCheck className="w-7 h-7 text-orange-600" />
              Stock Opname & Rekonsiliasi
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Audit fisik berkala, deteksi varians (selisih) sistem vs riil, dan penyesuaian stok otomatis.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setActiveTab("worksheet")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "worksheet"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Lembar Kerja Audit
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "history"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="w-4 h-4" />
              Riwayat Sesi
              {sessions && sessions.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black">
                  {sessions.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {activeTab === "worksheet" ? (
          <div className="space-y-6">
            {/* Top Config Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 max-w-xl">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Catatan / Keterangan Sesi Opname
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Audit Mingguan - Shift Pagi (Penghitungan oleh Tim Dapur)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-slate-50/50"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopySystemStock}
                    title="Isi otomatis semua stok fisik dengan angka stok sistem saat ini"
                    className="px-3.5 py-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-bold flex items-center gap-2 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Salin Stok Sistem ke Fisik
                  </button>

                  <button
                    onClick={handleResetWorksheet}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari nama bahan baku..."
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-slate-50/50"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
                    <button
                      onClick={() => setFilterType("all")}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        filterType === "all" ? "bg-white text-slate-900 font-bold shadow-xs" : "text-slate-600"
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => setFilterType("raw")}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        filterType === "raw" ? "bg-white text-slate-900 font-bold shadow-xs" : "text-slate-600"
                      }`}
                    >
                      Bahan Mentah
                    </button>
                    <button
                      onClick={() => setFilterType("intermediate")}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        filterType === "intermediate" ? "bg-white text-slate-900 font-bold shadow-xs" : "text-slate-600"
                      }`}
                    >
                      Bahan Olahan
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  Menampilkan <b>{filteredIngredients.length}</b> bahan baku
                </div>
              </div>
            </div>

            {/* Audit Worksheet Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-bold tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">No</th>
                      <th className="py-3 px-4">Bahan Baku</th>
                      <th className="py-3 px-4 text-right">Stok Sistem</th>
                      <th className="py-3 px-4 text-center w-48">Stok Fisik Riil</th>
                      <th className="py-3 px-4 text-right">Selisih (Varians)</th>
                      <th className="py-3 px-4 text-right">HPP Satuan</th>
                      <th className="py-3 px-4 text-right">Nilai Selisih (Rp)</th>
                      <th className="py-3 px-4">Keterangan / Alasan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredIngredients.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          Tidak ada bahan baku yang cocok dengan filter pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredIngredients.map((ing: any, index: number) => {
                        const inputVal = physicalStocks[ing.id] ?? "";
                        const hasInput = inputVal.trim() !== "";
                        const sysStock = parseFloat(ing.stock.toString());
                        const physStock = hasInput ? parseFloat(inputVal) : NaN;
                        const diffQty = !isNaN(physStock)
                          ? Math.round((physStock - sysStock) * 1000) / 1000
                          : 0;
                        const unitCost = parseFloat(ing.price.toString());
                        const diffCost = !isNaN(physStock) ? diffQty * unitCost : 0;

                        return (
                          <tr
                            key={ing.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              hasInput && Math.abs(diffQty) > 0.0001
                                ? "bg-amber-50/30"
                                : ""
                            }`}
                          >
                            <td className="py-3 px-4 text-center text-xs text-slate-400 font-mono">
                              {index + 1}
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-800">{ing.name}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                  ing.type === "intermediate"
                                    ? "bg-purple-100 text-purple-700 border border-purple-200"
                                    : "bg-slate-100 text-slate-600 border border-slate-200"
                                }`}>
                                  {ing.type === "intermediate" ? "Bahan Olahan" : "Mentah"}
                                </span>
                                <span className="text-xs text-slate-400">Satuan: <b>{ing.unit}</b></span>
                              </div>
                            </td>

                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                              {formatQty(ing.stock)} <span className="text-xs font-normal text-slate-500">{ing.unit}</span>
                            </td>

                            {/* Physical Stock Input */}
                            <td className="py-2.5 px-4">
                              <div className="relative">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={inputVal}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPhysicalStocks((prev) => ({
                                      ...prev,
                                      [ing.id]: val,
                                    }));
                                  }}
                                  placeholder={formatQty(ing.stock)}
                                  className={`w-full text-right font-mono font-bold py-1.5 pl-3 pr-12 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all ${
                                    !hasInput
                                      ? "border-slate-200 bg-slate-50 focus:bg-white focus:ring-orange-500/20 focus:border-orange-500 text-slate-800"
                                      : Math.abs(diffQty) < 0.0001
                                      ? "border-emerald-300 bg-emerald-50/50 text-emerald-800 focus:ring-emerald-500/20 focus:border-emerald-500"
                                      : diffQty < 0
                                      ? "border-rose-300 bg-rose-50/50 text-rose-800 focus:ring-rose-500/20 focus:border-rose-500"
                                      : "border-blue-300 bg-blue-50/50 text-blue-800 focus:ring-blue-500/20 focus:border-blue-500"
                                  }`}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                                  {ing.unit}
                                </span>
                              </div>
                            </td>

                            {/* Variance Difference Qty */}
                            <td className="py-3 px-4 text-right">
                              {!hasInput ? (
                                <span className="text-slate-300 text-xs font-mono">-</span>
                              ) : Math.abs(diffQty) < 0.0001 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  Pas (0)
                                </span>
                              ) : diffQty < 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 font-mono">
                                  {formatQty(diffQty)} {ing.unit}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 font-mono">
                                  +{formatQty(diffQty)} {ing.unit}
                                </span>
                              )}
                            </td>

                            {/* Unit Cost */}
                            <td className="py-3 px-4 text-right text-xs text-slate-500 font-mono">
                              {fmtRp(unitCost)}/{ing.unit}
                            </td>

                            {/* Discrepancy Cost (Rp) */}
                            <td className="py-3 px-4 text-right font-mono text-xs font-bold">
                              {!hasInput ? (
                                <span className="text-slate-300">-</span>
                              ) : Math.abs(diffCost) < 1 ? (
                                <span className="text-slate-400">Rp 0</span>
                              ) : diffCost < 0 ? (
                                <span className="text-rose-600">
                                  -{fmtRp(Math.abs(diffCost))}
                                </span>
                              ) : (
                                <span className="text-blue-600">
                                  +{fmtRp(diffCost)}
                                </span>
                              )}
                            </td>

                            {/* Note / Reason */}
                            <td className="py-2.5 px-4">
                              <input
                                type="text"
                                value={itemNotes[ing.id] ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setItemNotes((prev) => ({
                                    ...prev,
                                    [ing.id]: val,
                                  }));
                                }}
                                placeholder={hasInput && diffQty !== 0 ? "cth: Susut pencairan, tumpah..." : "Opsional"}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-slate-50/50"
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Summary & Actions Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Item Dihitung
                  </div>
                  <div className="text-xl font-black text-slate-800 mt-0.5">
                    {totalAudited}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      / {ingredients?.length || 0}
                    </span>
                  </div>
                </div>

                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                    Sesuai (Match)
                  </div>
                  <div className="text-xl font-black text-emerald-700 mt-0.5">
                    {totalMatch}
                  </div>
                </div>

                <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                    Ada Selisih
                  </div>
                  <div className="text-xl font-black text-amber-700 mt-0.5">
                    {totalDiscrepancies}
                  </div>
                </div>

                <div className={`rounded-xl p-3 border ${
                  netDiscrepancyCost < 0
                    ? "bg-rose-50/60 border-rose-200/80 text-rose-800"
                    : netDiscrepancyCost > 0
                    ? "bg-blue-50/60 border-blue-200/80 text-blue-800"
                    : "bg-slate-50 border-slate-200/80 text-slate-700"
                }`}>
                  <div className="text-[11px] font-bold uppercase tracking-wider">
                    Total Selisih (Rp)
                  </div>
                  <div className="text-xl font-black mt-0.5 font-mono">
                    {netDiscrepancyCost < 0
                      ? `-${fmtRp(Math.abs(netDiscrepancyCost))}`
                      : netDiscrepancyCost > 0
                      ? `+${fmtRp(netDiscrepancyCost)}`
                      : "Rp 0"}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                <button
                  onClick={() => handleSubmitOpname(false)}
                  disabled={isSubmitting || totalAudited === 0}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors disabled:opacity-50"
                >
                  Simpan Draf Audit
                </button>

                <button
                  onClick={() => handleSubmitOpname(true)}
                  disabled={isSubmitting || totalAudited === 0}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Terapkan Rekonsiliasi (1-Click)</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* History Tab */
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                Histori Sesi Stock Opname
              </h3>
              <span className="text-xs text-slate-500">
                Total <b>{sessions?.length || 0}</b> sesi tercatat
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50/40 border-b border-slate-200 text-slate-600 text-xs uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">No. Sesi</th>
                    <th className="py-3 px-4">Tanggal Audit</th>
                    <th className="py-3 px-4">Auditor</th>
                    <th className="py-3 px-4">Catatan</th>
                    <th className="py-3 px-4 text-center">Item / Selisih</th>
                    <th className="py-3 px-4 text-right">Nilai Selisih</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!sessions || sessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Belum ada riwayat stock opname yang tercatat.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s: any) => {
                      const cost = parseFloat(s.totalDiscrepancyCost.toString());
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 text-xs">
                            {s.sessionNumber}
                          </td>

                          <td className="py-3 px-4 text-xs text-slate-600">
                            <div>{new Date(s.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {new Date(s.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                            {s.conductedBy}
                          </td>

                          <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                            {s.notes || "-"}
                          </td>

                          <td className="py-3 px-4 text-center text-xs">
                            <span className="font-bold text-slate-800">{s.itemCount}</span> item
                            {s.discrepancyCount > 0 && (
                              <span className="text-rose-600 font-semibold ml-1">
                                ({s.discrepancyCount} selisih)
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-xs font-bold">
                            {cost < 0 ? (
                              <span className="text-rose-600">-{fmtRp(Math.abs(cost))}</span>
                            ) : cost > 0 ? (
                              <span className="text-blue-600">+{fmtRp(cost)}</span>
                            ) : (
                              <span className="text-slate-500">Rp 0</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                              s.status === "applied"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}>
                              {s.status === "applied" ? "Terrekonsiliasi" : "Draf"}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => fetchSessionDetail(s.id)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs flex items-center gap-1 transition-colors"
                                title="Lihat Rincian"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {s.status === "draft" && (
                                <button
                                  onClick={() => handleApplyDraft(s.id, s.sessionNumber)}
                                  disabled={applyingId === s.id}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                                >
                                  {applyingId === s.id ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                  <span>Terapkan</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Detail Sesi Opname */}
      {detailSessionId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Rincian Sesi Opname: {detailSessionData?.sessionNumber || "Memuat..."}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Diaudit oleh {detailSessionData?.user?.name || "Staff"} &bull;{" "}
                  {detailSessionData?.createdAt &&
                    new Date(detailSessionData.createdAt).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                </p>
              </div>

              <button
                onClick={() => {
                  setDetailSessionId(null);
                  setDetailSessionData(null);
                }}
                className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {loadingDetail ? (
                <div className="py-16 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-orange-500" />
                  Memuat rincian item...
                </div>
              ) : !detailSessionData ? (
                <div className="py-12 text-center text-slate-400">Data sesi tidak ditemukan</div>
              ) : (
                <>
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-slate-500">Status:</span>{" "}
                      <span className={`font-bold uppercase px-2 py-0.5 rounded-full text-[10px] ${
                        detailSessionData.status === "applied"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {detailSessionData.status === "applied" ? "Terrekonsiliasi" : "Draf"}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500">Total Selisih Nominal:</span>{" "}
                      <span className="font-mono font-bold text-slate-900">
                        {fmtRp(parseFloat(detailSessionData.totalDiscrepancyCost.toString()))}
                      </span>
                    </div>

                    {detailSessionData.appliedAt && (
                      <div>
                        <span className="text-slate-500">Waktu Rekonsiliasi:</span>{" "}
                        <span className="font-semibold text-slate-700">
                          {new Date(detailSessionData.appliedAt).toLocaleString("id-ID", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {detailSessionData.notes && (
                    <div className="text-xs text-slate-600 bg-orange-50/40 border border-orange-200/60 p-3 rounded-xl">
                      <b>Catatan:</b> {detailSessionData.notes}
                    </div>
                  )}

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 uppercase font-bold">
                          <th className="py-2.5 px-3">Bahan Baku</th>
                          <th className="py-2.5 px-3 text-right">Stok Sistem</th>
                          <th className="py-2.5 px-3 text-right">Stok Fisik</th>
                          <th className="py-2.5 px-3 text-right">Selisih</th>
                          <th className="py-2.5 px-3 text-right">HPP Satuan</th>
                          <th className="py-2.5 px-3 text-right">Nominal Selisih</th>
                          <th className="py-2.5 px-3">Alasan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailSessionData.items?.map((it: any) => {
                          const diff = parseFloat(it.differenceQty.toString());
                          const cost = parseFloat(it.discrepancyCost.toString());
                          return (
                            <tr key={it.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {it.ingredient?.name || `Item #${it.ingredientId}`}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                {formatQty(it.systemStock)} {it.ingredient?.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                {formatQty(it.physicalStock)} {it.ingredient?.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                {Math.abs(diff) < 0.0001 ? (
                                  <span className="text-emerald-600">Pas</span>
                                ) : diff < 0 ? (
                                  <span className="text-rose-600">{formatQty(diff)}</span>
                                ) : (
                                  <span className="text-blue-600">+{formatQty(diff)}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                                {fmtRp(parseFloat(it.unitCost.toString()))}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                {cost < 0 ? (
                                  <span className="text-rose-600">-{fmtRp(Math.abs(cost))}</span>
                                ) : cost > 0 ? (
                                  <span className="text-blue-600">+{fmtRp(cost)}</span>
                                ) : (
                                  <span className="text-slate-400">Rp 0</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 italic">
                                {it.note || "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              {detailSessionData?.status === "draft" ? (
                <button
                  onClick={() =>
                    handleApplyDraft(detailSessionData.id, detailSessionData.sessionNumber)
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Terapkan Rekonsiliasi Sesi Ini Sekarang
                </button>
              ) : (
                <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Sesi ini telah direkonsiliasi ke stok fisik riil
                </div>
              )}

              <button
                onClick={() => {
                  setDetailSessionId(null);
                  setDetailSessionData(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

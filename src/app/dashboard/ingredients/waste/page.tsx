"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  AlertTriangle,
  TrendingDown,
  Plus,
  Loader2,
  Calendar,
  Layers,
  Filter,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatRupiah = (val: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
};

const formatQty = (val: number | string) => {
  const num = typeof val === "number" ? val : parseFloat(val);
  return isNaN(num) ? "0" : parseFloat(num.toFixed(3)).toString();
};

export default function WastePage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Form State
  const [itemType, setItemType] = useState<"ingredient" | "product">("ingredient");
  const [selectedId, setSelectedId] = useState<string>("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("spoiled");
  const [note, setNote] = useState("");

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);

  const { data: wasteData, error, mutate, isLoading } = useSWR(
    `/api/waste?${queryParams.toString()}`,
    fetcher
  );

  const { data: ingredients } = useSWR("/api/ingredients", fetcher);
  const { data: products } = useSWR("/api/products", fetcher);

  const logs = wasteData?.logs || [];
  const summary = wasteData?.summary || { totalLossAmount: 0, totalCount: 0, reasonBreakdown: {} };

  // Calculate estimated loss for modal preview
  const selectedItemObj =
    itemType === "ingredient"
      ? ingredients?.find((i: any) => i.id.toString() === selectedId)
      : products?.find((p: any) => p.id.toString() === selectedId);

  const unitCostPreview = selectedItemObj
    ? itemType === "ingredient"
      ? parseFloat(selectedItemObj.price || "0")
      : parseFloat(selectedItemObj.hpp || "0")
    : 0;

  const estimatedTotalLoss = (parseFloat(qty) || 0) * unitCostPreview;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError("");

    try {
      const payload: any = {
        qty: parseFloat(qty),
        reason,
        note,
      };

      if (itemType === "ingredient") {
        payload.ingredientId = parseInt(selectedId);
      } else {
        payload.productId = parseInt(selectedId);
      }

      const res = await fetch("/api/waste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mencatat waste.");
      }

      setIsModalOpen(false);
      setSelectedId("");
      setQty("");
      setNote("");
      mutate();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getReasonLabel = (r: string) => {
    switch (r) {
      case "spoiled":
        return "Basi / Rusak";
      case "expired":
        return "Kadaluarsa";
      case "burnt":
        return "Gosong / Gagal Masak";
      case "dropped":
        return "Tumpah / Jatuh";
      case "portion_error":
        return "Salah Porsi / Retur";
      default:
        return r;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/ingredients"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-rose-500" />
              Pencatatan Waste & Spoilage
            </h1>
            <p className="text-sm text-slate-500">
              Pantau kerugian bahan baku basi, rusak, atau gagal masak sesuai standar F&B.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setModalError("");
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Catat Bahan Terbuang
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Kerugian (Loss)
            </span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2">
            {formatRupiah(summary.totalLossAmount)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Estimasi nilai nominal persediaan hilang</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Insiden Waste
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{summary.totalCount} kali</div>
          <p className="text-xs text-slate-400 mt-1">Pencatatan dalam periode ini</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Penyebab Terbanyak
            </span>
            <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="text-sm font-bold text-slate-800 mt-2">
            {Object.keys(summary.reasonBreakdown).length === 0 ? (
              <span className="text-slate-400 font-normal">Belum ada data</span>
            ) : (
              Object.entries(summary.reasonBreakdown)
                .sort((a: any, b: any) => b[1] - a[1])
                .slice(0, 2)
                .map(([r, count]) => (
                  <span key={r} className="inline-block mr-2 text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                    {getReasonLabel(r)}: {count as number}x
                  </span>
                ))
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">Fokus perbaikan operasional dapur</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-semibold">Filter Rentang Waktu:</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-rose-500"
          />
          <span className="text-xs text-slate-400">s/d</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-rose-500"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="text-xs text-rose-500 hover:underline px-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-900">Riwayat Insiden Waste</h2>
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center items-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat data waste...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Trash2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">Tidak ada data waste tercatat.</p>
            <p className="text-xs mt-1">Dapur Anda sangat efisien atau belum ada insiden yang dicatat.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">Tanggal</th>
                  <th className="px-6 py-3.5">Item Terbuang</th>
                  <th className="px-6 py-3.5">Jumlah</th>
                  <th className="px-6 py-3.5">Nilai Kerugian</th>
                  <th className="px-6 py-3.5">Alasan</th>
                  <th className="px-6 py-3.5">Catatan / Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(log.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{log.itemName}</td>
                    <td className="px-6 py-4 font-bold text-rose-600">
                      {formatQty(log.qty)} {log.unit}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">{formatRupiah(log.totalLoss)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">
                        {getReasonLabel(log.reason)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      <div>{log.note || "-"}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Oleh: {log.userName || "Admin"}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Catat Waste */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-500" />
                Catat Bahan / Produk Terbuang
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Tipe Item</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setItemType("ingredient");
                      setSelectedId("");
                    }}
                    className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                      itemType === "ingredient"
                        ? "bg-rose-500 border-rose-500 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    Bahan Baku / Olahan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setItemType("product");
                      setSelectedId("");
                    }}
                    className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                      itemType === "product"
                        ? "bg-rose-500 border-rose-500 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    Produk Jadi / Porsi
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Pilih {itemType === "ingredient" ? "Bahan Baku" : "Produk Jadi"}
                </label>
                <select
                  required
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500 bg-white"
                >
                  <option value="">-- Pilih Item --</option>
                  {itemType === "ingredient"
                    ? ingredients?.map((i: any) => (
                        <option key={i.id} value={i.id}>
                          {i.name} (Stok: {formatQty(i.stock)} {i.unit})
                        </option>
                      ))
                    : products?.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stok: {formatQty(p.currentStock)} porsi)
                        </option>
                      ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Jumlah ({selectedItemObj?.unit || "Unit"})
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.001"
                    placeholder="0.5"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Alasan</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500 bg-white"
                  >
                    <option value="spoiled">Basi / Rusak</option>
                    <option value="expired">Kadaluarsa</option>
                    <option value="burnt">Gosong / Gagal Masak</option>
                    <option value="dropped">Tumpah / Terjatuh</option>
                    <option value="portion_error">Salah Porsi / Retur</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
              </div>

              {/* Estimated Loss Preview */}
              {selectedItemObj && parseFloat(qty) > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs flex justify-between items-center text-rose-700">
                  <span>Estimasi Kerugian:</span>
                  <span className="font-bold text-sm">{formatRupiah(estimatedTotalLoss)}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Catatan Tambahan</label>
                <input
                  type="text"
                  placeholder="Misal: Daging bau saat buka kulkas pagi..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-2.5 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Simpan Waste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

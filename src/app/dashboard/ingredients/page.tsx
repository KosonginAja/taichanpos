"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Plus,
  Edit2,
  Trash2,
  TrendingUp,
  Sliders,
  History,
  AlertTriangle,
  RotateCcw,
  Loader2,
  CheckCircle,
  HelpCircle,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function IngredientsPage() {
  const { data: ingredients, error: ingError, mutate: mutateIng } = useSWR("/api/ingredients", fetcher);
  const { data: movements, error: movError, mutate: mutateMov } = useSWR("/api/ingredients/movements", fetcher);
  const { data: userSession } = useSWR("/api/auth/me", fetcher);

  const isAdmin = userSession?.user?.role === "admin";

  // State controls
  const [modalType, setModalType] = useState<"create" | "edit" | "restock" | "adjustment" | null>(null);
  const [selectedIng, setSelectedIng] = useState<any>(null);
  
  // Form fields
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [price, setPrice] = useState("");
  const [minStock, setMinStock] = useState("");
  const [stock, setStock] = useState(""); // for initial creation
  
  // Actions fields
  const [actionQty, setActionQty] = useState("");
  const [actionReason, setActionReason] = useState("correction");
  const [actionRef, setActionRef] = useState("");
  const [purchaseCost, setPurchaseCost] = useState(""); // optional: total biaya restock

  // Audit filters
  const [filterType, setFilterType] = useState("");
  const [filterIngId, setFilterIngId] = useState("");
  const [filterDate, setFilterDate] = useState("");
  
  const [deleteCutoff, setDeleteCutoff] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleDeleteMovements = async () => {
    if (!deleteCutoff) return;
    if (!confirm(`Yakin ingin menghapus semua jejak stok sebelum tanggal ${deleteCutoff}? Data tidak bisa dikembalikan.`)) return;
    
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/ingredients/movements?cutoffDate=${deleteCutoff}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccessMsg(`Berhasil menghapus ${data.deletedCount} data riwayat.`);
      mutateMov();
      setDeleteCutoff("");
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menghapus riwayat stok");
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);
  };

  const resetForm = () => {
    setName("");
    setUnit("kg");
    setPrice("");
    setMinStock("");
    setStock("");
    setActionQty("");
    setActionReason("correction");
    setActionRef("");
    setPurchaseCost("");
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleOpenModal = (type: "create" | "edit" | "restock" | "adjustment", item: any = null) => {
    resetForm();
    setSelectedIng(item);
    setModalType(type);

    if (item) {
      setName(item.name);
      setUnit(item.unit);
      setPrice(item.price.toString());
      setMinStock(item.minStock.toString());
    }
  };

  const handleCloseModal = () => {
    setModalType(null);
    setSelectedIng(null);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      let res;
      if (modalType === "create") {
        res = await fetch("/api/ingredients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, unit, price: parseFloat(price), minStock: parseFloat(minStock || "0"), stock: parseFloat(stock || "0") }),
        });
      } else if (modalType === "edit") {
        res = await fetch(`/api/ingredients/${selectedIng.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, unit, price: parseFloat(price), minStock: parseFloat(minStock || "0") }),
        });
      } else if (modalType === "restock") {
        res = await fetch("/api/ingredients/restock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ingredientId: selectedIng.id,
            qty: parseFloat(actionQty),
            refId: actionRef,
            purchaseCost: purchaseCost ? parseFloat(purchaseCost) : undefined,
          }),
        });
      } else if (modalType === "adjustment") {
        res = await fetch("/api/ingredients/adjustment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ingredientId: selectedIng.id, qty: parseFloat(actionQty), reason: actionReason }),
        });
      }

      const data = await res?.json();
      if (!res?.ok) throw new Error(data.error || "Operasi gagal");

      setSuccessMsg("Berhasil menyimpan data.");
      mutateIng();
      mutateMov();
      setTimeout(handleCloseModal, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus bahan baku ${item.name}?`)) return;
    try {
      const res = await fetch(`/api/ingredients/${item.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus.");
      alert(data.message);
      mutateIng();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filtered movements calculation
  const filteredMovements = movements?.filter((m: any) => {
    if (filterType && m.type !== filterType) return false;
    if (filterIngId && m.ingredientId.toString() !== filterIngId) return false;
    if (filterDate) {
      const mDate = new Date(m.createdAt).toISOString().split("T")[0];
      if (mDate !== filterDate) return false;
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Gudang Bahan Baku</h1>
          <p className="text-slate-500 mt-1">Kelola stok bahan, restock, penyesuaian, dan riwayat pergerakan</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => handleOpenModal("create")}
            className="self-start flex items-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Tambah Bahan Baku
          </button>
        )}
      </div>

      {successMsg && !modalType && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> <span>{successMsg}</span>
        </div>
      )}

      {/* Grid of Main Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Ingredients Table */}
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 overflow-hidden">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Daftar Bahan Baku</h3>

          {!ingredients ? (
            <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
              <span>Memuat bahan baku...</span>
            </div>
          ) : ingredients.length === 0 ? (
            <div className="text-center py-12 text-slate-500">Belum ada bahan baku.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="text-xs uppercase tracking-wider text-slate-500 bg-slate-50/40">
                  <tr>
                    <th className="px-6 py-4 rounded-l-xl">Nama Bahan</th>
                    <th className="px-6 py-4">Harga Terkini</th>
                    <th className="px-6 py-4">Stok Saat Ini</th>
                    <th className="px-6 py-4">Min. Stok</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right rounded-r-xl">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {ingredients.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/20 transition-all">
                      <td className="px-6 py-4.5 font-medium text-slate-800">{item.name}</td>
                      <td className="px-6 py-4.5">{formatRupiah(item.price)} / {item.unit}</td>
                      <td className="px-6 py-4.5 font-semibold text-slate-900">
                        {item.stock.toFixed(2)} <span className="text-xs text-slate-500">{item.unit}</span>
                      </td>
                      <td className="px-6 py-4.5 text-slate-500">
                        {item.minStock.toFixed(2)} <span className="text-xs">{item.unit}</span>
                      </td>
                      <td className="px-6 py-4.5">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.status === "Habis"
                            ? "bg-rose-950 border border-rose-900 text-rose-400"
                            : item.status === "Menipis"
                            ? "bg-amber-950 border border-amber-900 text-amber-400"
                            : "bg-emerald-950 border border-emerald-900 text-emerald-400"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-right space-x-1.5">
                        {isAdmin ? (
                          <>
                            <button
                              onClick={() => handleOpenModal("restock", item)}
                              className="px-2.5 py-1 text-xs font-semibold bg-emerald-950 border border-emerald-900 text-emerald-400 hover:bg-emerald-900 hover:text-white rounded-lg transition-all"
                              title="Restock (Tambah Stok)"
                            >
                              Restock
                            </button>
                            <button
                              onClick={() => handleOpenModal("adjustment", item)}
                              className="px-2.5 py-1 text-xs font-semibold bg-blue-950 border border-blue-900 text-blue-400 hover:bg-blue-900 hover:text-white rounded-lg transition-all"
                              title="Stock Adjustment (Penyesuaian)"
                            >
                              Adjust
                            </button>
                            <button
                              onClick={() => handleOpenModal("edit", item)}
                              className="p-1.5 bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 rounded-lg transition-all inline-flex items-center"
                              title="Edit Info"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-1.5 bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 rounded-lg transition-all inline-flex items-center"
                              title="Hapus / Nonaktifkan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">Read-only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Audit Trail Movements */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col h-[600px] xl:h-auto">
          <div className="flex items-center gap-2 mb-6">
            <History className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-slate-900">Audit Trail Pergerakan</h3>
          </div>

          {/* Audit Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-3 mb-6 bg-slate-50/40 p-4 border border-slate-200 rounded-xl">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Bahan Baku
              </label>
              <select
                value={filterIngId}
                onChange={(e) => setFilterIngId(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-orange-500"
              >
                <option value="">Semua Bahan</option>
                {ingredients?.map((i: any) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Tipe Gerakan
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-orange-500"
              >
                <option value="">Semua Tipe</option>
                <option value="restock">Restock</option>
                <option value="order">Order (Pesanan)</option>
                <option value="adjustment">Adjustment</option>
                <option value="return">Return (Batal)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Tanggal
              </label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Admin Clean-up Tools */}
          {isAdmin && (
            <div className="flex items-end gap-3 mb-6 bg-red-950/20 p-4 border border-red-900/30 rounded-xl">
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">
                  Bersihkan Riwayat Sebelum Tanggal
                </label>
                <input
                  type="date"
                  value={deleteCutoff}
                  onChange={(e) => setDeleteCutoff(e.target.value)}
                  className="w-full text-xs bg-white border border-red-900/50 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-red-500"
                />
              </div>
              <button
                onClick={handleDeleteMovements}
                disabled={!deleteCutoff || loading}
                className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-1.5 text-xs font-semibold disabled:opacity-50 flex items-center gap-2 h-[34px] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Data Lama
              </button>
            </div>
          )}

          {/* Audit List */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {!filteredMovements ? (
              <div className="flex items-center justify-center h-40 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : filteredMovements.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">Tidak ada riwayat pergerakan.</div>
            ) : (
              filteredMovements.map((log: any) => {
                const qtyVal = log.qty;
                const isPositive = qtyVal > 0;
                return (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-50/40 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800 truncate">{log.ingredientName}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          log.type === "restock"
                            ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900"
                            : log.type === "order"
                            ? "bg-rose-950/40 text-rose-400 border border-rose-900"
                            : log.type === "return"
                            ? "bg-teal-950/40 text-teal-400 border border-teal-900"
                            : "bg-blue-950/40 text-blue-400 border border-blue-900"
                        }`}>
                          {log.type}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 truncate">
                        {log.refId ? `Ref: ${log.refId}` : log.reason ? `Alasan: ${log.reason}` : ""}
                        {log.userName ? ` | Oleh: ${log.userName}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                        {isPositive ? "+" : ""}{qtyVal.toFixed(2)} {log.unit}
                      </span>
                      <p className="text-[9px] text-slate-500 mt-0.5">
                        {new Date(log.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* CRUD / RESTOCK / ADJUSTMENT MODALS */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-50/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 animate-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4 capitalize">
              {modalType === "create" && "Tambah Bahan Baku Baru"}
              {modalType === "edit" && `Edit Bahan Baku: ${selectedIng?.name}`}
              {modalType === "restock" && `Restock (Tambah Stok): ${selectedIng?.name}`}
              {modalType === "adjustment" && `Penyesuaian Stok: ${selectedIng?.name}`}
            </h3>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-200 text-xs flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs flex gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Form fields based on Modal Type */}
              {(modalType === "create" || modalType === "edit") && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Bahan Baku</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                      placeholder="Gula Pasir"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Satuan</label>
                      <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                      >
                        <option value="kg">kg (Kilogram)</option>
                        <option value="gram">gram (Gram)</option>
                        <option value="liter">liter (Liter)</option>
                        <option value="pcs">pcs (Pcs)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Harga Beli / Satuan</label>
                      <input
                        type="number"
                        required
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                        placeholder="18000"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Batas Stok Minimum</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={minStock}
                        onChange={(e) => setMinStock(e.target.value)}
                        className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                        placeholder="2"
                        min="0"
                      />
                    </div>

                    {modalType === "create" && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Stok Awal</label>
                        <input
                          type="number"
                          step="any"
                          value={stock}
                          onChange={(e) => setStock(e.target.value)}
                          className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {modalType === "restock" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Jumlah Restock ({selectedIng?.unit})</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={actionQty}
                      onChange={(e) => setActionQty(e.target.value)}
                      className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                      placeholder="10"
                      min="0.001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Nomor Referensi (Opsional)</label>
                    <input
                      type="text"
                      value={actionRef}
                      onChange={(e) => setActionRef(e.target.value)}
                      className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                      placeholder="PO-2026-001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Total Biaya Pembelian (Rp) <span className="text-slate-500 font-normal">— Opsional, otomatis tercatat di Arus Kas</span></label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={purchaseCost}
                      onChange={(e) => setPurchaseCost(e.target.value)}
                      className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                      placeholder="Misal: 150000"
                    />
                  </div>
                </>
              )}

              {modalType === "adjustment" && (
                <>
                  <div className="p-3 bg-amber-950/40 border border-amber-900 rounded-lg text-amber-200 text-xs flex gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Stok Saat Ini: {selectedIng?.stock.toFixed(2)} {selectedIng?.unit}</p>
                      <p className="mt-0.5">Gunakan angka negatif untuk mengurangi stok (misal: -2) dan angka positif untuk menambah/koreksi ke atas.</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Jumlah Penyesuaian ({selectedIng?.unit})</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={actionQty}
                      onChange={(e) => setActionQty(e.target.value)}
                      className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                      placeholder="Contoh: -1.5 atau 2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Alasan Penyesuaian</label>
                    <select
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                    >
                      <option value="waste">Waste (Sisa Produksi/Dibuang)</option>
                      <option value="expired">Expired (Bahan Kadaluarsa)</option>
                      <option value="correction">Correction (Koreksi Selisih Opname)</option>
                      <option value="damage">Damage (Kerusakan Penyimpanan)</option>
                    </select>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-slate-200 hover:bg-white rounded-xl text-slate-500 hover:text-slate-800 text-sm font-semibold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/10 text-sm flex items-center gap-1.5"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

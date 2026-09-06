"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
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
  ClipboardCheck,
  X,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatQty = (val: number | string) => {
  const num = typeof val === "number" ? val : parseFloat(val);
  return isNaN(num) ? "0" : parseFloat(num.toFixed(3)).toString();
};

export default function IngredientsPage() {
  const { data: ingredients, error: ingError, mutate: mutateIng } = useSWR("/api/ingredients", fetcher);
  const { data: movements, error: movError, mutate: mutateMov } = useSWR("/api/ingredients/movements", fetcher);
  const { data: userSession } = useSWR("/api/auth/me", fetcher);

  const isAdmin = userSession?.user?.role === "admin";

  // State controls
  const [modalType, setModalType] = useState<"create" | "edit" | "restock" | "adjustment" | "produce" | null>(null);
  const [selectedIng, setSelectedIng] = useState<any>(null);
  
  // Form fields
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [price, setPrice] = useState("");
  const [minStock, setMinStock] = useState("");
  const [stock, setStock] = useState(""); // for initial creation
  const [type, setType] = useState<"raw" | "intermediate">("raw");
  const [yieldQty, setYieldQty] = useState("1");
  const [recipeRows, setRecipeRows] = useState<any[]>([{ childIngredientId: 0, qty: "" }]);
  
  // Actions fields
  const [actionQty, setActionQty] = useState("");
  const [actionReason, setActionReason] = useState("correction");
  const [actionRef, setActionRef] = useState("");
  const [purchaseCost, setPurchaseCost] = useState(""); // optional: total biaya restock
  const [paymentGroup, setPaymentGroup] = useState<"tunai" | "non_tunai">("tunai");

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
    setType("raw");
    setYieldQty("1");
    setRecipeRows([{ childIngredientId: 0, qty: "" }]);
    setActionQty("");
    setActionReason("correction");
    setActionRef("");
    setPurchaseCost("");
    setPaymentGroup("tunai");
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleOpenModal = (typeVal: "create" | "edit" | "restock" | "adjustment" | "produce", item: any = null) => {
    resetForm();
    setSelectedIng(item);
    setModalType(typeVal);

    if (item) {
      setName(item.name);
      setUnit(item.unit);
      setPrice(item.price.toString());
      setMinStock(item.minStock.toString());
      setType(item.type || "raw");
      setYieldQty(item.yieldQty ? item.yieldQty.toString() : "1");
      if (item.recipes && item.recipes.length > 0) {
        setRecipeRows(item.recipes.map((r: any) => ({ childIngredientId: r.childIngredientId, qty: r.qty.toString() })));
      } else {
        setRecipeRows([{ childIngredientId: 0, qty: "" }]);
      }
    }
  };

  const handleCloseModal = () => {
    setModalType(null);
    setSelectedIng(null);
    resetForm();
  };

  // Real-time HPP calculation for intermediate ingredients in Modal
  const [liveHpp, setLiveHpp] = useState(0);
  const { data: allIngredients } = useSWR("/api/ingredients", fetcher);
  
  require("react").useEffect(() => {
    if (type !== "intermediate" || !allIngredients) return;
    let totalCost = 0;
    for (const row of recipeRows) {
      const childId = row.childIngredientId;
      const rowQty = parseFloat(row.qty || "0");
      if (childId > 0 && rowQty > 0) {
        const ing = allIngredients.find((i: any) => i.id === childId);
        if (ing) {
          totalCost += rowQty * ing.price;
        }
      }
    }
    const yieldVal = parseFloat(yieldQty || "1");
    setLiveHpp(yieldVal > 0 ? totalCost / yieldVal : 0);
  }, [recipeRows, yieldQty, type, allIngredients]);

  const handleAddRecipeRow = () => {
    setRecipeRows([...recipeRows, { childIngredientId: 0, qty: "" }]);
  };

  const handleRemoveRecipeRow = (index: number) => {
    const updated = recipeRows.filter((_, i) => i !== index);
    setRecipeRows(updated.length > 0 ? updated : [{ childIngredientId: 0, qty: "" }]);
  };

  const handleRecipeChange = (index: number, field: string, value: any) => {
    const updated = [...recipeRows];
    updated[index] = { ...updated[index], [field]: value };
    setRecipeRows(updated);
  };

  const isProduceShortage = (() => {
    if (modalType !== "produce" || !selectedIng || !allIngredients) return false;
    const unitsToProduce = parseFloat(actionQty) || 0;
    const yieldVal = parseFloat(selectedIng.yieldQty) || 1;
    const multiplierVal = unitsToProduce > 0 ? unitsToProduce / yieldVal : 0;
    for (const r of selectedIng.recipes || []) {
      const reqQty = r.qty * multiplierVal;
      const ingObj = allIngredients.find((i: any) => i.id === r.childIngredientId);
      const avail = ingObj ? ingObj.stock : 0;
      if (avail < reqQty) return true;
    }
    return false;
  })();

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
          body: JSON.stringify({
            name,
            unit,
            price: type === "intermediate" ? liveHpp : parseFloat(price),
            minStock: parseFloat(minStock || "0"),
            stock: parseFloat(stock || "0"),
            type,
            yieldQty: type === "intermediate" ? parseFloat(yieldQty) : 1,
            recipes: type === "intermediate"
              ? recipeRows
                  .filter((r) => r.childIngredientId > 0 && parseFloat(r.qty) > 0)
                  .map((r) => ({ childIngredientId: r.childIngredientId, qty: parseFloat(r.qty) }))
              : undefined,
          }),
        });
      } else if (modalType === "edit") {
        res = await fetch(`/api/ingredients/${selectedIng.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            unit,
            price: type === "intermediate" ? liveHpp : parseFloat(price),
            minStock: parseFloat(minStock || "0"),
            type,
            yieldQty: type === "intermediate" ? parseFloat(yieldQty) : 1,
            recipes: type === "intermediate"
              ? recipeRows
                  .filter((r) => r.childIngredientId > 0 && parseFloat(r.qty) > 0)
                  .map((r) => ({ childIngredientId: r.childIngredientId, qty: parseFloat(r.qty) }))
              : undefined,
          }),
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
            paymentGroup: paymentGroup,
          }),
        });
      } else if (modalType === "adjustment") {
        res = await fetch("/api/ingredients/adjustment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ingredientId: selectedIng.id, qty: parseFloat(actionQty), reason: actionReason }),
        });
      } else if (modalType === "produce") {
        res = await fetch("/api/ingredients/production", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ingredientId: selectedIng.id,
            unitsProduced: parseFloat(actionQty),
          }),
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
        <div className="flex flex-wrap items-center gap-2.5 self-start">
          <Link
            href="/dashboard/ingredients/waste"
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-semibold transition-all text-xs"
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
            Catat Waste
          </Link>
          <Link
            href="/dashboard/ingredients/opname"
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-semibold transition-all text-xs"
          >
            <ClipboardCheck className="w-4 h-4 text-blue-500" />
            Stock Opname
          </Link>
          {isAdmin && (
            <button
              onClick={() => handleOpenModal("create")}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold shadow-md active:scale-[0.98] transition-all text-xs"
            >
              <Plus className="w-4 h-4" />
              Tambah Bahan
            </button>
          )}
        </div>
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
                      <td className="px-6 py-4.5 font-medium text-slate-800">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{item.name}</span>
                          {item.type === "intermediate" && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 uppercase tracking-wider shrink-0">
                              Setengah Jadi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4.5">{formatRupiah(item.price)} / {item.unit}</td>
                      <td className="px-6 py-4.5 font-semibold text-slate-900">
                        {formatQty(item.stock)} <span className="text-xs text-slate-500">{item.unit}</span>
                      </td>
                      <td className="px-6 py-4.5 text-slate-500">
                        {formatQty(item.minStock)} <span className="text-xs">{item.unit}</span>
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
                      <td className="px-6 py-4.5 text-right space-x-1.5 whitespace-nowrap">
                        {isAdmin ? (
                          <>
                            {item.type === "intermediate" && (
                              <button
                                onClick={() => handleOpenModal("produce", item)}
                                className="px-2.5 py-1 text-xs font-semibold bg-purple-950 border border-purple-900 text-purple-400 hover:bg-purple-900 hover:text-white rounded-lg transition-all"
                                title="Produksi (Olah Bahan)"
                              >
                                Produksi
                              </button>
                            )}
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
                        {isPositive ? "+" : ""}{formatQty(qtyVal)} {log.unit}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-50/80 backdrop-blur-sm overflow-y-auto">
          <div className={`w-full ${(modalType === "create" || modalType === "edit") && type === "intermediate" ? "max-w-2xl" : "max-w-md"} bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto my-8`}>
            <h3 className="text-lg font-bold text-slate-900 mb-4 capitalize">
              {modalType === "create" && "Tambah Bahan Baku Baru"}
              {modalType === "edit" && `Edit Bahan Baku: ${selectedIng?.name}`}
              {modalType === "restock" && `Restock (Tambah Stok): ${selectedIng?.name}`}
              {modalType === "adjustment" && `Penyesuaian Stok: ${selectedIng?.name}`}
              {modalType === "produce" && `Produksi Bahan Setengah Jadi: ${selectedIng?.name}`}
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
                  <div className="grid grid-cols-2 gap-4">
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

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Tipe Bahan Baku</label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as any)}
                        className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500 font-medium"
                      >
                        <option value="raw">Mentah (Raw Material)</option>
                        <option value="intermediate">Setengah Jadi (Sub-Recipe)</option>
                      </select>
                    </div>
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
                        <option value="tusuk">tusuk (Tusuk Sate)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">
                        {type === "intermediate" ? "Estimasi Cost / Satuan (Auto)" : "Harga Beli / Satuan (Rp)"}
                      </label>
                      <input
                        type="number"
                        required={type !== "intermediate"}
                        disabled={type === "intermediate"}
                        value={type === "intermediate" ? liveHpp.toFixed(0) : price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500 disabled:opacity-75 disabled:bg-slate-100"
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

                    {modalType === "create" && type === "raw" && (
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

                    {type === "intermediate" && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Yield (Hasil per Batch Resep)</label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={yieldQty}
                          onChange={(e) => setYieldQty(e.target.value)}
                          className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500 font-semibold text-orange-600"
                          placeholder="Misal: 1000 untuk 1kg sambal"
                          min="0.001"
                        />
                      </div>
                    )}
                  </div>

                  {/* Sub-Recipe Builder */}
                  {type === "intermediate" && (
                    <div className="border-t border-slate-200 pt-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Resep Penyusun</h4>
                        <button
                          type="button"
                          onClick={handleAddRecipeRow}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-orange-50 text-orange-600 border border-orange-200 rounded hover:bg-orange-600 hover:text-white transition-all flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Tambah Bahan
                        </button>
                      </div>

                      <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1">
                        {recipeRows.map((row, idx) => (
                          <div key={idx} className="flex gap-3 items-center">
                            <div className="flex-1">
                              <select
                                value={row.childIngredientId}
                                onChange={(e) => handleRecipeChange(idx, "childIngredientId", parseInt(e.target.value))}
                                className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                              >
                                <option value={0}>Pilih Bahan Penyusun...</option>
                                {ingredients
                                  ?.filter((ing: any) => ing.id !== selectedIng?.id && ing.type !== "intermediate") // Prevent circular reference
                                  ?.map((ing: any) => (
                                    <option key={ing.id} value={ing.id}>
                                      {ing.name} ({formatRupiah(ing.price)}/{ing.unit})
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div className="w-32 flex items-center gap-2">
                              <input
                                type="number"
                                step="any"
                                required
                                value={row.qty}
                                onChange={(e) => handleRecipeChange(idx, "qty", e.target.value)}
                                className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                                placeholder="Jumlah"
                                min="0.001"
                              />
                              <span className="text-xs text-slate-500 uppercase tracking-wide w-10 truncate">
                                {ingredients?.find((i: any) => i.id === row.childIngredientId)?.unit || ""}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveRecipeRow(idx)}
                              className="p-2 border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 rounded-lg transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                  {purchaseCost && parseFloat(purchaseCost) > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Dibayar dengan <span className="text-red-400">*</span></label>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setPaymentGroup("tunai")}
                          className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                            paymentGroup === "tunai"
                              ? "bg-orange-500/10 border-orange-500 text-orange-600"
                              : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700"
                          }`}>
                          💵 Tunai
                        </button>
                        <button type="button" onClick={() => setPaymentGroup("non_tunai")}
                          className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                            paymentGroup === "non_tunai"
                              ? "bg-blue-500/10 border-blue-500 text-blue-600"
                              : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700"
                          }`}>
                          💳 Non-Tunai
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {modalType === "adjustment" && (
                <>
                  <div className="p-3 bg-amber-950/40 border border-amber-900 rounded-lg text-amber-200 text-xs flex gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Stok Saat Ini: {formatQty(selectedIng?.stock)} {selectedIng?.unit}</p>
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

              {modalType === "produce" && (
                <>
                  <div className="p-3 bg-purple-950/40 border border-purple-900 rounded-lg text-purple-200 text-xs mb-2">
                    <p className="font-semibold">Stok Saat Ini: {formatQty(selectedIng?.stock)} {selectedIng?.unit}</p>
                    <p className="mt-0.5">Produksi bahan olahan setengah jadi akan otomatis mengurangi stok bahan mentahnya.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Jumlah Produksi ({selectedIng?.unit})</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={actionQty}
                      onChange={(e) => setActionQty(e.target.value)}
                      className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                      placeholder="Contoh: 1000"
                      min="0.001"
                    />
                  </div>
                  
                  {/* Required child materials display */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs mt-3.5 space-y-2">
                    <h4 className="font-bold text-slate-700">Kebutuhan Bahan Mentah</h4>
                    {(() => {
                      const unitsToProduce = parseFloat(actionQty) || 0;
                      const yieldVal = parseFloat(selectedIng?.yieldQty) || 1;
                      const multiplierVal = unitsToProduce > 0 ? unitsToProduce / yieldVal : 0;
                      return (
                        <div className="space-y-2">
                          {selectedIng?.recipes?.map((r: any, idx: number) => {
                            const reqQty = r.qty * multiplierVal;
                            const ingObj = allIngredients?.find((i: any) => i.id === r.childIngredientId);
                            const avail = ingObj ? ingObj.stock : 0;
                            const isShort = avail < reqQty;
                            return (
                              <div key={idx} className="flex justify-between items-center text-slate-600">
                                <span>{r.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-800">{formatQty(reqQty)} {r.unit}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isShort ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"}`}>
                                    Stok: {formatQty(avail)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
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
                  disabled={loading || (modalType === "produce" && (isProduceShortage || !actionQty || parseFloat(actionQty) <= 0))}
                  className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/10 text-sm flex items-center gap-1.5"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {modalType === "produce" ? "Produksi Bahan" : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Loader2,
  CheckCircle,
  Percent,
  TrendingUp,
  X,
  PackagePlus,
  History,
} from "lucide-react";
import ProduksiModal from "./ProduksiModal";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface RecipeRow {
  ingredientId: number;
  qty: string;
}

export default function ProductsPage() {
  const { data: products, error: prodError, mutate: mutateProd } = useSWR("/api/products", fetcher);
  const { data: ingredients } = useSWR("/api/ingredients", fetcher);
  const { data: userSession } = useSWR("/api/auth/me", fetcher);

  const isAdmin = userSession?.user?.role === "admin";

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedProd, setSelectedProd] = useState<any>(null);
  const [produksiProd, setProduksiProd] = useState<any>(null);

  // Form states
  const [name, setName] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [yieldQty, setYieldQty] = useState("1");
  const [minStock, setMinStock] = useState("0");
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([
    { ingredientId: 0, qty: "" },
  ]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);
  };

  const handleOpenCreate = () => {
    setIsEditMode(false);
    setSelectedProd(null);
    setName("");
    setSellPrice("");
    setYieldQty("1");
    setMinStock("0");
    setRecipeRows([{ ingredientId: 0, qty: "" }]);
    setErrorMsg("");
    setSuccessMsg("");
    setModalOpen(true);
  };

  const handleOpenEdit = (prod: any) => {
    setIsEditMode(true);
    setSelectedProd(prod);
    setName(prod.name);
    setSellPrice(prod.sellPrice.toString());
    setYieldQty(prod.yieldQty.toString());
    setMinStock(prod.minStock ? prod.minStock.toString() : "0");
    
    // Populate recipes
    const rows = prod.recipes.map((r: any) => ({
      ingredientId: r.ingredientId,
      qty: r.qty.toString(),
    }));
    setRecipeRows(rows.length > 0 ? rows : [{ ingredientId: 0, qty: "" }]);
    
    setErrorMsg("");
    setSuccessMsg("");
    setModalOpen(true);
  };

  const handleAddRecipeRow = () => {
    setRecipeRows([...recipeRows, { ingredientId: 0, qty: "" }]);
  };

  const handleRemoveRecipeRow = (index: number) => {
    const updated = recipeRows.filter((_, i) => i !== index);
    setRecipeRows(updated.length > 0 ? updated : [{ ingredientId: 0, qty: "" }]);
  };

  const handleRecipeChange = (index: number, field: keyof RecipeRow, value: any) => {
    const updated = [...recipeRows];
    updated[index] = { ...updated[index], [field]: value };
    setRecipeRows(updated);
  };

  // Real-time dynamic HPP & Margin calculation inside Modal
  const [liveMetrics, setLiveMetrics] = useState({ hppPerPorsi: 0, margin: 0, marginPercent: 0 });

  useEffect(() => {
    if (!ingredients) return;

    let totalCost = 0;
    for (const row of recipeRows) {
      const ingId = row.ingredientId;
      const rowQty = parseFloat(row.qty || "0");
      if (ingId > 0 && rowQty > 0) {
        const ing = ingredients.find((i: any) => i.id === ingId);
        if (ing) {
          totalCost += rowQty * ing.price;
        }
      }
    }

    const yieldQtyVal = parseFloat(yieldQty || "1");
    const sellPriceVal = parseFloat(sellPrice || "0");
    const hpp = yieldQtyVal > 0 ? totalCost / yieldQtyVal : 0;
    const marginVal = sellPriceVal - hpp;
    const marginPercentVal = sellPriceVal > 0 ? (marginVal / sellPriceVal) * 100 : 0;

    setLiveMetrics({
      hppPerPorsi: hpp,
      margin: marginVal,
      marginPercent: marginPercentVal,
    });
  }, [recipeRows, yieldQty, sellPrice, ingredients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    // Validate recipe selection
    const cleanRecipes = recipeRows.filter((r) => r.ingredientId > 0 && parseFloat(r.qty) > 0);
    if (cleanRecipes.length === 0) {
      setErrorMsg("Harap tambahkan minimal 1 bahan baku yang valid ke dalam resep.");
      setLoading(false);
      return;
    }

    const payload = {
      name,
      sellPrice: parseFloat(sellPrice),
      yieldQty: parseFloat(yieldQty),
      minStock: parseFloat(minStock),
      recipes: cleanRecipes.map((r) => ({
        ingredientId: r.ingredientId,
        qty: parseFloat(r.qty),
      })),
    };

    try {
      const url = isEditMode ? `/api/products/${selectedProd.id}` : "/api/products";
      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Operasi produk gagal.");

      setSuccessMsg("Berhasil menyimpan produk.");
      mutateProd();
      setTimeout(() => {
        setModalOpen(false);
        resetForm();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan.");
    } finally {
      setLoading(false);
    }
  };

  const handleDiscontinue = async (prod: any) => {
    if (!confirm(`Apakah Anda yakin ingin menonaktifkan produk ${prod.name}?`)) return;
    try {
      const res = await fetch(`/api/products/${prod.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menonaktifkan.");
      mutateProd();
    } catch (err: any) {
      alert(err.message || "Gagal menonaktifkan.");
    }
  };

  const resetForm = () => {
    setName("");
    setSellPrice("");
    setYieldQty("1");
    setMinStock("0");
    setRecipeRows([{ ingredientId: 0, qty: "" }]);
    setErrorMsg("");
    setSuccessMsg("");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Produk & Resep HPP</h1>
          <p className="text-slate-500 mt-1">Kelola menu makanan, resep bahan baku, margin, dan harga pokok penjualan</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="self-start flex items-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Tambah Menu Makanan
          </button>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 overflow-hidden">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Menu & Analisis Profit</h3>

        {!products ? (
          <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
            <span>Memuat data produk...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-slate-500">Belum ada menu produk aktif.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs uppercase tracking-wider text-slate-500 bg-slate-50/40">
                <tr>
                  <th className="px-6 py-4 rounded-l-xl">Nama Produk</th>
                  <th className="px-6 py-4">Stok Saat Ini</th>
                  <th className="px-6 py-4">Harga Jual</th>
                  <th className="px-6 py-4">HPP / Porsi</th>
                  <th className="px-6 py-4">Margin Bersih</th>
                  <th className="px-6 py-4">Margin %</th>
                  <th className="px-6 py-4 text-right rounded-r-xl">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products.map((prod: any) => (
                  <tr key={prod.id} className="hover:bg-slate-50/20 transition-all">
                    <td className="px-6 py-4.5">
                      <div className="font-semibold text-slate-800">{prod.name}</div>
                      <div className="text-[10px] text-slate-500 mt-1 max-w-xs truncate">
                        Bahan: {prod.recipes.map((r: any) => `${r.name} (${r.qty}${r.unit})`).join(", ")}
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{parseFloat(prod.currentStock).toFixed(2)}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          parseFloat(prod.currentStock) <= 0
                            ? "bg-rose-100 text-rose-600"
                            : parseFloat(prod.currentStock) <= parseFloat(prod.minStock)
                            ? "bg-amber-100 text-amber-600"
                            : "bg-emerald-100 text-emerald-600"
                        }`}>
                          {parseFloat(prod.currentStock) <= 0
                            ? "Habis"
                            : parseFloat(prod.currentStock) <= parseFloat(prod.minStock)
                            ? "Menipis"
                            : "Ready"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5 font-medium text-slate-800">{formatRupiah(prod.sellPrice)}</td>
                    <td className="px-6 py-4.5 text-slate-600">{formatRupiah(prod.hppPerPorsi)}</td>
                    <td className="px-6 py-4.5 font-semibold text-emerald-400">{formatRupiah(prod.margin)}</td>
                    <td className="px-6 py-4.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                        prod.marginPercent >= 50
                          ? "bg-emerald-950 border border-emerald-900 text-emerald-400"
                          : prod.marginPercent >= 25
                          ? "bg-blue-950 border border-blue-900 text-blue-400"
                          : "bg-amber-950 border border-amber-900 text-amber-400"
                      }`}>
                        <TrendingUp className="w-3 h-3" />
                        {prod.marginPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-right space-x-1.5">
                      {isAdmin ? (
                        <>
                          <button
                            onClick={() => setProduksiProd(prod)}
                            className="p-1.5 bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 hover:border-orange-300 rounded-lg transition-all inline-flex items-center"
                            title="Produksi Produk"
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            href={`/dashboard/products/${prod.id}/stock`}
                            className="p-1.5 bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 rounded-lg transition-all inline-flex items-center"
                            title="Riwayat Stok"
                          >
                            <History className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => handleOpenEdit(prod)}
                            className="p-1.5 bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 rounded-lg transition-all inline-flex items-center"
                            title="Edit Resep & Harga"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDiscontinue(prod)}
                            className="p-1.5 bg-slate-50 border border-slate-200 text-rose-400 hover:bg-rose-950/40 hover:border-rose-900 rounded-lg transition-all inline-flex items-center"
                            title="Nonaktifkan (Soft Delete)"
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

      {/* PRODUKSI MODAL */}
      {produksiProd && (
        <ProduksiModal
          product={produksiProd}
          onClose={() => setProduksiProd(null)}
          onSuccess={() => {
            setProduksiProd(null);
            mutateProd();
          }}
        />
      )}

      {/* CREATE & EDIT DIALOG MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-50/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 animate-in zoom-in duration-200 my-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 capitalize">
                {isEditMode ? `Edit Resep & Produk: ${selectedProd?.name}` : "Buat Menu Resep Baru"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

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

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Product Basic Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Makanan / Produk</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                    placeholder="Nasi Goreng Ayam"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Harga Jual per Porsi (Rp)</label>
                  <input
                    type="number"
                    required
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                    placeholder="15000"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Yield (Porsi per Batch Resep)</label>
                  <input
                    type="number"
                    required
                    value={yieldQty}
                    onChange={(e) => setYieldQty(e.target.value)}
                    className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                    placeholder="1"
                    min="0.001"
                    step="any"
                  />
                </div>
              </div>

              {/* Min Stock Field */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Batas Stok Minimum (Alert Menipis)</label>
                  <input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                    placeholder="0"
                    min="0"
                    step="any"
                  />
                </div>
              </div>

              {/* Dynamic Recipe Editor */}
              <div className="border-t border-slate-850 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Komposisi Resep Bahan</h4>
                  <button
                    type="button"
                    onClick={handleAddRecipeRow}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-950 text-orange-500 border border-indigo-900 rounded hover:bg-indigo-900 hover:text-white transition-all flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Tambah Bahan
                  </button>
                </div>

                <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1">
                  {recipeRows.map((row, idx) => (
                    <div key={idx} className="flex gap-3 items-center">
                      <div className="flex-1">
                        <select
                          value={row.ingredientId}
                          onChange={(e) => handleRecipeChange(idx, "ingredientId", parseInt(e.target.value))}
                          className="w-full bg-slate-50/40 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                        >
                          <option value={0}>Pilih Bahan Baku...</option>
                          {ingredients?.map((ing: any) => (
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
                          {ingredients?.find((i: any) => i.id === row.ingredientId)?.unit || ""}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveRecipeRow(idx)}
                        className="p-2 border border-slate-200 text-rose-400 hover:bg-rose-950/20 hover:border-rose-950 rounded-lg transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic calculations result panel */}
              <div className="bg-slate-50/40 p-4 border border-slate-200 rounded-xl grid grid-cols-3 gap-4 text-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">HPP / Porsi</span>
                  <p className="text-lg font-bold text-slate-800 mt-1">{formatRupiah(liveMetrics.hppPerPorsi)}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Margin Bersih</span>
                  <p className={`text-lg font-bold mt-1 ${liveMetrics.margin >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatRupiah(liveMetrics.margin)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Margin %</span>
                  <p className="text-lg font-bold text-orange-500 mt-1">{liveMetrics.marginPercent.toFixed(1)}%</p>
                </div>
              </div>

              {/* Footer action buttons */}
              <div className="flex gap-3 justify-end pt-2 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

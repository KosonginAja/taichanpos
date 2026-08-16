"use client";

import { useState } from "react";
import { Loader2, X, AlertTriangle } from "lucide-react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ProduksiModalProps {
  product: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProduksiModal({ product, onClose, onSuccess }: ProduksiModalProps) {
  const [units, setUnits] = useState("1");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const { data: ingredients } = useSWR("/api/ingredients", fetcher);

  const unitsProduced = parseFloat(units) || 0;
  const yieldQty = parseFloat(product.yieldQty) || 1;
  const multiplier = unitsProduced > 0 ? unitsProduced / yieldQty : 0;

  // Calculate required ingredients
  const requiredMaterials = product.recipes.map((r: any) => {
    const requiredQty = parseFloat(r.qty) * multiplier;
    const ing = ingredients?.find((i: any) => i.id === r.ingredientId);
    const availableQty = ing ? parseFloat(ing.stock) : 0;
    const isShort = availableQty < requiredQty;
    return {
      name: r.name,
      unit: r.unit || (ing ? ing.unit : ""),
      requiredQty,
      availableQty,
      isShort,
    };
  });

  const hasShortage = requiredMaterials.some((m: any) => m.isShort);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasShortage) {
      setErrorMsg("Bahan baku tidak mencukupi untuk jumlah produksi ini.");
      return;
    }
    
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/productions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          unitsProduced,
          note,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal produksi");
      
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800">Produksi: {product.name}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Jumlah Porsi yang Diproduksi</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              required
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:bg-white transition-all font-medium"
              placeholder="Contoh: 10"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Catatan (Opsional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:bg-white transition-all"
              placeholder="Shift pagi, batch 1..."
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="text-sm font-bold text-slate-700 mb-3">Kebutuhan Bahan Baku</h4>
            {!ingredients ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Memuat stok gudang...
              </div>
            ) : (
              <div className="space-y-2">
                {requiredMaterials.map((m: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">{m.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{m.requiredQty.toFixed(2)} {m.unit}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${m.isShort ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        Stok: {m.availableQty.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || hasShortage || unitsProduced <= 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-md"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Proses Produksi
          </button>
        </div>
      </div>
    </div>
  );
}

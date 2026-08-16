"use client";

import { useState } from "react";
import useSWR from "swr";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, PackagePlus, ShoppingCart, RotateCcw, Settings2, Filter } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TYPE_LABELS: Record<string, { label: string; color: string; icon: any; sign: string }> = {
  production: { label: "Produksi", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: PackagePlus, sign: "+" },
  sale: { label: "Penjualan", color: "text-rose-600 bg-rose-50 border-rose-200", icon: ShoppingCart, sign: "-" },
  return: { label: "Retur", color: "text-blue-600 bg-blue-50 border-blue-200", icon: RotateCcw, sign: "+" },
  adjustment: { label: "Penyesuaian", color: "text-amber-600 bg-amber-50 border-amber-200", icon: Settings2, sign: "±" },
};

export default function ProductStockPage() {
  const { id } = useParams<{ id: string }>();
  const [filterType, setFilterType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const params = new URLSearchParams();
  if (filterType !== "all") params.set("type", filterType);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);

  const { data, error } = useSWR(
    `/api/products/${id}/stock?${params.toString()}`,
    fetcher
  );

  const formatQty = (qty: number) => {
    return qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(2);
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/products"
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Riwayat Stok Produk
          </h1>
          {data?.product && (
            <p className="text-slate-500 text-sm mt-0.5">
              {data.product.name} • Stok sekarang:{" "}
              <span className="font-semibold text-slate-800">
                {formatQty(data.product.currentStock)} porsi
              </span>
              {data.product.minStock > 0 && (
                <span className="ml-2 text-amber-600">
                  (Min: {formatQty(data.product.minStock)})
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          >
            <option value="all">Semua Jenis</option>
            <option value="production">Produksi</option>
            <option value="sale">Penjualan</option>
            <option value="return">Retur</option>
            <option value="adjustment">Penyesuaian</option>
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          />
          <span className="text-slate-400 text-sm">s/d</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          />
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {!data ? (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            <span>Memuat riwayat stok...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500">{error.message || "Gagal memuat data."}</div>
        ) : data.movements.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Tidak ada riwayat mutasi stok ditemukan.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase tracking-wider text-slate-500 bg-slate-50/60 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Waktu</th>
                <th className="px-6 py-4">Jenis</th>
                <th className="px-6 py-4">Jumlah</th>
                <th className="px-6 py-4">Referensi</th>
                <th className="px-6 py-4">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.movements.map((m: any) => {
                const typeInfo = TYPE_LABELS[m.type] || { label: m.type, color: "text-slate-600", icon: Filter, sign: "" };
                const Icon = typeInfo.icon;
                const isPositive = m.type === "production" || m.type === "return";
                return (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap">
                      {formatDate(m.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${typeInfo.color}`}>
                        <Icon className="w-3 h-3" />
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold text-base ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                        {isPositive ? "+" : "-"}{formatQty(Math.abs(m.qty))} porsi
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                      {m.refId || "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {m.reason || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

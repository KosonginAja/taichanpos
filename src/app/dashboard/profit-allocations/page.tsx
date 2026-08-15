"use client";

import useSWR from "swr";
import { PieChart, Calendar, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ProfitAllocationsHistoryPage() {
  const { data: userSession } = useSWR("/api/auth/me", fetcher);
  const isAdmin = userSession?.user?.role === "admin";
  const { data: allocations, error, isLoading } = useSWR(isAdmin ? "/api/profit-allocations" : null, fetcher);

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fmt = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  if (!isAdmin && userSession) {
    return <div className="flex h-full items-center justify-center text-slate-500">Anda tidak memiliki akses ke halaman ini.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <PieChart className="w-6 h-6 text-orange-500" />
            Riwayat Alokasi Laba
          </h1>
          <p className="text-slate-500 text-sm mt-1">Arsip histori pembagian laba bersih periode sebelumnya (sistem lama). Alokasi kini berjalan otomatis via <a href="/dashboard/pockets" className="text-orange-500 hover:underline">Kantong Kas</a>.</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 text-red-400 border border-red-500/30 p-4 rounded-xl">
          Gagal memuat riwayat alokasi laba.
        </div>
      )}

      {allocations && (
        <div className="space-y-4">
          {allocations.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
              <PieChart className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Belum ada riwayat alokasi laba.</p>
              <p className="text-sm mt-1">Riwayat alokasi manual kosong. Alokasi kini berjalan <strong>otomatis</strong> via <a href="/dashboard/pockets" className="text-orange-500 hover:underline">Kantong Kas</a>.</p>
            </div>
          ) : (
            allocations.map((alloc: any) => (
              <div key={alloc.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all">
                <div
                  className="p-5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-100/50"
                  onClick={() => setExpandedId(expandedId === alloc.id ? null : alloc.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center text-orange-500 shrink-0">
                      <PieChart className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-slate-800 font-bold">Alokasi Laba</h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {alloc.periodStart} s/d {alloc.periodEnd}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Laba Bersih</p>
                      <p className="text-emerald-400 font-bold mt-0.5">{fmt(alloc.netProfit)}</p>
                    </div>
                    <div className="text-slate-500">
                      {expandedId === alloc.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {expandedId === alloc.id && (
                  <div className="p-5 pt-2 border-t border-slate-200 bg-slate-50/30 animate-in slide-in-from-top-2 duration-200">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Rincian Pembagian</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {alloc.items.map((item: any) => (
                        <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <p className="text-slate-800 text-sm font-medium">{item.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{item.percentage}% · {item.isRetained ? "Kas Perusahaan" : "Kas Keluar"}</p>
                          </div>
                          <p className={`font-bold ${item.isRetained ? "text-orange-500" : "text-red-400"}`}>
                            {fmt(item.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200/50 flex justify-between items-center text-xs text-slate-500">
                      <span>Dibuat pada: {new Date(alloc.createdAt).toLocaleString("id-ID")}</span>
                      <span>Status: <span className="text-emerald-400 font-medium uppercase">{alloc.status}</span></span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

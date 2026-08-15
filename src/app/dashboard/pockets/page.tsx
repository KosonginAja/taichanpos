"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatRp(n: number) {
  return "Rp" + Math.abs(n).toLocaleString("id-ID");
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PocketsPage() {
  const { data: pockets, isLoading } = useSWR("/api/pocket-summary", fetcher, {
    refreshInterval: 30000,
  });
  const [expanded, setExpanded] = useState<number | null>(null);

  const totalBalance = pockets?.reduce((s: number, p: any) => s + p.balance, 0) ?? 0;

  const toggleExpand = (id: number) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-orange-500" /> Kantong Kas
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Ringkasan saldo setiap kantong kas dan riwayat transaksinya secara real-time.
        </p>
      </div>

      {/* Total Balance Card */}
      <div className="bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border border-orange-500/30 rounded-2xl p-6">
        <p className="text-sm text-purple-300 font-medium uppercase tracking-widest mb-1">
          Total Semua Kantong
        </p>
        <p className="text-4xl font-bold text-white tracking-tight">
          {isLoading ? "..." : formatRp(totalBalance)}
        </p>
      </div>

      {/* Pocket Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      ) : pockets?.length === 0 ? (
        <div className="text-center py-20 text-slate-500 text-sm">
          Belum ada kantong kas. Tambahkan di Pengaturan Usaha.
        </div>
      ) : (
        <div className="space-y-4">
          {pockets?.map((pocket: any) => {
            const isExpanded = expanded === pocket.id;
            const isCost = pocket.type === "cost";

            return (
              <div
                key={pocket.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all"
              >
                {/* Pocket Header */}
                <button
                  onClick={() => toggleExpand(pocket.id)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-slate-100/50 transition-colors text-left"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isCost
                        ? "bg-amber-500/15 border border-amber-500/30"
                        : "bg-purple-500/15 border border-orange-500/30"
                    }`}
                  >
                    {isCost ? (
                      <Package
                        className={`w-5 h-5 ${isCost ? "text-amber-400" : "text-orange-500"}`}
                      />
                    ) : (
                      <Wallet className="w-5 h-5 text-orange-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-900 font-semibold">{pocket.label}</span>
                      {isCost && (
                        <span className="text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                          Biaya Modal
                        </span>
                      )}
                      {pocket.type === "profit_share" && pocket.percentage != null && (
                        <span className="text-[10px] bg-purple-500/10 border border-orange-500/30 text-orange-500 px-2 py-0.5 rounded-full font-bold">
                          {pocket.percentage}% Profit
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {pocket.transactions?.length ?? 0} transaksi
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p
                      className={`text-xl font-bold tabular-nums ${
                        pocket.balance >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {pocket.balance < 0 ? "-" : ""}
                      {formatRp(pocket.balance)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Saldo</p>
                  </div>

                  <div className="ml-2 text-slate-500">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Transactions List */}
                {isExpanded && (
                  <div className="border-t border-slate-200">
                    {pocket.transactions.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-sm">
                        Belum ada transaksi di kantong ini.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
                        {pocket.transactions.map((tx: any) => (
                          <div
                            key={tx.id}
                            className="flex items-center gap-3 px-5 py-3 hover:bg-slate-100/30 transition-colors"
                          >
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                                tx.direction === "credit"
                                  ? "bg-emerald-500/15"
                                  : "bg-red-500/15"
                              }`}
                            >
                              {tx.direction === "credit" ? (
                                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <ArrowDownLeft className="w-3.5 h-3.5 text-red-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-600 truncate">{tx.note || tx.sourceType}</p>
                              <p className="text-[10px] text-slate-500">{formatDate(tx.createdAt)}</p>
                            </div>
                            <span
                              className={`text-sm font-bold tabular-nums flex-shrink-0 ${
                                tx.direction === "credit" ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
                              {tx.direction === "credit" ? "+" : "-"}
                              {formatRp(tx.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

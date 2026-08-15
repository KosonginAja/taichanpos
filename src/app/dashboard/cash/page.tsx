"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  Filter,
  Wallet,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Category presets by type
const CATEGORIES_IN = [
  { label: "Modal Disetor", isOperational: false },
  { label: "Pinjaman", isOperational: false },
  { label: "Pendapatan Lain-lain", isOperational: true },
];
const CATEGORIES_OUT = [
  { label: "Gaji", isOperational: true },
  { label: "Sewa", isOperational: true },
  { label: "Listrik", isOperational: true },
  { label: "Transport", isOperational: true },
  { label: "Pembelian Aset", isOperational: false },
  { label: "Bayar Utang", isOperational: false },
  { label: "Prive / Ambilan Pribadi", isOperational: false },
  { label: "Lainnya", isOperational: true },
];

export default function CashPage() {
  const { data: userSession } = useSWR("/api/auth/me", fetcher);
  const { data: pockets } = useSWR("/api/cash-pockets", fetcher);
  const isAdmin = userSession?.user?.role === "admin";

  const [filterType, setFilterType] = useState<"" | "in" | "out">("");
  const [filterDate, setFilterDate] = useState("");

  const params = new URLSearchParams();
  if (filterType) params.set("type", filterType);
  if (filterDate) { params.set("startDate", filterDate); params.set("endDate", filterDate); }

  const { data: transactions, error, mutate } = useSWR(`/api/cash-transactions?${params}`, fetcher);

  const [showModal, setShowModal] = useState(false);
  const [txType, setTxType] = useState<"in" | "out">("out");
  const [category, setCategory] = useState("Lainnya");
  const [isOperational, setIsOperational] = useState(true);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");

  const [pocketId, setPocketId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const formatRupiah = (v: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v);

  const categoryList = txType === "in" ? CATEGORIES_IN : CATEGORIES_OUT;

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    const preset = categoryList.find((c) => c.label === cat);
    if (preset !== undefined) setIsOperational(preset.isOperational);
  };

  const handleTypeToggle = (t: "in" | "out") => {
    setTxType(t);
    const list = t === "in" ? CATEGORIES_IN : CATEGORIES_OUT;
    const first = list[0];
    setCategory(first.label);
    setIsOperational(first.isOperational);
  };

  const openModal = (defaultType: "in" | "out" = "out") => {
    handleTypeToggle(defaultType);
    setDescription(""); setAmount(""); setNote(""); setPocketId(null);
    setDate(new Date().toISOString().split("T")[0]);
    setErrorMsg(""); setSuccessMsg("");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErrorMsg("");
    try {
      const res = await fetch("/api/cash-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: txType, category, isOperational, description, amount: parseFloat(amount), date, note, pocketId: pocketId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowModal(false);
      setSuccessMsg("Transaksi kas berhasil dicatat.");
      mutate();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus transaksi kas ini?")) return;
    setLoading(true); setErrorMsg("");
    try {
      const res = await fetch(`/api/cash-transactions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccessMsg("Berhasil dihapus.");
      mutate();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menghapus.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin && userSession) {
    return <div className="flex h-full items-center justify-center text-slate-500">Anda tidak memiliki akses ke halaman ini.</div>;
  }

  const totalIn = transactions?.filter((t: any) => t.type === "in").reduce((s: number, t: any) => s + t.amount, 0) ?? 0;
  const totalOut = transactions?.filter((t: any) => t.type === "out").reduce((s: number, t: any) => s + t.amount, 0) ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-emerald-400" />
          Arus Kas
        </h1>
        <div className="flex gap-2">
          <button onClick={() => openModal("in")} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/20">
            <ArrowUpCircle className="w-4 h-4" /> Kas Masuk
          </button>
          <button onClick={() => openModal("out")} className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-red-500/20">
            <ArrowDownCircle className="w-4 h-4" /> Kas Keluar
          </button>
        </div>
      </div>

      {errorMsg && <div className="bg-red-500/20 text-red-400 border border-red-500/30 p-4 rounded-xl text-sm">{errorMsg}</div>}
      {successMsg && <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 p-4 rounded-xl flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4" />{successMsg}</div>}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5">
          <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Total Kas Masuk</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatRupiah(totalIn)}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
          <p className="text-xs text-red-400 font-semibold uppercase tracking-wider">Total Kas Keluar</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{formatRupiah(totalOut)}</p>
        </div>
        <div className={`rounded-2xl p-5 border ${(totalIn - totalOut) >= 0 ? "bg-indigo-500/10 border-orange-500/20" : "bg-orange-500/10 border-orange-500/20"}`}>
          <p className={`text-xs font-semibold uppercase tracking-wider ${(totalIn - totalOut) >= 0 ? "text-orange-500" : "text-orange-400"}`}>Selisih Periode Ini</p>
          <p className={`text-2xl font-bold mt-1 ${(totalIn - totalOut) >= 0 ? "text-orange-500" : "text-orange-400"}`}>{formatRupiah(totalIn - totalOut)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Jenis</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 focus:outline-none focus:border-orange-500">
            <option value="">Semua</option>
            <option value="in">Kas Masuk</option>
            <option value="out">Kas Keluar</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Tanggal</label>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 focus:outline-none focus:border-orange-500" />
        </div>
        {(filterType || filterDate) && (
          <button onClick={() => { setFilterType(""); setFilterDate(""); }} className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-2 transition-colors">Reset</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-500 bg-slate-50/50 uppercase border-b border-slate-200">
              <tr>
                <th className="px-5 py-4 font-semibold">Tanggal</th>
                <th className="px-5 py-4 font-semibold">Jenis</th>
                <th className="px-5 py-4 font-semibold">Kategori</th>
                <th className="px-5 py-4 font-semibold">Deskripsi</th>
                <th className="px-5 py-4 font-semibold">Sumber</th>
                <th className="px-5 py-4 font-semibold text-right">Jumlah</th>
                <th className="px-5 py-4 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {!transactions ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500 text-sm">Tidak ada data transaksi kas.</td></tr>
              ) : (
                transactions.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-slate-100/40 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap text-slate-600 text-xs">
                      {new Date(tx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4">
                      {tx.type === "in" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-xs font-semibold">
                          <ArrowUpCircle className="w-3 h-3" /> Masuk
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full text-xs font-semibold">
                          <ArrowDownCircle className="w-3 h-3" /> Keluar
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="bg-slate-100 text-orange-500 px-2 py-0.5 rounded-md text-xs">{tx.category}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-800 text-sm">{tx.description}</div>
                      {tx.note && <div className="text-xs text-slate-500 mt-0.5">{tx.note}</div>}
                    </td>
                    <td className="px-5 py-4">
                      {tx.sourceType === "manual" ? (
                        <span className="text-xs text-slate-500">Manual</span>
                      ) : (
                        <span className="text-xs bg-indigo-500/10 border border-orange-500/20 text-orange-500 px-2 py-0.5 rounded-full font-semibold">
                          Auto ({tx.sourceType})
                        </span>
                      )}
                    </td>
                    <td className={`px-5 py-4 text-right font-semibold whitespace-nowrap ${tx.type === "in" ? "text-emerald-400" : "text-red-400"}`}>
                      {tx.type === "in" ? "+" : "-"}{formatRupiah(tx.amount)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {tx.sourceType === "manual" ? (
                        <button onClick={() => handleDelete(tx.id)} disabled={loading} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-700 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">Catat Transaksi Kas</h3>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Toggle In/Out */}
              <div className="grid grid-cols-2 gap-2">
                {(["in", "out"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => handleTypeToggle(t)}
                    className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${txType === t
                      ? t === "in" ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-red-500/10 border-red-500 text-red-400"
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-600"
                    }`}>
                    {t === "in" ? "↑ Kas Masuk" : "↓ Kas Keluar"}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Tanggal</label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Kategori</label>
                <select value={category} onChange={(e) => handleCategoryChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500">
                  {categoryList.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-3 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3">
                <input type="checkbox" id="isOp" checked={isOperational} onChange={(e) => setIsOperational(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
                <label htmlFor="isOp" className="text-sm text-slate-600 cursor-pointer">
                  Hitung ke Laba Rugi <span className="text-slate-500 text-xs">(isOperational)</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Deskripsi</label>
                <input type="text" required placeholder={txType === "in" ? "Misal: Modal awal dari owner" : "Misal: Gaji karyawan Juli"} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Jumlah (Rp)</label>
                <input type="number" step="any" min="0" required placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Catatan (Opsional)</label>
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500" />
              </div>

              {txType === "out" && pockets && pockets.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Ambil dari Kantong Kas <span className="text-slate-600">(Opsional)</span></label>
                  <select value={pocketId ?? ""} onChange={(e) => setPocketId(e.target.value ? parseInt(e.target.value) : null)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500">
                    <option value="">— Tidak dari kantong tertentu —</option>
                    {pockets.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.label} ({p.type === 'cost' ? 'HPP' : `${p.percentage}%`})</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-600 mt-1">Jika dipilih, kas keluar ini akan dicatat sebagai debit di kantong terkait.</p>
                </div>
              )}

              {errorMsg && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl">{errorMsg}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-700 text-slate-600 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors">Batal</button>
                <button type="submit" disabled={loading} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center transition-colors">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

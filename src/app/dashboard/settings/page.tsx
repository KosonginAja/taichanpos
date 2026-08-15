"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Store, Save, Image as ImageIcon, Loader2, CheckCircle, Percent, Plus, Trash2, PieChart, AlertTriangle } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SettingsPage() {
  const { data: settings, error, mutate } = useSWR("/api/settings", fetcher);
  const { data: userSession } = useSWR("/api/auth/me", fetcher);
  const { data: pockets, mutate: mutatePockets } = useSWR("/api/cash-pockets", fetcher);

  const isAdmin = userSession?.user?.role === "admin";

  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [receiptFooterNote, setReceiptFooterNote] = useState("");
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxPercent, setTaxPercent] = useState("");
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargePercent, setServiceChargePercent] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("Rp");
  const [defaultReceiptSize, setDefaultReceiptSize] = useState("58mm");
  const [roundingEnabled, setRoundingEnabled] = useState(false);
  const [roundingNearest, setRoundingNearest] = useState("100");
  const [logoUrl, setLogoUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Allocation rule form state
  const [newLabel, setNewLabel] = useState("");
  const [newPct, setNewPct] = useState("");
  const [newRetained, setNewRetained] = useState(false);
  const [pocketLoading, setPocketLoading] = useState(false);
  const [pocketMsg, setPocketMsg] = useState("");

  // Cleanup state
  const [cleanupDate, setCleanupDate] = useState("");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState("");

  useEffect(() => {
    if (settings && !error) {
      setBusinessName(settings.businessName || "");
      setAddress(settings.address || "");
      setPhone(settings.phone || "");
      setReceiptFooterNote(settings.receiptFooterNote || "");
      setTaxEnabled(settings.taxEnabled || false);
      setTaxPercent(settings.taxPercent ? settings.taxPercent.toString() : "0");
      setServiceChargeEnabled(settings.serviceChargeEnabled || false);
      setServiceChargePercent(settings.serviceChargePercent ? settings.serviceChargePercent.toString() : "0");
      setCurrencySymbol(settings.currencySymbol || "Rp");
      setDefaultReceiptSize(settings.defaultReceiptSize || "58mm");
      setRoundingEnabled(settings.roundingEnabled || false);
      setRoundingNearest(settings.roundingNearest ? settings.roundingNearest.toString() : "100");
      setLogoUrl(settings.logoUrl || "");
    }
  }, [settings, error]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErrorMsg(""); setSuccessMsg("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName, address, phone, receiptFooterNote,
          taxEnabled, taxPercent: parseFloat(taxPercent || "0"),
          serviceChargeEnabled, serviceChargePercent: parseFloat(serviceChargePercent || "0"),
          currencySymbol, defaultReceiptSize, logoUrl,
          roundingEnabled, roundingNearest,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccessMsg("Pengaturan berhasil disimpan.");
      mutate();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPocket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel || !newPct) return;
    setPocketLoading(true); setPocketMsg("");
    try {
      const res = await fetch("/api/cash-pockets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newLabel,
          type: "profit_share",
          percentage: parseFloat(newPct),
          sortOrder: pockets?.length ?? 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewLabel(""); setNewPct("");
      mutatePockets();
    } catch (err: any) {
      setPocketMsg(err.message || "Gagal menambah kantong.");
    } finally {
      setPocketLoading(false);
    }
  };

  const handleCleanup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanupDate) return;
    if (!confirm(`PERINGATAN: Semua pesanan, arus kas, dan histori stok sebelum ${cleanupDate} akan dihapus PERMANEN. Laba Rugi periode tersebut tidak bisa ditarik lagi. Lanjutkan?`)) return;
    setCleanupLoading(true); setCleanupMsg("");
    try {
      const res = await fetch(`/api/cleanup?cutoffDate=${cleanupDate}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCleanupMsg(`Sukses: ${data.deletedCount.orders} Pesanan, ${data.deletedCount.cashTransactions} Transaksi Kas, ${data.deletedCount.stockMovements} Mutasi Stok berhasil dihapus.`);
    } catch (err: any) {
      setCleanupMsg(err.message || "Gagal membersihkan data.");
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleDeletePocket = async (id: number) => {
    if (!confirm("Hapus kantong kas ini?")) return;
    await fetch(`/api/cash-pockets/${id}`, { method: "DELETE" });
    mutatePockets();
  };

  const totalPct = pockets?.filter((p: any) => p.type === "profit_share" && p.isActive).reduce((s: number, p: any) => s + parseFloat(p.percentage || "0"), 0) ?? 0;
  const isPctValid = Math.abs(totalPct - 100) < 0.01;

  if (!isAdmin && userSession) {
    return <div className="flex h-full items-center justify-center text-slate-500">Anda tidak memiliki akses ke halaman ini.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Store className="w-6 h-6 text-orange-500" /> Pengaturan Usaha
        </h1>
        <p className="text-slate-500 text-sm mt-1">Konfigurasi identitas bisnis, struk, dan finansial.</p>
      </div>

      {errorMsg && <div className="bg-red-500/20 text-red-400 border border-red-500/30 p-4 rounded-xl text-sm">{errorMsg}</div>}
      {successMsg && <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 p-4 rounded-xl flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4" />{successMsg}</div>}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Identitas Bisnis */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Store className="w-4 h-4 text-orange-500" /> Identitas Bisnis
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Nama Usaha</label>
              <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Gweh Food Corner" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">No. Telepon</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812-3456-7890" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Alamat</label>
            <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jln. Raya Makanan Enak No.12" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Footer Note Struk</label>
            <input type="text" value={receiptFooterNote} onChange={(e) => setReceiptFooterNote(e.target.value)} placeholder="Terima Kasih Atas Kunjungan Anda" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Logo Struk</label>
            <div className="flex items-center gap-4">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain bg-white rounded-lg p-1 border border-slate-300" />}
              <label className="cursor-pointer bg-slate-100 hover:bg-slate-700 text-slate-600 px-4 py-2 rounded-xl text-sm border border-slate-300 transition-colors">
                <ImageIcon className="w-4 h-4 inline mr-1.5" />Pilih Gambar
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
              {logoUrl && <button type="button" onClick={() => setLogoUrl("")} className="text-xs text-red-400 hover:text-red-300">Hapus</button>}
            </div>
          </div>
        </div>

        {/* Finansial */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Percent className="w-4 h-4 text-amber-400" /> Finansial
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-200 rounded-xl">
              <div>
                <p className="text-sm font-medium text-slate-800">Pajak (PPN)</p>
                <p className="text-xs text-slate-500">Dihitung dari subtotal + SC</p>
              </div>
              <button type="button" onClick={() => setTaxEnabled(!taxEnabled)} className={`w-12 h-6 rounded-full transition-colors ${taxEnabled ? "bg-orange-500" : "bg-slate-700"}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${taxEnabled ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>
            {taxEnabled && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Persentase Pajak (%)</label>
                <input type="number" step="any" min="0" max="100" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500" />
              </div>
            )}
            <div className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-200 rounded-xl">
              <div>
                <p className="text-sm font-medium text-slate-800">Service Charge</p>
                <p className="text-xs text-slate-500">Dihitung dari subtotal</p>
              </div>
              <button type="button" onClick={() => setServiceChargeEnabled(!serviceChargeEnabled)} className={`w-12 h-6 rounded-full transition-colors ${serviceChargeEnabled ? "bg-orange-500" : "bg-slate-700"}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${serviceChargeEnabled ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>
            {serviceChargeEnabled && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Persentase SC (%)</label>
                <input type="number" step="any" min="0" max="100" value={serviceChargePercent} onChange={(e) => setServiceChargePercent(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Simbol Mata Uang</label>
              <input type="text" value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Ukuran Struk Default</label>
              <select value={defaultReceiptSize} onChange={(e) => setDefaultReceiptSize(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500">
                <option value="58mm">Thermal 58mm</option>
                <option value="80mm">Thermal 80mm</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-200 rounded-xl">
              <div>
                <p className="text-sm font-medium text-slate-800">Pembulatan Total Bayar</p>
                <p className="text-xs text-slate-500">Otomatis bulat ke pecahan terdekat</p>
              </div>
              <button type="button" onClick={() => setRoundingEnabled(!roundingEnabled)} className={`w-12 h-6 rounded-full transition-colors ${roundingEnabled ? "bg-orange-500" : "bg-slate-700"}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${roundingEnabled ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>
            {roundingEnabled && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Kelipatan Pembulatan</label>
                <select value={roundingNearest} onChange={(e) => setRoundingNearest(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange-500">
                  <option value="100">100 (Rp100)</option>
                  <option value="500">500 (Rp500)</option>
                  <option value="1000">1000 (Rp1.000)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Simpan Pengaturan
        </button>
      </form>

      {/* ====== KANTONG KAS ====== */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-orange-500" /> Kantong Kas (Profit Share)
          </h2>
          <div className={`text-sm font-bold px-3 py-1 rounded-full border ${isPctValid && pockets?.filter((p: any) => p.type === 'profit_share').length > 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400"}`}>
            {totalPct.toFixed(1)}% / 100%
          </div>
        </div>

        {!isPctValid && pockets?.filter((p: any) => p.type === 'profit_share').length > 0 && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-300 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Total persentase profit share harus tepat 100% agar alokasi otomatis berjalan lancar. Sekarang: <strong>{totalPct.toFixed(2)}%</strong></span>
          </div>
        )}

        <p className="text-xs text-slate-500">
          Setiap ada pesanan masuk, Laba Bersih pesanan (setelah dikurangi HPP) akan otomatis dibagi ke kantong-kantong di bawah ini berdasarkan persentasenya. Kantong <strong>HPP (Bahan Baku)</strong> akan otomatis mendapat sebesar nilai HPP. Selisih pembulatan tagihan akan masuk ke kantong "Kas Perusahaan".
        </p>

        <div className="space-y-2">
          {!pockets ? (
            <div className="text-center py-4"><Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-500" /></div>
          ) : pockets.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-4 italic">Belum ada kantong kas.</div>
          ) : (
            pockets.map((pocket: any) => (
              <div key={pocket.id} className="flex items-center gap-3 bg-slate-50/60 border border-slate-200 rounded-xl px-4 py-3">
                <div className="flex-1">
                  <span className="text-slate-800 text-sm font-medium">{pocket.label}</span>
                  {pocket.type === "cost" && (
                    <span className="ml-2 text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Biaya Modal (HPP)</span>
                  )}
                  {pocket.label === "Kas Perusahaan" && (
                    <span className="ml-2 text-[10px] bg-indigo-500/10 border border-orange-500/30 text-orange-500 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Default Pembulatan</span>
                  )}
                </div>
                {pocket.type === "profit_share" && (
                  <>
                    <span className="text-orange-500 font-bold text-sm w-16 text-right">{pocket.percentage}%</span>
                    <button onClick={() => handleDeletePocket(pocket.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleAddPocket} className="flex flex-wrap gap-2 items-end pt-3 border-t border-slate-200">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Label Kantong Baru</label>
            <input type="text" required placeholder="Gaji Bonus" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-orange-500" />
          </div>
          <div className="w-24">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">% Laba</label>
            <input type="number" required step="any" min="0" max="100" placeholder="15" value={newPct} onChange={(e) => setNewPct(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-orange-500" />
          </div>
          <button type="submit" disabled={pocketLoading} className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50">
            {pocketLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Tambah Kantong
          </button>
        </form>
        {pocketMsg && <p className="text-red-400 text-sm">{pocketMsg}</p>}
      </div>

      {/* ====== DATA CLEANUP ====== */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-rose-500" /> Manajemen Penyimpanan & Pembersihan Data
        </h2>
        <p className="text-xs text-slate-500">
          Database memiliki batas penyimpanan. Untuk menjaga performa, hapus data transaksi lama (Pesanan, Arus Kas, Pergerakan Stok, dll) yang sudah tidak diperlukan. 
          <strong className="text-rose-400 block mt-1">PERINGATAN: Laporan untuk periode yang telah dihapus tidak akan bisa dilihat kembali. Lakukan ekspor/backup terlebih dahulu.</strong>
        </p>

        <form onSubmit={handleCleanup} className="flex flex-wrap gap-3 items-end pt-2">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-500 mb-1.5">Hapus Semua Data Sebelum Tanggal</label>
            <input 
              type="date" 
              required 
              value={cleanupDate} 
              onChange={(e) => setCleanupDate(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-rose-500/50" 
            />
          </div>
          <button 
            type="submit" 
            disabled={cleanupLoading || !cleanupDate} 
            className="bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {cleanupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} 
            Hapus Permanen
          </button>
        </form>
        {cleanupMsg && (
          <p className={`text-sm ${cleanupMsg.includes("Sukses") ? "text-emerald-400" : "text-rose-400"}`}>
            {cleanupMsg}
          </p>
        )}
      </div>
    </div>
  );
}

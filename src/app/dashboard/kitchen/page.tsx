"use client";

import { useEffect, useState, useRef } from "react";
import {
  Clock,
  CheckCircle2,
  Flame,
  Printer,
  RefreshCw,
  Volume2,
  VolumeX,
  RotateCcw,
  ChefHat,
  AlertTriangle,
  Check
} from "lucide-react";

interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  qty: number;
  sellPrice: number;
}

interface Order {
  id: number;
  orderNumber: string;
  date: string;
  orderType: "dine_in" | "takeaway" | "delivery";
  tableNo: string | null;
  customerName: string | null;
  status: "open" | "paid" | "cancelled";
  kitchenStatus: "pending" | "preparing" | "ready" | "served";
  items: OrderItem[];
  grandTotal: number;
}

export default function KitchenDisplayPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "served">("active");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(10);
  const [now, setNow] = useState(Date.now());
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({}); // key: `${orderId}-${itemIndex}`
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Audio Context chime for kitchen alert
  const prevOrderCountRef = useRef<number>(0);

  const playChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const nowTime = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, nowTime); // D5
      osc1.frequency.setValueAtTime(880, nowTime + 0.15); // A5

      gain.gain.setValueAtTime(0.3, nowTime);
      gain.gain.exponentialRampToValueAtTime(0.001, nowTime + 0.5);

      osc1.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(nowTime);
      osc1.stop(nowTime + 0.5);
    } catch (e) {
      console.warn("Audio chime not allowed or supported:", e);
    }
  };

  // Fetch orders from API
  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data: Order[] = await res.json();
        // Sort: pending first, then preparing, then ready, then served (most recent first)
        const activeOrRecent = data.filter((o) => {
          if (o.status === "cancelled") return false;
          // Show all active (pending, preparing, ready)
          if (["pending", "preparing", "ready"].includes(o.kitchenStatus || "pending")) return true;
          // If served, only show orders from today
          const orderDate = new Date(o.date);
          const today = new Date();
          return (
            orderDate.getDate() === today.getDate() &&
            orderDate.getMonth() === today.getMonth() &&
            orderDate.getFullYear() === today.getFullYear()
          );
        });

        // Check if there are new active orders to trigger chime
        const activeCount = activeOrRecent.filter(
          (o) => (o.kitchenStatus || "pending") !== "served"
        ).length;
        if (soundEnabled && prevOrderCountRef.current > 0 && activeCount > prevOrderCountRef.current) {
          playChime();
        }
        prevOrderCountRef.current = activeCount;

        setOrders(activeOrRecent);
      }
    } catch (err) {
      console.error("Error fetching kitchen orders:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Timer loop for now & countdown
  useEffect(() => {
    fetchOrders();

    const secondTimer = setInterval(() => {
      setNow(Date.now());
      if (autoRefresh) {
        setCountdown((prev) => {
          if (prev <= 1) {
            fetchOrders(true);
            return 10;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(secondTimer);
  }, [autoRefresh, soundEnabled]);

  // Update kitchen status
  const handleUpdateStatus = async (orderId: number, nextStatus: "pending" | "preparing" | "ready" | "served") => {
    setProcessingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/kitchen-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kitchenStatus: nextStatus }),
      });

      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, kitchenStatus: nextStatus } : o))
        );
      } else {
        const error = await res.json();
        alert(error.error || "Gagal mengupdate status dapur");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan jaringan");
    } finally {
      setProcessingId(null);
    }
  };

  // Toggle item completed strike-through
  const toggleItemDone = (orderId: number, idx: number) => {
    const key = `${orderId}-${idx}`;
    setCompletedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Print KOT
  const handlePrintKot = (order: Order) => {
    const paperWidth = "72mm";
    const itemsHtml = order.items
      .map(
        (i) => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dotted #ccc;font-size:14px">
          <span style="font-weight:bold">${i.productName}</span>
          <span style="font-size:16px;font-weight:900">x${i.qty}</span>
        </div>`
      )
      .join("");

    const divider = `<div style="border-top:1px dashed #444;margin:5px 0;"></div>`;
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KOT ${order.orderNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: ${paperWidth} auto; margin: 2mm; }
    html, body { width: ${paperWidth}; background: #fff; color: #000; font-family: 'Courier New', monospace; font-size: 12px; }
    body { padding: 3mm; }
  </style>
</head>
<body>
  <div style="text-align:center;font-weight:900;font-size:16px;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:6px">TIKET DAPUR (KOT)</div>
  <div style="font-size:14px;font-weight:900;text-transform:uppercase;margin-bottom:3px">${order.tableNo || "ANTREAN"}</div>
  <div style="font-size:11px;color:#333;margin-bottom:4px">
    <span>Tipe: <b>${order.orderType === "takeaway" ? "BUNGKUS / TAKEAWAY" : "MAKAN DI TEMPAT"}</b></span>
  </div>
  <div style="font-size:10px;line-height:1.5">
    <div>No: ${order.orderNumber}</div>
    <div>Waktu: ${new Date(order.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
    ${order.customerName ? `<div>Pelanggan: ${order.customerName}</div>` : ""}
  </div>
  ${divider}
  <div style="margin:6px 0">${itemsHtml}</div>
  ${divider}
  <div style="text-align:center;font-size:10px;color:#555;margin-top:5px">--- Layar Dapur (KDS) Reprint ---</div>
</body>
</html>`;

    const printWin = window.open("", "_blank", "width=400,height=600");
    if (!printWin) {
      alert("Gagal membuka jendela cetak. Pastikan pop-up diizinkan.");
      return;
    }
    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      printWin.close();
    }, 400);
  };

  // Helper for elapsed wait time
  const getElapsedMinutes = (dateStr: string) => {
    const diffMs = now - new Date(dateStr).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  const formatElapsed = (dateStr: string) => {
    const diffSec = Math.max(0, Math.floor((now - new Date(dateStr).getTime()) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Filter orders based on active tab
  const filteredOrders = orders.filter((o) => {
    const isServed = (o.kitchenStatus || "pending") === "served";
    if (activeTab === "active") return !isServed;
    return isServed;
  });

  // Metrics
  const activeOrders = orders.filter((o) => (o.kitchenStatus || "pending") !== "served");
  const servedCount = orders.filter((o) => o.kitchenStatus === "served").length;

  const urgentOrdersCount = activeOrders.filter((o) => getElapsedMinutes(o.date) >= 15).length;
  const avgWaitMinutes =
    activeOrders.length > 0
      ? Math.round(
          activeOrders.reduce((acc, o) => acc + getElapsedMinutes(o.date), 0) /
            activeOrders.length
        )
      : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Bar / Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-white uppercase">
                Kitchen Display System (KDS)
              </h1>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Antrean Pesanan Dapur Real-Time &bull; {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="hidden lg:flex items-center gap-3 text-xs">
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-slate-400">Antrean Masak:</span>
            <span className="font-bold text-white text-sm">{activeOrders.length}</span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Selesai Hari Ini:</span>
            <span className="font-bold text-white text-sm">{servedCount}</span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">Rata-rata Tunggu:</span>
            <span className="font-bold text-white text-sm">{avgWaitMinutes} mnt</span>
          </div>

          {urgentOrdersCount > 0 && (
            <div className="bg-rose-950/50 border border-rose-700/60 rounded-xl px-3 py-1.5 flex items-center gap-2 animate-pulse">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span className="text-rose-300 font-semibold">Prioritas (&gt;15m):</span>
              <span className="font-extrabold text-rose-300 text-sm">{urgentOrdersCount}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playChime();
            }}
            title={soundEnabled ? "Suara Notifikasi Aktif" : "Suara Dibisukan"}
            className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              soundEnabled
                ? "bg-emerald-950/40 border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/50"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? "Audio On" : "Mute"}</span>
          </button>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              autoRefresh
                ? "bg-blue-950/40 border-blue-700/50 text-blue-400 hover:bg-blue-900/50"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? "animate-spin" : ""}`} style={{ animationDuration: "6s" }} />
            <span className="hidden sm:inline">{autoRefresh ? `${countdown}s` : "Manual"}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => {
              fetchOrders(false);
              setCountdown(10);
            }}
            disabled={loading}
            className="p-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-md shadow-orange-950/50 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>
      </header>

      {/* Filter Tabs Navigation */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-2 shrink-0 flex items-center gap-2">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === "active"
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
              : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750"
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Antrean Masak</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
            activeTab === "active" ? "bg-white text-orange-600" : "bg-slate-700 text-slate-300"
          }`}>
            {activeOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("served")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === "served"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Selesai Hari Ini</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
            activeTab === "served" ? "bg-white text-emerald-700" : "bg-slate-700 text-slate-300"
          }`}>
            {servedCount}
          </span>
        </button>
      </div>

      {/* Main Board Grid Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900">
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-orange-500" />
            <p className="font-semibold text-sm">Memuat pesanan dapur...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-center text-slate-500">
            <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-4 shadow-inner">
              <ChefHat className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-300">
              {activeTab === "active" ? "Dapur Bersih & Santai!" : "Belum Ada Pesanan Selesai"}
            </h3>
            <p className="text-sm text-slate-400 max-w-sm mt-1">
              {activeTab === "active"
                ? "Semua pesanan sudah selesai dibuat. Tidak ada antrean yang menunggu saat ini."
                : "Pesanan yang telah diselesaikan hari ini akan muncul di sini."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map((order) => {
              const elapsedMins = getElapsedMinutes(order.date);
              const kStatus = order.kitchenStatus || "pending";
              const isUrgent = elapsedMins >= 15;
              const isWarning = elapsedMins >= 10 && elapsedMins < 15;

              // Border & Timer Color based on wait time and status
              let timerBg = "bg-emerald-950/60 text-emerald-300 border-emerald-800";
              let cardBorder = "border-slate-800 hover:border-slate-700";

              if (kStatus !== "served") {
                if (isUrgent) {
                  timerBg = "bg-rose-950/80 text-rose-300 border-rose-700 animate-pulse";
                  cardBorder = "border-rose-600/70 shadow-lg shadow-rose-950/30";
                } else if (isWarning) {
                  timerBg = "bg-amber-950/80 text-amber-300 border-amber-700";
                  cardBorder = "border-amber-600/60 shadow-lg shadow-amber-950/20";
                }
              }

              return (
                <div
                  key={order.id}
                  className={`bg-slate-900 rounded-2xl border ${cardBorder} flex flex-col overflow-hidden transition-all shadow-md`}
                >
                  {/* Card Header */}
                  <div className="p-3.5 bg-slate-850 border-b border-slate-800 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {/* Table / Order Type Badge */}
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                          order.orderType === "takeaway"
                            ? "bg-purple-950/80 border border-purple-700/60 text-purple-300"
                            : "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                        }`}>
                          {order.tableNo || (order.orderType === "takeaway" ? "Bungkus" : "Meja -")}
                        </span>

                        {/* Bill Status */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          order.status === "open"
                            ? "bg-blue-950/80 border border-blue-800 text-blue-300"
                            : "bg-emerald-950/80 border border-emerald-800 text-emerald-300"
                        }`}>
                          {order.status === "open" ? "Open Bill" : "Lunas"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400 font-bold">
                          {order.orderNumber}
                        </span>
                        {order.customerName && (
                          <span className="text-xs text-slate-300 font-medium truncate">
                            &bull; {order.customerName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Live Timer Badge */}
                    <div className="text-right shrink-0">
                      <div className={`px-2.5 py-1 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 ${timerBg}`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatElapsed(order.date)}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">
                        {new Date(order.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  {/* Items List (Body) */}
                  <div className="p-3.5 flex-1 space-y-2 overflow-y-auto max-h-72 divide-y divide-slate-800/60">
                    {order.items.map((item, idx) => {
                      const isItemDone = completedItems[`${order.id}-${idx}`];
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleItemDone(order.id, idx)}
                          className={`pt-2 first:pt-0 flex items-start justify-between gap-3 cursor-pointer select-none group transition-opacity ${
                            isItemDone ? "opacity-35 line-through" : "opacity-100"
                          }`}
                        >
                          <div className="flex items-start gap-2.5 flex-1">
                            <div className={`w-5 h-5 rounded-md border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                              isItemDone
                                ? "bg-emerald-600 border-emerald-500 text-white"
                                : "border-slate-700 group-hover:border-slate-500 bg-slate-800"
                            }`}>
                              {isItemDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <span className="text-sm font-bold text-slate-100 group-hover:text-white leading-tight">
                              {item.productName}
                            </span>
                          </div>

                          <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-orange-400 font-mono font-black text-sm shrink-0">
                            x{item.qty}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Card Footer / Status Action Controls */}
                  <div className="p-3 bg-slate-850/80 border-t border-slate-800 space-y-2.5">
                    {/* Status Badge & Quick Undo */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 text-[11px]">Status:</span>
                        <span className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] ${
                          kStatus !== "served"
                            ? "bg-amber-950/60 border border-amber-700/60 text-amber-300"
                            : "bg-emerald-950/60 border border-emerald-700/60 text-emerald-300"
                        }`}>
                          {kStatus !== "served" ? "⏳ Perlu Dimasak" : "✅ Selesai Dibuat"}
                        </span>
                      </div>

                      {/* Undo status button if already served */}
                      {kStatus === "served" && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, "pending")}
                          disabled={processingId === order.id}
                          title="Kembalikan ke Antrean Masak"
                          className="text-slate-400 hover:text-amber-300 p-1 rounded hover:bg-slate-800 flex items-center gap-1 text-[10px] font-semibold cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-400" />
                          <span>Batal Selesai</span>
                        </button>
                      )}
                    </div>

                    {/* Primary 1-Tap Action Button */}
                    <div className="grid grid-cols-4 gap-2">
                      {/* Reprint KOT */}
                      <button
                        onClick={() => handlePrintKot(order)}
                        title="Cetak Ulang Tiket Dapur (KOT)"
                        className="col-span-1 py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-colors text-xs font-semibold cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {/* 1-Tap Completion or Restore */}
                      {kStatus !== "served" ? (
                        <button
                          onClick={() => handleUpdateStatus(order.id, "served")}
                          disabled={processingId === order.id}
                          className="col-span-3 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                          <span>Pesanan Telah Dibuat</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(order.id, "pending")}
                          disabled={processingId === order.id}
                          className="col-span-3 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                          <span>Kembalikan ke Antrean</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

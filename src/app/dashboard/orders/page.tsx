"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ShoppingCart,
  History,
  User,
  Trash2,
  Plus,
  Minus,
  AlertTriangle,
  Printer,
  CheckCircle,
  Loader2,
  X,
  Search,
  Calendar,
  RotateCcw,
  Utensils,
  ChefHat,
  Clock,
  CreditCard,
  Receipt,
  ShoppingBag,
  Info,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CartItem {
  productId: number;
  name: string;
  qty: number;
  sellPrice: number;
}

export default function OrdersPage() {
  const { data: products, mutate: mutateProd } = useSWR("/api/products", fetcher);
  const { data: ingredients, mutate: mutateIng } = useSWR("/api/ingredients", fetcher);
  const { data: ordersHistory, mutate: mutateOrders } = useSWR("/api/orders", fetcher);
  const { data: userSession } = useSWR("/api/auth/me", fetcher);
  const { data: settings } = useSWR("/api/settings", fetcher);

  const cashierName = userSession?.user?.name || "Kasir";

  // Tab management: "pos" | "tables" | "history"
  const [activeTab, setActiveTab] = useState<"pos" | "tables" | "history">("pos");

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [historyStart, setHistoryStart] = useState("");
  const [historyEnd, setHistoryEnd] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");

  // Cart State & Order Options
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [tableNo, setTableNo] = useState("Meja 1");
  const [discountType, setDiscountType] = useState<"nominal" | "percent">("nominal");
  const [discountValue, setDiscountValue] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountReceived, setAmountReceived] = useState("");

  // Checkout warning
  const [stockWarnings, setStockWarnings] = useState<string[]>([]);
  const [hasStockError, setHasStockError] = useState(false);

  // Print modal State
  const [printOrder, setPrintOrder] = useState<any>(null);
  const [printMode, setPrintMode] = useState<"receipt" | "kot">("receipt");
  const [receiptWidth, setReceiptWidth] = useState<"58" | "80">("58");

  // Settle open order modal state
  const [settleOrder, setSettleOrder] = useState<any>(null);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState("cash");
  const [settleAmountReceived, setSettleAmountReceived] = useState("");
  const [settleLoading, setSettleLoading] = useState(false);
  const [settleError, setSettleError] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState("");

  // Cancel order modal state
  const [cancelModalOrder, setCancelModalOrder] = useState<any>(null);
  const [cancelIsPrepared, setCancelIsPrepared] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Calculate HPP & required ingredients on the fly for warnings (Hybrid MTO & MTS)
  useEffect(() => {
    if (!products || !ingredients || cart.length === 0) {
      setStockWarnings([]);
      setHasStockError(false);
      return;
    }

    const warnings: string[] = [];
    let isShort = false;
    const requiredIngsMap: { [ingId: number]: { name: string; unit: string; reqQty: number; avail: number } } = {};

    for (const item of cart) {
      const prod = products.find((p: any) => p.id === item.productId);
      if (!prod) continue;
      
      const isMTO = (prod.fulfillmentType || "make_to_order") === "make_to_order";
      if (!isMTO) {
        const currentStock = parseFloat(prod.currentStock?.toString() || "0");
        if (currentStock < item.qty) {
          isShort = true;
          const shortage = item.qty - currentStock;
          const fmt = (v: number) => parseFloat(v.toFixed(3)).toString();
          warnings.push(`Stok produk ${prod.name} kurang: butuh ${item.qty}, tersedia ${fmt(currentStock)} (kurang ${fmt(shortage)}).`);
        }
      } else {
        // Accumulate MTO ingredients
        const yieldVal = parseFloat(prod.yieldQty?.toString() || "1") || 1;
        for (const r of prod.recipes || []) {
          const rQty = parseFloat(r.qty?.toString() || "0");
          const needed = (rQty / yieldVal) * item.qty;
          const ingId = r.ingredientId;
          const ingObj = ingredients.find((i: any) => i.id === ingId);
          const avail = ingObj ? parseFloat(ingObj.stock?.toString() || "0") : 0;
          const ingName = ingObj ? ingObj.name : r.name || "Bahan";
          const ingUnit = ingObj ? ingObj.unit : r.unit || "";

          if (!requiredIngsMap[ingId]) {
            requiredIngsMap[ingId] = { name: ingName, unit: ingUnit, reqQty: needed, avail };
          } else {
            requiredIngsMap[ingId].reqQty += needed;
          }
        }
      }
    }

    for (const ingIdStr of Object.keys(requiredIngsMap)) {
      const req = requiredIngsMap[parseInt(ingIdStr)];
      if (req.avail < req.reqQty) {
        isShort = true;
        const shortage = req.reqQty - req.avail;
        const fmt = (v: number) => parseFloat(v.toFixed(3)).toString();
        warnings.push(`Bahan ${req.name} kurang: butuh ${fmt(req.reqQty)} ${req.unit}, tersedia ${fmt(req.avail)} ${req.unit} (kurang ${fmt(shortage)} ${req.unit}).`);
      }
    }

    setStockWarnings(warnings);
    setHasStockError(isShort);
  }, [cart, products, ingredients]);

  // Cart operations
  const handleAddToCart = (product: any) => {
    const existing = cart.find((item) => item.productId === product.id);
    if (existing) {
      setCart(cart.map((item) => item.productId === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { productId: product.id, name: product.name, qty: 1, sellPrice: product.sellPrice }]);
    }
  };

  const handleUpdateQty = (productId: number, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter((item) => item.productId !== productId));
    } else {
      setCart(cart.map((item) => item.productId === productId ? { ...item, qty } : item));
    }
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
    setCustomerName("");
    setDiscountValue("0");
    setAmountReceived("");
    setCheckoutError("");
    setCheckoutSuccess("");
  };

  // Math Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.qty * item.sellPrice, 0);
  
  const discountNominal =
    discountType === "nominal"
      ? parseFloat(discountValue || "0")
      : (cartSubtotal * parseFloat(discountValue || "0")) / 100;

  const afterDiscount = Math.max(0, cartSubtotal - discountNominal);

  // Taxes & Service Charge
  const taxEnabled = settings?.taxEnabled || false;
  const taxPercent = taxEnabled ? parseFloat(settings?.taxPercent || "0") : 0;
  const scEnabled = settings?.serviceChargeEnabled || false;
  const scPercent = scEnabled ? parseFloat(settings?.serviceChargePercent || "0") : 0;

  const serviceChargeAmount = (afterDiscount * scPercent) / 100;
  const taxAmount = ((afterDiscount + serviceChargeAmount) * taxPercent) / 100;

  const totalBill = afterDiscount + serviceChargeAmount + taxAmount;
  
  const roundingEnabled = settings?.roundingEnabled || false;
  const roundingNearest = parseFloat(settings?.roundingNearest || "100");
  let grandTotal = totalBill;
  let roundingAdjustment = 0;
  if (roundingEnabled) {
    grandTotal = Math.round(totalBill / roundingNearest) * roundingNearest;
    roundingAdjustment = grandTotal - totalBill;
  }

  const changeVal = amountReceived ? parseFloat(amountReceived) - grandTotal : 0;

  const handleCheckout = async (e: React.FormEvent, mode: "paid" | "open" = "paid") => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (hasStockError) {
      alert("Tidak dapat checkout. Stok bahan baku tidak mencukupi.");
      return;
    }
    if (mode === "paid" && paymentMethod === "cash" && (parseFloat(amountReceived || "0") < grandTotal)) {
      alert("Uang yang diterima kurang.");
      return;
    }

    setLoading(true);
    setCheckoutError("");
    setCheckoutSuccess("");

    const payload = {
      items: cart.map((c) => ({
        productId: c.productId,
        qty: c.qty,
      })),
      discount: discountNominal,
      taxAmount,
      serviceChargeAmount,
      paymentMethod: mode === "paid" ? paymentMethod : "unpaid",
      amountReceived: mode === "paid" && paymentMethod === "cash" ? parseFloat(amountReceived) : null,
      customerName: customerName || null,
      orderType,
      tableNo: orderType === "dine_in" ? (tableNo || "Meja 1") : (tableNo ? `Takeaway (${tableNo})` : "Takeaway"),
      status: mode,
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses pesanan.");

      setCheckoutSuccess(mode === "open" ? "Pesanan meja berhasil disimpan & dikirim ke dapur!" : "Pesanan berhasil dibayar!");
      
      // Load data for printing
      const orderToPrint = {
        ...data,
        items: cart, // use local layout for print details
        cashierName,
        orderType,
        tableNo: payload.tableNo,
      };
      setPrintOrder(orderToPrint);
      setPrintMode(mode === "open" ? "kot" : "receipt");

      // Mutate databases
      mutateIng();
      mutateProd();
      mutateOrders();
      
      // Clear cart
      handleClearCart();
    } catch (err: any) {
      setCheckoutError(err.message || "Gagal memproses pesanan.");
    } finally {
      setLoading(false);
    }
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleOrder) return;
    setSettleLoading(true);
    setSettleError("");

    try {
      const res = await fetch(`/api/orders/${settleOrder.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: settlePaymentMethod,
          amountReceived: settlePaymentMethod === "cash" ? parseFloat(settleAmountReceived) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyelesaikan pembayaran.");

      // Open print receipt modal
      setPrintOrder({
        ...settleOrder,
        paymentMethod: settlePaymentMethod,
        amountReceived: settleAmountReceived ? parseFloat(settleAmountReceived) : null,
        status: "paid",
      });
      setPrintMode("receipt");

      setSettleOrder(null);
      setSettleAmountReceived("");
      mutateOrders();
      mutateProd();
      mutateIng();
    } catch (err: any) {
      setSettleError(err.message || "Terjadi kesalahan saat pelunasan.");
    } finally {
      setSettleLoading(false);
    }
  };

  const handleCancelOrder = (order: any) => {
    setCancelModalOrder(order);
    setCancelIsPrepared(false);
    setCancelReason("");
  };

  const executeCancelOrder = async () => {
    if (!cancelModalOrder) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/orders/${cancelModalOrder.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPrepared: cancelIsPrepared,
          cancelReason: cancelReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membatalkan.");
      alert(data.message || `Pesanan ${cancelModalOrder.orderNumber} telah dibatalkan.`);
      setCancelModalOrder(null);
      mutateOrders();
      mutateIng();
      mutateProd();
    } catch (err: any) {
      alert(err.message || "Gagal membatalkan.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReprint = (order: any) => {
    setPrintOrder(order);
  };

  const handleTriggerPrint = () => {
    if (!printOrder) return;

    const paperWidth = receiptWidth === "58" ? "48mm" : "72mm";
    const fmtRp = (v: number) =>
      "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(v));

    const row = (label: string, value: string, bold = false) =>
      `<div style="display:flex;justify-content:space-between;${bold ? "font-weight:900;font-size:12px;" : ""}">
        <span>${label}</span><span>${value}</span>
      </div>`;

    const divider = `<div style="border-top:1px dashed #444;margin:4px 0;"></div>`;

    let htmlContent = "";

    if (printMode === "kot") {
      // Kitchen Order Ticket (KOT)
      const itemsHtml = printOrder.items
        .map(
          (i: any) => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dotted #ccc;font-size:13px">
            <span style="font-weight:bold">${i.name || i.productName}</span>
            <span style="font-size:15px;font-weight:900">x${i.qty}</span>
          </div>`
        )
        .join("");

      htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KOT ${printOrder.orderNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: ${paperWidth} auto; margin: 2mm; }
    html, body { width: ${paperWidth}; background: #fff; color: #000; font-family: 'Courier New', monospace; font-size: 11px; }
    body { padding: 2mm; }
  </style>
</head>
<body>
  <div style="text-align:center;font-weight:900;font-size:14px;border-bottom:2px solid #000;padding-bottom:3px;margin-bottom:5px">TIKET DAPUR (KOT)</div>
  <div style="font-size:13px;font-weight:900;text-transform:uppercase;margin-bottom:2px">${printOrder.tableNo || "MEJA / ANTREAN"}</div>
  <div style="font-size:10px;color:#333;margin-bottom:4px">
    <span>Tipe: <b>${printOrder.orderType === "takeaway" ? "BUNGKUS / TAKEAWAY" : "MAKAN DI TEMPAT"}</b></span>
  </div>
  <div style="font-size:9px;line-height:1.5">
    <div>No: ${printOrder.orderNumber}</div>
    <div>Waktu: ${new Date(printOrder.date || new Date()).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</div>
    ${printOrder.customerName ? `<div>Plg: ${printOrder.customerName}</div>` : ""}
    <div>Kasir: ${printOrder.cashierName || cashierName}</div>
  </div>
  ${divider}
  <div style="margin:6px 0">${itemsHtml}</div>
  ${divider}
  <div style="text-align:center;font-size:9px;color:#555;margin-top:4px">--- Harap Segera Diproses ---</div>
</body>
</html>`;
    } else {
      // Standard Customer Receipt
      const logoHtml = settings?.logoUrl
        ? `<div style="text-align:center;margin-bottom:2px"><img src="${settings.logoUrl}" style="max-height:28px;display:inline-block;filter:grayscale(1);" /></div>`
        : "";

      const itemsHtml = printOrder.items
        .map(
          (i: any) => `<div style="margin-bottom:4px">
            <div style="font-weight:600">${i.name || i.productName}</div>
            <div style="display:flex;justify-content:space-between;font-size:9px;padding-left:6px">
              <span>${i.qty} x ${fmtRp(i.sellPrice)}</span>
              <span>${fmtRp(i.qty * i.sellPrice)}</span>
            </div>
          </div>`
        )
        .join("");

      const discountAmt = parseFloat(printOrder.discount?.toString() || "0");
      const scAmt = parseFloat(printOrder.serviceChargeAmount?.toString() || "0");
      const taxAmt = parseFloat(printOrder.taxAmount?.toString() || "0");
      const roundingAdjAmt = parseFloat(printOrder.roundingAdjustment?.toString() || "0");
      const grandTotalAmt = parseFloat(printOrder.grandTotal?.toString() || printOrder.revenueTotal.toString());
      const cashReceived = parseFloat(printOrder.amountReceived?.toString() || "0");
      const changeAmt = parseFloat(printOrder.changeAmount?.toString() || "0");

      const totalsHtml = [
        row("Subtotal:", fmtRp(parseFloat(printOrder.subtotal.toString()))),
        discountAmt > 0 ? row("Diskon:", `-${fmtRp(discountAmt)}`) : "",
        scAmt > 0 ? row("Service Charge:", fmtRp(scAmt)) : "",
        taxAmt > 0 ? row("Pajak:", fmtRp(taxAmt)) : "",
        divider,
        roundingAdjAmt !== 0 ? row("Sebelum Pembulatan:", fmtRp(parseFloat(printOrder.revenueTotal.toString()))) : "",
        roundingAdjAmt !== 0 ? row("Pembulatan:", (roundingAdjAmt > 0 ? "+" : "") + fmtRp(roundingAdjAmt)) : "",
        row(roundingAdjAmt !== 0 ? "TOTAL BAYAR:" : "TOTAL:", fmtRp(grandTotalAmt), true),
        `<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:9px">
           <span>Metode:</span><span style="font-weight:700;text-transform:uppercase">${printOrder.paymentMethod}</span>
         </div>`,
        printOrder.paymentMethod === "cash"
          ? row("Diterima:", fmtRp(cashReceived)) +
            row("Kembali:", fmtRp(changeAmt))
          : "",
      ].join("");

      htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Struk ${printOrder.orderNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: ${paperWidth} auto; margin: 2mm 2mm 4mm 2mm; }
    html, body { width: ${paperWidth}; background: #fff; color: #000; font-family: 'Courier New', monospace; font-size: 11px; }
    body { padding: 2mm; }
  </style>
</head>
<body>
  ${logoHtml}
  <div style="text-align:center;font-weight:bold;font-size:13px;text-transform:uppercase">${settings?.businessName || "MY BUSINESS"}</div>
  <div style="text-align:center;font-size:9px;margin-top:1px">${settings?.address || ""}</div>
  ${settings?.phone ? `<div style="text-align:center;font-size:9px">Telp: ${settings.phone}</div>` : ""}
  ${divider}
  <div style="font-size:9px;line-height:1.6">
    <div>No: ${printOrder.orderNumber}</div>
    ${printOrder.tableNo ? `<div>${printOrder.tableNo} (${printOrder.orderType === 'takeaway' ? 'Takeaway' : 'Dine-In'})</div>` : ""}
    <div>Tgl: ${new Date(printOrder.date || new Date()).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</div>
    <div>Kasir: ${printOrder.cashierName || cashierName}</div>
    ${printOrder.customerName ? `<div>Plg: ${printOrder.customerName}</div>` : ""}
  </div>
  ${divider}
  ${itemsHtml}
  ${divider}
  ${totalsHtml}
  ${divider}
  <div style="text-align:center;font-size:10px;font-weight:bold;margin-top:4px">${settings?.receiptFooterNote || "Terima Kasih Atas Kunjungan Anda"}</div>
  <div style="text-align:center;font-size:8px;color:#666;margin-top:2px">Struk ini sah dicetak otomatis</div>
</body>
</html>`;
    }

    const printWindow = window.open("", "_blank", "width=1000,height=800,toolbar=0,menubar=0,scrollbars=1");
    if (!printWindow) {
      alert("Pop-up diblokir browser. Harap izinkan pop-up untuk situs ini lalu coba lagi.");
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 350);
  };

  // Filter Catalog
  const filteredProducts = products?.filter((p: any) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter History
  const filteredHistory = ordersHistory?.filter((o: any) => {
    if (historyStatus && o.status !== historyStatus) return false;
    if (historyStart) {
      const orderDate = new Date(o.date).toISOString().split("T")[0];
      if (orderDate < historyStart) return false;
    }
    if (historyEnd) {
      const orderDate = new Date(o.date).toISOString().split("T")[0];
      if (orderDate > historyEnd) return false;
    }
    return true;
  });

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);
  };

  const openOrders = ordersHistory?.filter((o: any) => o.status === "open") || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Tab Switcher & Kitchen Link */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 gap-2 pb-1">
        <div className="flex">
          <button
            onClick={() => setActiveTab("pos")}
            className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all ${
              activeTab === "pos"
                ? "border-orange-500 text-orange-500 bg-orange-500/5 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Katalog Kasir
          </button>
          <button
            onClick={() => setActiveTab("tables")}
            className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all ${
              activeTab === "tables"
                ? "border-orange-500 text-orange-500 bg-orange-500/5 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Utensils className="w-4 h-4" />
            Meja & Pesanan Aktif
            {openOrders.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-extrabold animate-pulse">
                {openOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all ${
              activeTab === "history"
                ? "border-orange-500 text-orange-500 bg-orange-500/5 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="w-4 h-4" />
            Riwayat Transaksi
          </button>
        </div>

        <Link
          href="/dashboard/kitchen"
          className="flex items-center gap-2 px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 rounded-xl text-xs font-bold transition-all shadow-sm self-center my-1"
        >
          <ChefHat className="w-4 h-4 text-orange-500" />
          Layar Dapur (KDS)
        </Link>
      </div>

      {activeTab === "pos" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Product Catalog */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
              <Search className="w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Cari makanan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-slate-800 focus:outline-none text-sm placeholder:text-slate-600"
              />
            </div>

            {!products ? (
              <div className="flex items-center justify-center py-20 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-orange-600 mr-2" />
                <span>Memuat menu...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20 text-slate-500 text-sm">Tidak menemukan menu produk.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map((p: any) => (
                  <div
                    key={p.id}
                    onClick={() => handleAddToCart(p)}
                    className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-orange-500/40 hover:shadow-orange-500/5 hover:shadow-lg transition-all duration-300 cursor-pointer active:scale-[0.98] select-none flex flex-col justify-between min-h-[140px]"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold text-slate-800 text-md truncate">{p.name}</h4>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                          p.fulfillmentType === "make_to_stock"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {p.fulfillmentType === "make_to_stock" ? "Pre-Batch" : "Masak Langsung"}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {p.fulfillmentType === "make_to_stock"
                          ? `Stok Jadi: ${p.currentStock} porsi`
                          : `Resep: ${p.recipes?.map((r: any) => r.name).join(", ") || "-"}`}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <span className="font-extrabold text-orange-500 text-lg">{formatRupiah(p.sellPrice)}</span>
                      <span className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full font-bold">
                        + Tambah
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Sidebar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-orange-500" /> Keranjang Belanja
              </h3>
              <button
                onClick={handleClearCart}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold hover:underline"
              >
                Kosongkan
              </button>
            </div>

            {/* Warning Stock shortages */}
            {stockWarnings.length > 0 && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-900 rounded-xl space-y-1.5 text-xs text-rose-200">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Stok Tidak Cukup!</span>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                  {stockWarnings.map((w, idx) => <p key={idx}>{w}</p>)}
                </div>
              </div>
            )}

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500">
                <ShoppingCart className="w-10 h-10 text-slate-800" />
                <span className="text-sm mt-3">Keranjang masih kosong.</span>
              </div>
            ) : (
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between bg-slate-50/40 border border-slate-200 rounded-xl p-3.5 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatRupiah(item.sellPrice)} / porsi</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleUpdateQty(item.productId, item.qty - 1)}
                        className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md transition-all"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-sm font-bold text-slate-600 w-6 text-center">{item.qty}</span>
                      <button
                        onClick={() => handleUpdateQty(item.productId, item.qty + 1)}
                        className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveFromCart(item.productId)}
                        className="p-1 text-rose-400 hover:bg-rose-950/20 border border-slate-200 rounded-md transition-all ml-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Inputs & Order Flow Form */}
            <form onSubmit={(e) => handleCheckout(e, "paid")} className="space-y-4 pt-4 border-t border-slate-200">
              {/* Order Type Toggle */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Tipe Layanan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderType("dine_in")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      orderType === "dine_in"
                        ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Utensils className="w-3.5 h-3.5" /> Makan di Tempat
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("takeaway")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      orderType === "takeaway"
                        ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" /> Bungkus / Takeaway
                  </button>
                </div>
              </div>

              {/* Table / Queue Input with Quick Chips */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {orderType === "dine_in" ? "Nomor Meja" : "Nomor / Nama Antrean"}
                </label>
                <input
                  type="text"
                  value={tableNo}
                  onChange={(e) => setTableNo(e.target.value)}
                  placeholder={orderType === "dine_in" ? "Contoh: Meja 05" : "Contoh: Antrean 01"}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                />
                {orderType === "dine_in" && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {["Meja 1", "Meja 2", "Meja 3", "Meja 4", "Meja 5", "Meja 6"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTableNo(t)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                          tableNo === t
                            ? "bg-orange-100 border-orange-300 text-orange-700 font-bold"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Pelanggan (Opsional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                  placeholder="Umum / Budi"
                />
              </div>

              {/* Discount inputs */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Diskon</label>
                  <select
                    value={discountType}
                    onChange={(e) => { setDiscountType(e.target.value as any); setDiscountValue("0"); }}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                  >
                    <option value="nominal">Nominal (Rp)</option>
                    <option value="percent">Persen (%)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nilai Diskon</label>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                    min="0"
                  />
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Metode Pembayaran</label>
                <div className="grid grid-cols-3 gap-2">
                  {["cash", "qris", "transfer"].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 rounded-xl text-xs font-bold border capitalize transition-all ${
                        paymentMethod === method
                          ? "bg-orange-500/10 border-orange-500 text-orange-600 font-extrabold"
                          : "bg-slate-50/50 border-slate-200 text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash payment received */}
              {paymentMethod === "cash" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Uang Diterima (Rp)</label>
                    <input
                      type="number"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                      placeholder="100000"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Kembalian</label>
                    <div className="w-full bg-slate-50/30 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold text-sm h-[38px] flex items-center truncate">
                      {changeVal >= 0 ? formatRupiah(changeVal) : "Kurang"}
                    </div>
                  </div>
                </div>
              )}

              {/* Bill Details */}
              <div className="bg-slate-50/40 p-4 border border-slate-200/80 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>{formatRupiah(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Potongan Diskon</span>
                  <span className="text-rose-400">-{formatRupiah(discountNominal)}</span>
                </div>
                {scEnabled && (
                  <div className="flex justify-between text-slate-500">
                    <span>Service Charge ({settings?.serviceChargePercent}%)</span>
                    <span>{formatRupiah(serviceChargeAmount)}</span>
                  </div>
                )}
                {taxEnabled && (
                  <div className="flex justify-between text-slate-500">
                    <span>Pajak ({settings?.taxPercent}%)</span>
                    <span>{formatRupiah(taxAmount)}</span>
                  </div>
                )}
                {roundingEnabled && roundingAdjustment !== 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Pembulatan</span>
                    <span className={roundingAdjustment > 0 ? "text-emerald-400" : "text-rose-400"}>
                      {roundingAdjustment > 0 ? "+" : ""}{formatRupiah(roundingAdjustment)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-800">
                  <span>Total Tagihan</span>
                  <span className="text-orange-500 text-base">{formatRupiah(grandTotal)}</span>
                </div>
              </div>

              {/* DUAL CHECKOUT ACTION BUTTONS: OPEN BILL vs IMMEDIATE CHECKOUT */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={(e) => handleCheckout(e, "open")}
                  disabled={loading || cart.length === 0 || hasStockError}
                  className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-xl py-3 font-bold active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                >
                  <ChefHat className="w-4 h-4 text-amber-600" />
                  Simpan Meja & Kirim Dapur (Open Bill)
                </button>

                <button
                  type="button"
                  onClick={(e) => handleCheckout(e, "paid")}
                  disabled={loading || cart.length === 0 || hasStockError || (paymentMethod === "cash" && changeVal < 0)}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white rounded-xl py-3.5 font-bold shadow-md shadow-orange-500/10 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Bayar Sekarang (Lunas)
                </button>
              </div>

              {checkoutError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-200 text-xs">
                  {checkoutError}
                </div>
              )}
            </form>
          </div>
        </div>
      ) : activeTab === "tables" ? (
        /* ACTIVE OPEN BILLS / MEJA VIEW */
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Utensils className="w-5 h-5 text-orange-500" />
                Daftar Meja & Pesanan Aktif (Belum Bayar)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pesanan yang sedang disiapkan/dinikmati oleh tamu. Klik "Bayar" saat tamu hendak menyelesaikan tagihan.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded-full">
              {openOrders.length} Meja Aktif
            </span>
          </div>

          {openOrders.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Utensils className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-bold text-slate-700 text-base">Tidak ada pesanan meja aktif saat ini.</p>
              <p className="text-xs mt-1">Semua pesanan sudah diselesaikan atau dibayar langsung di kasir.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {openOrders.map((order: any) => {
                const elapsedMin = Math.floor((Date.now() - new Date(order.date).getTime()) / 60000);
                return (
                  <div
                    key={order.id}
                    className="border border-slate-200 rounded-2xl p-5 bg-white hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="font-black text-lg text-slate-900 block">
                            {order.tableNo || "Meja -"}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {order.orderNumber}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          order.orderType === "takeaway"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {order.orderType === "takeaway" ? "Takeaway" : "Dine-In"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3 bg-slate-50 px-2.5 py-1.5 rounded-lg">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>Dipesan: {elapsedMin} menit yang lalu</span>
                        {order.customerName && <span className="ml-auto font-medium">({order.customerName})</span>}
                      </div>

                      {/* Items list */}
                      <div className="space-y-1.5 border-t border-slate-100 pt-3 max-h-40 overflow-y-auto pr-1">
                        {order.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-xs text-slate-700">
                            <span className="truncate pr-2 font-medium">{item.productName || item.name}</span>
                            <span className="font-bold shrink-0">x{item.qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 mt-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs text-slate-500 font-semibold">Total Tagihan:</span>
                        <span className="font-extrabold text-base text-orange-600">
                          {formatRupiah(order.grandTotal || order.revenueTotal)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setPrintOrder(order);
                            setPrintMode("kot");
                          }}
                          className="py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Printer className="w-3.5 h-3.5" /> Cetak KOT
                        </button>
                        <button
                          onClick={() => setSettleOrder(order)}
                          className="py-2 px-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Pelunasan
                        </button>
                      </div>

                      <button
                        onClick={() => handleCancelOrder(order)}
                        className="w-full mt-2 py-1.5 text-[11px] text-rose-500 hover:text-rose-700 hover:underline text-center"
                      >
                        Batalkan Pesanan Ini
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Order History View */
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-slate-900">Daftar Transaksi</h3>

          {/* History Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50/40 p-4 border border-slate-200 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Mulai Tanggal</label>
              <input
                type="date"
                value={historyStart}
                onChange={(e) => setHistoryStart(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-350 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Hingga Tanggal</label>
              <input
                type="date"
                value={historyEnd}
                onChange={(e) => setHistoryEnd(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-350 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
              <select
                value={historyStatus}
                onChange={(e) => setHistoryStatus(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-350 focus:outline-none"
              >
                <option value="">Semua Status</option>
                <option value="paid">Lunas (Paid)</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setHistoryStart("");
                  setHistoryEnd("");
                  setHistoryStatus("");
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-xs font-semibold text-slate-500 hover:text-slate-800 rounded-lg transition-all w-full"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filter
              </button>
            </div>
          </div>

          {!filteredHistory ? (
            <div className="flex justify-center py-12 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">Tidak ada transaksi ditemukan.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="text-xs uppercase tracking-wider text-slate-500 bg-slate-100">
                  <tr>
                    <th className="px-6 py-4 rounded-l-xl">No. Struk</th>
                    <th className="px-6 py-4">Tanggal</th>
                    <th className="px-6 py-4">Pelanggan</th>
                    <th className="px-6 py-4">Omzet / Revenue</th>
                    <th className="px-6 py-4">HPP</th>
                    <th className="px-6 py-4">Profit Bersih</th>
                    <th className="px-6 py-4">Metode</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right rounded-r-xl">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((order: any) => (
                    <tr key={order.id} className="hover:bg-orange-50/50 transition-all">
                      <td className="px-6 py-4.5">
                        <div className="font-semibold text-slate-800">{order.orderNumber}</div>
                        <div className="text-[10px] text-slate-500 mt-1 max-w-[200px] truncate">
                          {order.items.map((i: any) => `${i.productName} (${i.qty})`).join(", ")}
                        </div>
                      </td>
                      <td className="px-6 py-4.5 text-xs text-slate-500">
                        {new Date(order.date).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4.5">{order.customerName || "-"}</td>
                      <td className="px-6 py-4.5 font-medium text-slate-800">{formatRupiah(order.revenueTotal)}</td>
                      <td className="px-6 py-4.5 text-xs text-slate-500">{formatRupiah(order.hppTotal)}</td>
                      <td className="px-6 py-4.5 font-semibold text-emerald-600">{formatRupiah(order.profitTotal)}</td>
                      <td className="px-6 py-4.5 uppercase text-xs">{order.paymentMethod}</td>
                      <td className="px-6 py-4.5">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          order.status === "paid"
                            ? "bg-emerald-100 border border-emerald-200 text-emerald-700"
                            : "bg-red-100 border border-red-200 text-red-700"
                        }`}>
                          {order.status === "paid" ? "Paid" : "Cancelled"}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-right space-x-1.5 flex justify-end gap-2">
                        <button
                          onClick={() => handleReprint(order)}
                          className="px-2 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-orange-600 hover:border-orange-200 rounded-lg transition-all inline-flex items-center gap-1.5 text-xs font-medium shadow-sm"
                          title="Cetak Struk"
                        >
                          <Printer className="w-3.5 h-3.5" /> Cetak
                        </button>
                        {order.status !== "cancelled" && (
                          <button
                            onClick={() => handleCancelOrder(order)}
                            className="px-2 py-1.5 bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 rounded-lg transition-all inline-flex items-center gap-1.5 text-xs font-medium shadow-sm"
                            title="Batalkan Pesanan"
                          >
                            <X className="w-3.5 h-3.5" /> Batal
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SETTLE OPEN BILL MODAL */}
      {settleOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm no-print">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-orange-500" />
                  Pelunasan Meja: {settleOrder.tableNo || "Meja"}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{settleOrder.orderNumber}</p>
              </div>
              <button
                onClick={() => setSettleOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {settleError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{settleError}</span>
              </div>
            )}

            <form onSubmit={handleSettleSubmit} className="space-y-4">
              {/* Order summary box */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Pelanggan:</span>
                  <span className="font-semibold text-slate-700">{settleOrder.customerName || "-"}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Jumlah Item:</span>
                  <span className="font-semibold text-slate-700">{settleOrder.items?.length || 0} item</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-800">
                  <span>Total Tagihan:</span>
                  <span className="text-orange-600 text-base">
                    {formatRupiah(settleOrder.grandTotal || settleOrder.revenueTotal)}
                  </span>
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Metode Pembayaran</label>
                <div className="grid grid-cols-3 gap-2">
                  {["cash", "qris", "transfer"].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setSettlePaymentMethod(method)}
                      className={`py-2 rounded-xl text-xs font-bold border capitalize transition-all ${
                        settlePaymentMethod === method
                          ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash payment received */}
              {settlePaymentMethod === "cash" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Uang Diterima (Rp)</label>
                    <input
                      type="number"
                      required
                      value={settleAmountReceived}
                      onChange={(e) => setSettleAmountReceived(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                      placeholder="100000"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Kembalian</label>
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold text-sm h-[38px] flex items-center truncate">
                      {settleAmountReceived && parseFloat(settleAmountReceived) >= (settleOrder.grandTotal || settleOrder.revenueTotal)
                        ? formatRupiah(parseFloat(settleAmountReceived) - (settleOrder.grandTotal || settleOrder.revenueTotal))
                        : "Kurang"}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettleOrder(null)}
                  className="w-1/3 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    settleLoading ||
                    (settlePaymentMethod === "cash" &&
                      parseFloat(settleAmountReceived || "0") < (settleOrder.grandTotal || settleOrder.revenueTotal))
                  }
                  className="w-2/3 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {settleLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Pelunasan & Selesai
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT RECEIPT & KOT POPUP MODAL */}
      {printOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm no-print">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-3">
              <h3 className="font-bold text-slate-900 text-sm">Cetak Struk & Tiket</h3>
              <div className="flex items-center gap-2">
                <select
                  value={receiptWidth}
                  onChange={(e: any) => setReceiptWidth(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 focus:outline-none"
                >
                  <option value="58">58mm</option>
                  <option value="80">80mm</option>
                </select>
                <button onClick={() => setPrintOrder(null)} className="p-1 text-slate-400 hover:text-slate-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Print Mode Selector: Receipt vs KOT */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1 mb-3 shrink-0">
              <button
                type="button"
                onClick={() => setPrintMode("receipt")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  printMode === "receipt"
                    ? "bg-white text-orange-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Struk Pelanggan
              </button>
              <button
                type="button"
                onClick={() => setPrintMode("kot")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  printMode === "kot"
                    ? "bg-white text-orange-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Tiket Dapur (KOT)
              </button>
            </div>

            {/* Print Area Preview */}
            <div className="flex-1 overflow-y-auto bg-white text-slate-900 p-4 border border-slate-200 rounded-xl font-mono text-[11px] shadow-inner select-text">
              <div
                id="print-receipt"
                className="mx-auto"
                style={{ width: receiptWidth === "58" ? "48mm" : "72mm" }}
              >
                {printMode === "kot" ? (
                  /* KOT PREVIEW */
                  <div className="text-center">
                    <div className="font-extrabold text-sm border-b-2 border-slate-800 pb-1 mb-1">
                      TIKET DAPUR (KOT)
                    </div>
                    <div className="font-black text-sm uppercase text-slate-900 mt-1">
                      {printOrder.tableNo || "MEJA / ANTREAN"}
                    </div>
                    <div className="text-[10px] text-slate-600">
                      Tipe: {printOrder.orderType === "takeaway" ? "TAKEAWAY" : "DINE-IN"}
                    </div>
                    <div className="border-t border-dashed border-slate-400 my-2"></div>
                    <div className="text-left text-[9px] space-y-0.5">
                      <div>No: {printOrder.orderNumber}</div>
                      <div>Waktu: {new Date(printOrder.date || new Date()).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
                      {printOrder.customerName && <div>Plg: {printOrder.customerName}</div>}
                    </div>
                    <div className="border-t border-dashed border-slate-400 my-2"></div>
                    <div className="space-y-1.5 text-left">
                      {printOrder.items?.map((i: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-dotted border-slate-200">
                          <span className="font-bold text-xs">{i.name || i.productName}</span>
                          <span className="font-black text-sm">x{i.qty}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-dashed border-slate-400 my-2"></div>
                    <div className="text-[9px] text-slate-500 italic mt-1">--- Harap Segera Diproses ---</div>
                  </div>
                ) : (
                  /* CUSTOMER RECEIPT PREVIEW */
                  <div>
                    {settings?.logoUrl && (
                      <div className="flex justify-center mb-1">
                        <img src={settings.logoUrl} alt="Logo" className="max-h-8 grayscale" />
                      </div>
                    )}
                    <div className="text-center font-bold text-sm uppercase">{settings?.businessName || "GWEH FOOD CORNER"}</div>
                    {settings?.address && <div className="text-center text-[9px] mt-0.5">{settings.address}</div>}
                    {settings?.phone && <div className="text-center text-[9px]">Telp: {settings.phone}</div>}

                    <div className="border-t border-dashed border-slate-400 my-2"></div>

                    <div className="space-y-0.5 text-[9px]">
                      <div>No: {printOrder.orderNumber}</div>
                      {printOrder.tableNo && <div>{printOrder.tableNo} ({printOrder.orderType === "takeaway" ? "Takeaway" : "Dine-In"})</div>}
                      <div>Tgl: {new Date(printOrder.date || new Date()).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</div>
                      <div>Kasir: {printOrder.cashierName || cashierName}</div>
                      {printOrder.customerName && <div>Plg: {printOrder.customerName}</div>}
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-2"></div>

                    <div className="space-y-1.5">
                      {printOrder.items?.map((i: any, idx: number) => (
                        <div key={idx}>
                          <div className="font-semibold">{i.name || i.productName}</div>
                          <div className="flex justify-between text-[9px] mt-0.5 pl-1.5">
                            <span>{i.qty} x {formatRupiah(i.sellPrice)}</span>
                            <span>{formatRupiah(i.qty * i.sellPrice)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-2"></div>

                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatRupiah(parseFloat(printOrder.subtotal?.toString() || "0"))}</span>
                      </div>
                      {parseFloat(printOrder.discount?.toString() || "0") > 0 && (
                        <div className="flex justify-between text-slate-650">
                          <span>Diskon:</span>
                          <span>-{formatRupiah(parseFloat(printOrder.discount.toString()))}</span>
                        </div>
                      )}
                      {parseFloat(printOrder.serviceChargeAmount?.toString() || "0") > 0 && (
                        <div className="flex justify-between">
                          <span>Service Charge:</span>
                          <span>{formatRupiah(parseFloat(printOrder.serviceChargeAmount.toString()))}</span>
                        </div>
                      )}
                      {parseFloat(printOrder.taxAmount?.toString() || "0") > 0 && (
                        <div className="flex justify-between">
                          <span>Pajak:</span>
                          <span>{formatRupiah(parseFloat(printOrder.taxAmount.toString()))}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-extrabold text-[12px] border-t border-dashed border-slate-300 pt-1 mt-1">
                        <span>TOTAL:</span>
                        <span>{formatRupiah(parseFloat(printOrder.grandTotal?.toString() || printOrder.revenueTotal?.toString() || "0"))}</span>
                      </div>
                      <div className="flex justify-between mt-1 text-[9px]">
                        <span>Metode:</span>
                        <span className="uppercase font-bold">{printOrder.paymentMethod || "UNPAID"}</span>
                      </div>
                      {printOrder.paymentMethod === "cash" && printOrder.amountReceived && (
                        <>
                          <div className="flex justify-between text-[9px]">
                            <span>Diterima:</span>
                            <span>{formatRupiah(parseFloat(printOrder.amountReceived.toString()))}</span>
                          </div>
                          <div className="flex justify-between text-[9px] font-semibold">
                            <span>Kembali:</span>
                            <span>{formatRupiah(parseFloat(printOrder.changeAmount?.toString() || "0"))}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-3"></div>
                    <div className="text-center text-[10px] font-bold">{settings?.receiptFooterNote || "Terima Kasih Atas Kunjungan Anda"}</div>
                    <div className="text-center text-[8px] text-slate-500 mt-1">Struk ini sah dicetak otomatis</div>
                  </div>
                )}
              </div>
            </div>

            {/* Print Trigger Buttons */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setPrintOrder(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 text-sm font-semibold transition-all"
              >
                Tutup
              </button>
              <button
                onClick={handleTriggerPrint}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold shadow-md text-sm transition-all"
              >
                <Printer className="w-4 h-4" /> Cetak {printMode === "kot" ? "KOT" : "Struk"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL ORDER MODAL (STANDAR INDUSTRI: PILIH RETUR STOK ATAU CATAT WASTE) */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs no-print">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 animate-in zoom-in duration-200 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                  Batalkan Pesanan: {cancelModalOrder.orderNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {cancelModalOrder.tableNo || "Takeaway"} &bull; {cancelModalOrder.customerName || "Pelanggan"}
                </p>
              </div>
              <button
                onClick={() => setCancelModalOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status alert */}
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              cancelModalOrder.status === "paid"
                ? "bg-amber-50 border border-amber-200 text-amber-800"
                : "bg-blue-50 border border-blue-200 text-blue-800"
            }`}>
              <Info className="w-4 h-4 shrink-0" />
              <span>
                {cancelModalOrder.status === "paid"
                  ? "Pesanan telah lunas. Pembatalan akan otomatis mencatat arus kas keluar (retur penjualan) & mengembalikan split kantong kas."
                  : "Pesanan berstatus Open Bill (belum dibayar). Pembatalan tidak memengaruhi arus kas."}
              </span>
            </div>

            {/* Preparation status decision */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Bagaimana Status Makanan di Dapur?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCancelIsPrepared(false)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    !cancelIsPrepared
                      ? "border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/20"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <RotateCcw className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">Belum Dimasak</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Stok bahan baku & produk akan <b>dikembalikan utuh</b> ke gudang persediaan.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCancelIsPrepared(true)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    cancelIsPrepared
                      ? "border-rose-500 bg-rose-50/50 ring-2 ring-rose-500/20"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-bold text-slate-900">Sudah Dimasak</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Makanan terbuang/hangus. Stok gudang <b>TIDAK</b> kembali, otomatis dicatat ke <b>Limbah / Waste</b>.
                  </p>
                </button>
              </div>
            </div>

            {/* Reason input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Alasan Pembatalan (Opsional)
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Contoh: Pelanggan buru-buru, salah input menu..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />

              {/* Quick Reason Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {["Pelanggan Batal", "Salah Input", "Terlalu Lama", "Komplain Kualitas"].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setCancelReason(chip)}
                    className="px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[10px] text-slate-600 font-medium transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={executeCancelOrder}
                disabled={isCancelling}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-950/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isCancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Konfirmasi Batalkan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

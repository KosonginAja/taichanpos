"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
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

  // Tab management
  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [historyStart, setHistoryStart] = useState("");
  const [historyEnd, setHistoryEnd] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [discountType, setDiscountType] = useState<"nominal" | "percent">("nominal");
  const [discountValue, setDiscountValue] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountReceived, setAmountReceived] = useState("");

  // Checkout warning
  const [stockWarnings, setStockWarnings] = useState<string[]>([]);
  const [hasStockError, setHasStockError] = useState(false);

  // Print modal State
  const [printOrder, setPrintOrder] = useState<any>(null);
  const [receiptWidth, setReceiptWidth] = useState<"58" | "80">("58");

  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState("");

  // Calculate HPP & required ingredients on the fly for warnings
  useEffect(() => {
    if (!products || !ingredients || cart.length === 0) {
      setStockWarnings([]);
      setHasStockError(false);
      return;
    }

    const required: { [ingId: number]: { qty: number; name: string; unit: string } } = {};
    
    // Sum required ingredients
    for (const item of cart) {
      const prod = products.find((p: any) => p.id === item.productId);
      if (!prod) continue;
      
      const yieldQty = parseFloat(prod.yieldQty);
      for (const recipe of prod.recipes) {
        const reqQty = yieldQty > 0 ? (item.qty * recipe.qty) / yieldQty : 0;
        if (!required[recipe.ingredientId]) {
          required[recipe.ingredientId] = {
            qty: 0,
            name: recipe.name,
            unit: recipe.unit,
          };
        }
        required[recipe.ingredientId].qty += reqQty;
      }
    }

    // Compare with current ingredients stock
    const warnings: string[] = [];
    let isShort = false;

    for (const ingIdStr of Object.keys(required)) {
      const ingId = parseInt(ingIdStr);
      const req = required[ingId];
      const ing = ingredients.find((i: any) => i.id === ingId);
      
      const currentStock = ing ? parseFloat(ing.stock) : 0;
      if (currentStock < req.qty) {
        isShort = true;
        const shortage = req.qty - currentStock;
        warnings.push(`Stok kurang untuk ${req.name}: butuh ${req.qty.toFixed(2)} ${req.unit}, hanya tersedia ${currentStock.toFixed(2)} ${req.unit} (kurang ${shortage.toFixed(2)}).`);
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

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (hasStockError) {
      alert("Tidak dapat checkout. Stok bahan baku tidak mencukupi.");
      return;
    }
    if (paymentMethod === "cash" && (parseFloat(amountReceived || "0") < grandTotal)) {
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
      paymentMethod,
      amountReceived: paymentMethod === "cash" ? parseFloat(amountReceived) : null,
      customerName: customerName || null,
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal checkout pesanan.");

      setCheckoutSuccess("Pesanan berhasil disimpan!");
      
      // Load data for printing
      const orderToPrint = {
        ...data,
        items: cart, // use local layout for print details
        cashierName,
      };
      setPrintOrder(orderToPrint);

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

  const handleCancelOrder = async (orderId: number, orderNum: string) => {
    if (!confirm(`Apakah Anda yakin ingin membatalkan transaksi ${orderNum}? Stok bahan baku akan dikembalikan.`)) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membatalkan.");
      alert(`Pesanan ${orderNum} telah dibatalkan.`);
      mutateOrders();
      mutateIng();
      mutateProd();
    } catch (err: any) {
      alert(err.message || "Gagal membatalkan.");
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

    const htmlContent = `<!DOCTYPE html>
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
    <div>Tgl: ${new Date(printOrder.date).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</div>
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

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("pos")}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === "pos"
              ? "border-orange-500 text-orange-500 bg-indigo-500/5"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Katalog & Kasir Baru
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === "history"
              ? "border-orange-500 text-orange-500 bg-indigo-500/5"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <History className="w-4 h-4" />
          Riwayat Transaksi
        </button>
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
                      <h4 className="font-semibold text-slate-800 text-md truncate">{p.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">
                        Yield: {p.yieldQty} Porsi
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
                  <span>Stok Gudang Tidak Cukup!</span>
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

            {/* Inputs & Summary Form */}
            <form onSubmit={handleCheckout} className="space-y-4 pt-4 border-t border-slate-855">
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
              <div className="grid grid-cols-3 gap-2">
                {["cash", "qris", "transfer"].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 rounded-xl text-xs font-bold border capitalize transition-all ${
                      paymentMethod === method
                        ? "bg-indigo-650/10 border-orange-500 text-orange-500 font-extrabold"
                        : "bg-slate-50/50 border-slate-200 text-slate-500 hover:text-slate-350"
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>

              {/* Cash payment received */}
              {paymentMethod === "cash" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Uang Diterima (Rp)</label>
                    <input
                      type="number"
                      required
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

              <button
                type="submit"
                disabled={loading || cart.length === 0 || hasStockError || (paymentMethod === "cash" && changeVal < 0)}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-650 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-800 disabled:to-slate-800 text-white rounded-xl py-3.5 font-bold shadow-lg shadow-orange-500/10 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Checkout & Simpan Order
              </button>

              {checkoutError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-200 text-xs">
                  {checkoutError}
                </div>
              )}
            </form>
          </div>
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
                <thead className="text-xs uppercase tracking-wider text-slate-500 bg-slate-50/40">
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
                <tbody className="divide-y divide-slate-800/60">
                  {filteredHistory.map((order: any) => (
                    <tr key={order.id} className="hover:bg-slate-50/20 transition-all">
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
                      <td className="px-6 py-4.5 font-semibold text-emerald-400">{formatRupiah(order.profitTotal)}</td>
                      <td className="px-6 py-4.5 uppercase text-xs">{order.paymentMethod}</td>
                      <td className="px-6 py-4.5">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          order.status === "paid"
                            ? "bg-emerald-950 border border-emerald-900 text-emerald-400"
                            : "bg-red-950 border border-red-900 text-red-400"
                        }`}>
                          {order.status === "paid" ? "Paid" : "Cancelled"}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-right space-x-1.5">
                        <button
                          onClick={() => handleReprint(order)}
                          className="p-1.5 bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 rounded-lg transition-all inline-flex items-center"
                          title="Cetak Struk"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {order.status === "paid" && (
                          <button
                            onClick={() => handleCancelOrder(order.id, order.orderNumber)}
                            className="p-1.5 bg-slate-50 border border-slate-200 text-rose-400 hover:bg-rose-950/30 hover:border-rose-900 rounded-lg transition-all inline-flex items-center"
                            title="Batalkan & Kembalikan Stok"
                          >
                            <X className="w-3.5 h-3.5" />
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

      {/* PRINT RECEIPT POPUP MODAL & MEDIA PRINT STYLING */}
      {printOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-50/80 backdrop-blur-sm no-print">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-900">Struk Transaksi</h3>
              <div className="flex gap-2">
                <select
                  value={receiptWidth}
                  onChange={(e: any) => setReceiptWidth(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-350 focus:outline-none"
                >
                  <option value="58">58mm</option>
                  <option value="80">80mm</option>
                </select>
                <button onClick={() => setPrintOrder(null)} className="p-1 text-slate-500 hover:text-slate-900">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Print Area Preview */}
            <div className="flex-1 overflow-y-auto bg-white text-slate-900 p-4 border border-slate-200 rounded-xl font-mono text-[11px] shadow-inner select-text">
              {/* Receipt Wrapper Container with variable width */}
              <div
                id="print-receipt"
                className="mx-auto"
                style={{ width: receiptWidth === "58" ? "48mm" : "72mm" }}
              >
                {/* Header */}
                {settings?.logoUrl && (
                  <div className="flex justify-center mb-1">
                    <img src={settings.logoUrl} alt="Logo" className="max-h-8 grayscale" />
                  </div>
                )}
                <div className="text-center font-bold text-sm uppercase">{settings?.businessName || "GWEH FOOD CORNER"}</div>
                {settings?.address ? (
                  <div className="text-center text-[9px] mt-0.5">{settings.address}</div>
                ) : (
                  <div className="text-center text-[9px] mt-0.5">Jln. Raya Makanan Enak No.12</div>
                )}
                {settings?.phone ? (
                  <div className="text-center text-[9px]">Telp: {settings.phone}</div>
                ) : (
                  <div className="text-center text-[9px]">Telp: 0812-3456-7890</div>
                )}

                <div className="border-t border-dashed border-slate-400 my-2"></div>

                {/* Details */}
                <div className="space-y-0.5 text-[9px]">
                  <div>No: {printOrder.orderNumber}</div>
                  <div>Tgl: {new Date(printOrder.date).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</div>
                  <div>Kasir: {printOrder.cashierName || cashierName}</div>
                  {printOrder.customerName && <div>Plg: {printOrder.customerName}</div>}
                </div>

                <div className="border-t border-dashed border-slate-400 my-2"></div>

                {/* Items */}
                <div className="space-y-1.5">
                  {printOrder.items.map((i: any, idx: number) => (
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

                {/* Totals */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatRupiah(parseFloat(printOrder.subtotal.toString()))}</span>
                  </div>
                  {parseFloat(printOrder.discount.toString()) > 0 && (
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
                  {parseFloat(printOrder.roundingAdjustment?.toString() || "0") !== 0 && (
                    <>
                      <div className="flex justify-between text-slate-600 mt-1">
                        <span>Sebelum Pembulatan:</span>
                        <span>{formatRupiah(parseFloat(printOrder.revenueTotal.toString()))}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Pembulatan:</span>
                        <span>
                          {parseFloat(printOrder.roundingAdjustment.toString()) > 0 ? "+" : ""}
                          {formatRupiah(parseFloat(printOrder.roundingAdjustment.toString()))}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-extrabold text-[12px] border-t border-dashed border-slate-300 pt-1 mt-1">
                    <span>{parseFloat(printOrder.roundingAdjustment?.toString() || "0") !== 0 ? "TOTAL BAYAR:" : "TOTAL:"}</span>
                    <span>{formatRupiah(parseFloat(printOrder.grandTotal?.toString() || printOrder.revenueTotal.toString()))}</span>
                  </div>
                  <div className="flex justify-between mt-1 text-[9px]">
                    <span>Metode:</span>
                    <span className="uppercase font-bold">{printOrder.paymentMethod}</span>
                  </div>
                  {printOrder.paymentMethod === "cash" && (
                    <>
                      <div className="flex justify-between text-[9px]">
                        <span>Diterima:</span>
                        <span>{formatRupiah(parseFloat(printOrder.amountReceived.toString()))}</span>
                      </div>
                      <div className="flex justify-between text-[9px] font-semibold">
                        <span>Kembali:</span>
                        <span>{formatRupiah(parseFloat(printOrder.changeAmount.toString()))}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="border-t border-dashed border-slate-400 my-3"></div>

                {/* Footer */}
                <div className="text-center text-[10px] font-bold">{settings?.receiptFooterNote || "Terima Kasih Atas Kunjungan Anda"}</div>
                <div className="text-center text-[8px] text-slate-500 mt-1">Struk ini sah dicetak otomatis</div>
              </div>
            </div>

            {/* Print Trigger */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setPrintOrder(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 hover:bg-white rounded-xl text-slate-500 hover:text-slate-800 text-sm font-semibold transition-all"
              >
                Tutup
              </button>
              <button
                onClick={handleTriggerPrint}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-650 hover:bg-orange-600 text-white rounded-xl font-semibold shadow-lg text-sm transition-all"
              >
                <Printer className="w-4 h-4" /> Cetak Struk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Search,
  ShoppingBag,
  ChefHat,
  Database,
  Coffee,
  Wallet,
  Percent,
  Printer,
  Settings,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Flame,
  Clock,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  Smartphone,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function GuidePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({
    pos_openbill: true,
    pos_gofood: true,
    kds_flow: true,
    printer_rongta: true,
  });

  const toggleTopic = (id: string) => {
    setExpandedTopics((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const categories = [
    { id: "all", label: "Semua Panduan", icon: BookOpen },
    { id: "pos", label: "Kasir & POS", icon: ShoppingBag },
    { id: "kds", label: "Layar Dapur (KDS)", icon: ChefHat },
    { id: "inventory", label: "Gudang & Bahan Baku", icon: Database },
    { id: "products", label: "Produk & HPP", icon: Coffee },
    { id: "finance", label: "Keuangan & Investor", icon: Percent },
    { id: "printer", label: "Thermal Printer", icon: Printer },
  ];

  const guides = [
    // ================= POS / KASIR =================
    {
      id: "pos_dinein",
      category: "pos",
      title: "Pemesanan Makan di Tempat (Dine-In) & Pemilihan Meja",
      summary: "Alur memilih layanan makan di tempat dan menentukan nomor meja tamu.",
      steps: [
        "Buka menu Kasir / POS dari sidebar.",
        "Pastikan tab layanan terpilih pada '🍽️ Makan di Tempat'.",
        "Pilih Nomor Meja tamu dengan menekan tombol cepat meja (Meja 01 s/d Meja 06) atau ketik nomor meja kustom.",
        "Masukkan Nama Pelanggan (opsional) agar kasir dan koki mudah memanggil nama tamu.",
        "Klik menu makanan/minuman yang dipesan untuk masuk ke keranjang belanja.",
        "Sesuaikan jumlah kuantitas menu jika tamu memesan lebih dari satu porsi.",
      ],
      tip: "Nomor meja akan tercetak tebal di struk dan tiket dapur (KOT) agar koki dan pelayan tidak salah antar makanan.",
      linkHref: "/dashboard/orders",
      linkLabel: "Buka POS / Kasir",
    },
    {
      id: "pos_openbill",
      category: "pos",
      title: "Sistem Open Bill (Simpan Meja & Kirim Dapur vs Bayar Sekarang)",
      summary: "Standar industri resto: masak dulu, bayar belakangan saat tamu selesai makan.",
      steps: [
        "Setelah menu dan meja dipilih di keranjang, Anda memiliki 2 opsi tombol di bawah:",
        "Opsi 1: 'Simpan Meja & Kirim Dapur (Open Bill)' — Gunakan ini jika tamu bayar setelah selesai makan. Sistem akan otomatis memotong stok bahan baku dan mengirim tiket ke Layar Dapur, namun arus kas belum dicatat.",
        "Opsi 2: 'Bayar Sekarang (Lunas)' — Gunakan ini jika tamu langsung bayar di depan (misal pesanan takeaway atau pembayaran tunai/QRIS langsung).",
        "Untuk melunasi meja yang open bill: Klik tab 'Meja Aktif & Open Bill' di atas katalog kasir, lalu klik tombol 'Lunasi Meja'.",
        "Pilih metode pembayaran (Cash, QRIS, atau Transfer), masukkan uang diterima jika cash, lalu klik 'Pelunasan & Selesai'.",
      ],
      tip: "Open Bill menjamin stok gudang langsung berkurang saat makanan mulai dimasak, sehingga tidak terjadi kehabisan bahan baku tak terduga.",
      linkHref: "/dashboard/orders",
      linkLabel: "Coba Alur Kasir",
    },
    {
      id: "pos_gofood",
      category: "pos",
      title: "Pemesanan Online GoFood (Dual Pricing & Slip Kantong Driver)",
      summary: "Alur khusus pesanan online dengan markup harga dan slip packing.",
      steps: [
        "Di halaman kasir, pilih tab layanan '🛵 GoFood'.",
        "Perhatikan bahwa harga menu di kasir otomatis berganti ke 'Harga GoFood' yang sudah di-markup 20-30%.",
        "Masukkan Nomor Pesanan Online dari aplikasi GoBiz (misal: #GF-294).",
        "Masukkan Nama Driver atau Nama Pelanggan (misal: Budi / Gojek).",
        "Pilih menu sesuai aplikasi driver.",
        "Lihat rincian tagihan di bawah keranjang: Sistem otomatis menghitung potongan komisi 20% dan menampilkan estimasi pencairan bersih riil (Net Payout) ke rekening bank.",
        "Klik tombol hijau '🛵 Proses Pesanan GoFood (Kirim Dapur & Cetak)'.",
        "Cetak 'Slip GoFood' yang memiliki kotak checklist [ ] per porsi untuk ditempelkan di kantong plastik pesanan.",
      ],
      tip: "Pesanan GoFood otomatis berstatus Lunas via Aplikasi. Hanya nilai bersih (Net Payout) yang dicatat ke buku kas agar pembagian laba investor tidak over-distribusi!",
      linkHref: "/dashboard/orders",
      linkLabel: "Buka Kasir GoFood",
    },
    {
      id: "pos_cancel",
      category: "pos",
      title: "Pembatalan Pesanan (Retur Stok vs Catat Limbah/Waste)",
      summary: "Mekanisme pembatalan pesanan tanpa merusak integritas pembukuan.",
      steps: [
        "Buka tab 'Riwayat Pesanan' di bagian bawah halaman kasir.",
        "Cari pesanan yang ingin dibatalkan, lalu klik tombol merah 'Batal'.",
        "Modal konfirmasi akan menanyakan kondisi makanan:",
        "Pilihan A: 'Makanan Belum Dimasak (Retur Stok Utuh)' — Gunakan jika pelanggan membatalkan sebelum kompor dinyalakan. Stok bahan baku akan otomatis dikembalikan utuh ke gudang.",
        "Pilihan B: 'Makanan Sudah Terlanjur Dimasak (Catat Limbah/Waste)' — Gunakan jika sate sudah matang/gosong dan pelanggan kabur atau salah pesan. Stok TIDAK dikembalikan, dan HPP pesanan otomatis dicatat sebagai kerugian operasional (waste log).",
        "Masukkan alasan pembatalan (wajib), lalu konfirmasi.",
      ],
      tip: "Sistem tidak pernah menghapus data pesanan dari database (non-destructive). Status diubah menjadi 'cancelled' agar kasir tidak bisa melakukan manipulasi uang.",
      linkHref: "/dashboard/orders",
      linkLabel: "Lihat Riwayat Pesanan",
    },

    // ================= LAYAR DAPUR (KDS) =================
    {
      id: "kds_flow",
      category: "kds",
      title: "Operasional Layar Dapur (KDS) Ramah Solo Operator",
      summary: "Memantau dan menyelesaikan pesanan dapur hanya dengan 1-tap.",
      steps: [
        "Buka menu 'Layar Dapur (KDS)' di tablet atau monitor dapur.",
        "Saat kasir menginput pesanan, Layar Dapur akan berbunyi 'Chime Ding' secara otomatis dan kartu pesanan baru akan muncul.",
        "Perhatikan warna timer pada pojok kanan kartu pesanan:",
        "— Hijau: Baru masuk (< 10 menit).",
        "— Kuning: Antrean mulai lama (10 - 15 menit).",
        "— Merah Berkedip: Pesanan kritis / darurat (> 15 menit) yang harus segera diprioritaskan!",
        "Koki dapat mencentang nama menu satu per satu di layar sentuh saat menu tersebut selesai dibakar/diracik.",
        "Ketika seluruh pesanan selesai: Cukup tekan tombol hijau besar '✅ Pesanan Telah Dibuat' (1-Tap Completion).",
        "Kartu pesanan akan berpindah otomatis ke tab 'Selesai Hari Ini'.",
      ],
      tip: "Jika tidak sengaja menekan selesai, buka tab 'Selesai Hari Ini' lalu klik tombol 'Kembalikan ke Antrean' untuk mengembalikannya ke layar aktif.",
      linkHref: "/dashboard/kitchen",
      linkLabel: "Buka Layar Dapur (KDS)",
    },
    {
      id: "kds_reprint",
      category: "kds",
      title: "Cetak Ulang Tiket Dapur (KOT) dari Layar Monitor",
      summary: "Mencetak kembali tiket dapur fisik jika tiket sebelumnya hilang atau terkena bumbu.",
      steps: [
        "Pada kartu pesanan yang sedang aktif di Layar Dapur, klik ikon printer abu-abu di pojok kiri bawah kartu.",
        "Pop-up jendela cetak thermal akan terbuka dengan format tiket dapur khusus (huruf besar, tanpa nominal rupiah).",
        "Tekan Enter atau klik Cetak.",
      ],
      tip: "Tiket dapur otomatis menggunakan kalkulasi panjang hemat kertas (48mm) sehingga tidak boros kertas thermal.",
      linkHref: "/dashboard/kitchen",
      linkLabel: "Cek Fitur Dapur",
    },

    // ================= GUDANG & INVENTARIS =================
    {
      id: "inv_restock",
      category: "inventory",
      title: "Restock Bahan Baku & Kalkulasi HPP Rata-Rata (AVCO)",
      summary: "Mencatat pembelian bahan baku mentah dan menghitung harga pokok rata-rata otomatis.",
      steps: [
        "Buka menu 'Gudang Bahan Baku' di sidebar.",
        "Pilih bahan baku yang ingin ditambah stoknya (misal: Daging Ayam Fillet), lalu klik tombol 'Restock'.",
        "Masukkan Jumlah Qty yang dibeli (misal: 5000 gram) dan Total Biaya Pembelian atau Harga Satuan baru.",
        "Sistem secara otomatis menghitung Moving Weighted Average Cost (AVCO):",
        "— Nilai HPP bahan baku diperbarui secara proporsional sesuai harga beli pasar tanpa mengacaukan kalkulasi profit sebelumnya.",
        "Klik 'Simpan Restock'. Stok gudang langsung bertambah dan transaksi kas keluar operasional otomatis tercatat.",
      ],
      tip: "Selalu input restock dalam satuan dasar resep (misal: jika resep pakai gram, input restock dalam gram, bukan kg) agar kalkulasi HPP akurat.",
      linkHref: "/dashboard/ingredients",
      linkLabel: "Buka Gudang Bahan Baku",
    },
    {
      id: "inv_waste",
      category: "inventory",
      title: "Pencatatan Limbah & Makanan Basi/Rusak (Waste Management)",
      summary: "Mencegah kebocoran profit dengan mendokumentasikan bahan baku yang terbuang.",
      steps: [
        "Buka menu 'Gudang Bahan Baku' -> klik tombol 'Catat Waste / Basi' di bagian atas.",
        "Pilih Bahan Baku yang rusak atau basi.",
        "Masukkan jumlah kuantitas yang dibuang.",
        "Pilih kategori alasan: 'Basi / Busuk', 'Kadaluwarsa', 'Rusak / Tumpah', atau 'Gagal Olah / Gosong'.",
        "Sistem akan langsung menghitung estimasi kerugian nominal Rupiah berdasarkan HPP bahan tersebut.",
        "Klik 'Simpan Waste'. Stok gudang otomatis dikurangi dan dicatat di laporan audit kerugian.",
      ],
      tip: "Audit waste rutin membantu pemilik restoran mengetahui apakah freezer mati, koki terlalu banyak membuang potongan lemak ayam, atau bahan dibeli berlebihan.",
      linkHref: "/dashboard/ingredients/waste",
      linkLabel: "Buka Halaman Waste",
    },
    {
      id: "inv_opname",
      category: "inventory",
      title: "Stock Opname Fisik & Rekonsiliasi Selisih Stok Otomatis",
      summary: "Mencocokkan jumlah fisik di dapur dengan angka di komputer secara periodik.",
      steps: [
        "Buka menu 'Gudang Bahan Baku' -> klik tombol 'Lembar Stock Opname'.",
        "Klik tombol 'Mulai Sesi Opname Baru'.",
        "Gunakan tombol 'Salin Stok Sistem ke Fisik' jika ingin mengisi nilai awal dengan cepat.",
        "Hitung fisik bahan di kulkas/gudang, lalu masukkan angka riil di kolom 'Stok Fisik'.",
        "Sistem langsung menghitung 'Selisih (Varians)' dan 'Nilai Kerugian/Keuntungan Selisih (Rp)'.",
        "Jika sudah yakin, klik tombol hijau 'Terapkan Rekonsiliasi Stok'.",
        "Stok gudang di sistem akan seketika disesuaikan dengan fisik nyata, dan riwayat penyesuaian (adjustment) dicatat rapi.",
      ],
      tip: "Lakukan stock opname minimal 1 minggu sekali saat outlet tutup agar selisih barang akibat pencurian atau takaran berlebih bisa cepat terdeteksi.",
      linkHref: "/dashboard/ingredients/opname",
      linkLabel: "Buka Stock Opname",
    },

    // ================= PRODUK & HPP =================
    {
      id: "prod_recipe",
      category: "products",
      title: "Membuat Menu Baru, Resep Bahan Baku & HPP Otomatis",
      summary: "Menghubungkan menu makanan dengan bahan mentah di gudang.",
      steps: [
        "Buka menu 'Produk & HPP' dari sidebar.",
        "Klik tombol '+ Tambah Produk Baru'.",
        "Pilih Tipe Pemenuhan:",
        "— 'Make-to-Order (MTO)': Untuk makanan segar yang dimasak saat pesanan masuk (Sate Taichan, Nasi Goreng). Sistem akan memotong bahan mentah resep.",
        "— 'Make-to-Stock (MTS)': Untuk barang jadi kemasan (Teh Botol, Kerupuk, Es Krim). Sistem memotong stok produk jadi.",
        "Pilih Bahan Baku resep dan masukkan takaran per porsi (misal: 120 gram Daging Ayam, 15 gram Cabai Rawit).",
        "Sistem secara instan menjumlahkan total HPP Modal per porsi.",
        "Masukkan Harga Jual Offline yang diinginkan. Margin keuntungan (%) akan tampil otomatis.",
      ],
      tip: "Jika margin keuntungan di bawah 50%, indikator akan berwarna kuning/merah mengingatkan Anda untuk menaikkan harga jual atau mengurangi gramasi.",
      linkHref: "/dashboard/products",
      linkLabel: "Kelola Produk & Resep",
    },
    {
      id: "prod_gofood_markup",
      category: "products",
      title: "Mengatur Harga Jual GoFood dengan Tombol Markup Cepat",
      summary: "Menentukan harga GoFood agar tidak boncos terkena komisi aplikasi 20%.",
      steps: [
        "Pada modal edit atau tambah produk di menu 'Produk & HPP', temukan bagian 'Harga Khusus GoFood'.",
        "Gunakan tombol shortcut markup otomatis:",
        "— Tombol [+20%]: Menaikkan harga sebesar 20% dari harga offline.",
        "— Tombol [+25%]: Rekomendasi standar agar net payout sama dengan harga offline.",
        "— Tombol [+30%]: Untuk mendapatkan keuntungan lebih tinggi di aplikasi online.",
        "Perhatikan box 'Estimasi Pencairan Bersih (Net Payout)': Ini adalah uang riil yang akan ditransfer Gojek ke rekening Anda per porsi.",
        "Klik 'Simpan Produk'.",
      ],
      tip: "Selalu gunakan tombol markup minimal +25% agar setelah dipotong komisi 20% oleh Gojek, uang bersih yang Anda terima tidak lebih kecil dari harga jual offline!",
      linkHref: "/dashboard/products",
      linkLabel: "Atur Harga GoFood",
    },

    // ================= KEUANGAN & INVESTOR =================
    {
      id: "fin_cashbook",
      category: "finance",
      title: "Buku Kas & Pencatatan Biaya Operasional",
      summary: "Mendokumentasikan pengeluaran harian seperti token listrik, gas LPG, es batu, dan gaji.",
      steps: [
        "Buka menu 'Buku Kas & Pengeluaran' di bagian Keuangan.",
        "Klik '+ Catat Kas Keluar' untuk mencatat pengeluaran.",
        "Pilih kategori: Listrik & Air, Gas LPG, Gaji Karyawan, Sewa Tempat, Perlengkapan, dll.",
        "Masukkan nominal uang yang keluar dan keterangan bon/nota.",
        "Pastikan opsi 'Biaya Operasional' tercentang agar otomatis mengurangi Laba Bersih di laporan investor.",
        "Klik Simpan.",
      ],
      tip: "Biaya pembelian bahan baku tidak perlu dicatat manual di sini jika sudah diinput lewat menu Restock Bahan Baku.",
      linkHref: "/dashboard/cash",
      linkLabel: "Buka Buku Kas",
    },
    {
      id: "fin_investor",
      category: "finance",
      title: "Laporan Distribusi Laba & Bagi Hasil Investor Transparan",
      summary: "Membuat laporan keuangan resmi bulanan untuk internal dan investor.",
      steps: [
        "Buka menu 'Lap. Bagi Hasil (Investor)' di sidebar.",
        "Pilih Bulan dan Tahun laporan yang ingin dilihat di pojok kanan atas.",
        "Sistem menampilkan laporan transparan berstandar akuntansi:",
        "— Bagian A (Omzet Penjualan): Rincian penjualan offline vs penjualan bruto GoFood, potongan komisi GoFood, dan total uang bersih riil.",
        "— Bagian B (Biaya Operasional): Total HPP bahan baku yang terkonsumsi + seluruh pengeluaran operasional outlet.",
        "— Bagian C (Laba Bersih): Hasil akhir Laba Riil yang siap dibagikan.",
        "— Bagian D (Distribusi Hak Laba): Pembagian otomatis ke Investor (Pihak Pertama), Pengelola (Pihak Kedua), dan Kas Cadangan.",
        "Klik tombol oranye '🖨️ Cetak & Unduh PDF Resmi' untuk mengunduh dokumen laporan yang siap ditandatangani kedua belah pihak.",
      ],
      tip: "Laporan ini 100% transparan karena otomatis membaca transaksi kasir tanpa bisa direkayasa manual.",
      linkHref: "/dashboard/reports/monthly-distribution",
      linkLabel: "Buka Laporan Investor",
    },

    // ================= THERMAL PRINTER =================
    {
      id: "printer_rongta",
      category: "printer",
      title: "Panduan Cetak Thermal 58mm & Solusi Kertas Keluar Panjang (Rongta/VSC)",
      summary: "Mengatasi masalah kertas struk thermal yang keluar terlalu panjang di Windows & Chrome.",
      steps: [
        "Kenapa kertas keluar panjang? Driver Rongta 58mm di Windows defaultnya memakai ukuran halaman 210mm (panjang A4), sehingga jika browser tidak membatasi tinggi, printer akan terus menggulung kertas kosong.",
        "Solusi yang disediakan sistem: Sistem Taichan POS kini menghitung tinggi konten struk secara otomatis dalam milimeter (@page size 48mm Xmm).",
        "Di modal pop-up cetak kasir, pastikan dropdown pilihan panjang kertas disetel ke 'Auto-Fit (Hemat)' atau pilih tinggi fix (misal: 80mm / 110mm).",
        "Saat dialog print Chrome/Edge muncul, lakukan pengaturan 1 KALI:",
        "— Destination: Pilih printer thermal Anda (misal: POS-58 atau Rongta 58mm).",
        "— Margins: Ubah dari 'Default' menjadi 'None' (Tanpa Margin).",
        "— Options: HILANGKAN centang pada 'Headers and footers' (agar tanggal dan URL web tidak tercetak).",
        "Klik Cetak. Kertas akan otomatis berhenti pas di akhir struk (hanya sekitar 65-85mm) dan menghemat kertas Anda!",
      ],
      tip: "Chrome akan mengingat setelan 'Margins: None' dan 'Headers and footers: Off' untuk cetakan berikutnya, jadi Anda cukup menyetelnya sekali saja.",
      linkHref: "/dashboard/orders",
      linkLabel: "Coba Cetak Struk",
    },
  ];

  // Filter guides based on search and category
  const filteredGuides = guides.filter((g) => {
    const matchesCat = activeCategory === "all" || g.category === activeCategory;
    const matchesSearch =
      searchQuery === "" ||
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.steps.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-orange-500/10 relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold tracking-wide text-white">
            <Sparkles className="w-3.5 h-3.5" />
            Dokumentasi & SOP Operasional
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Buku Panduan & Tata Cara Penggunaan Sistem
          </h1>
          <p className="text-orange-50 text-sm max-w-2xl leading-relaxed">
            Petunjuk lengkap langkah demi langkah untuk kasir, koki, manajer gudang, dan pemilik usaha.
            Pelajari alur pesanan, layar dapur, stok opname, dual price GoFood, hingga transparansi bagi hasil investor.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mt-6 relative max-w-xl z-10">
          <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari tutorial... (misal: GoFood, cetak struk, open bill, opname, kds)"
            className="w-full pl-11 pr-4 py-2.5 bg-white text-slate-900 rounded-2xl text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg"
            >
              Hapus
            </button>
          )}
        </div>

        {/* Background decorative circles */}
        <div className="absolute -right-8 -bottom-12 w-64 h-64 rounded-full bg-white/10 pointer-events-none blur-2xl" />
      </div>

      {/* Quick Daily Flow Timeline */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-orange-500" />
          <h2 className="text-base font-extrabold text-slate-900">
            Alur Cepat Operasional Harian (Daily SOP Flow)
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          Ikuti urutan 5 langkah praktis ini dari outlet buka di pagi hari sampai tutup di malam hari:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          <div className="bg-orange-50/60 border border-orange-200/60 rounded-2xl p-4 flex flex-col justify-between space-y-2">
            <div>
              <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-black text-xs flex items-center justify-center mb-2">
                1
              </span>
              <h3 className="font-bold text-slate-900 text-xs">Buka Shift & Cek Stok</h3>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Buka menu Gudang. Pastikan stok ayam fillet, cabai, dan bumbu cukup untuk estimasi penjualan hari ini.
              </p>
            </div>
            <Link href="/dashboard/ingredients" className="text-[11px] font-bold text-orange-600 hover:underline flex items-center gap-1">
              Cek Gudang <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-2">
            <div>
              <span className="w-6 h-6 rounded-full bg-slate-700 text-white font-black text-xs flex items-center justify-center mb-2">
                2
              </span>
              <h3 className="font-bold text-slate-900 text-xs">Terima Pesanan di Kasir</h3>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Pilih Dine-In (pilih meja), Bungkus, atau GoFood. Gunakan 'Open Bill' jika tamu bayar setelah makan.
              </p>
            </div>
            <Link href="/dashboard/orders" className="text-[11px] font-bold text-orange-600 hover:underline flex items-center gap-1">
              Buka Kasir <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-2">
            <div>
              <span className="w-6 h-6 rounded-full bg-slate-700 text-white font-black text-xs flex items-center justify-center mb-2">
                3
              </span>
              <h3 className="font-bold text-slate-900 text-xs">Dapur Memasak (KDS)</h3>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Koki memantau Layar Dapur, cek timer tunggu, centang item matang, lalu 1-tap 'Pesanan Telah Dibuat'.
              </p>
            </div>
            <Link href="/dashboard/kitchen" className="text-[11px] font-bold text-orange-600 hover:underline flex items-center gap-1">
              Layar Dapur <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-2">
            <div>
              <span className="w-6 h-6 rounded-full bg-slate-700 text-white font-black text-xs flex items-center justify-center mb-2">
                4
              </span>
              <h3 className="font-bold text-slate-900 text-xs">Pelunasan & Struk</h3>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Lunasi meja dari tab 'Meja Aktif'. Cetak struk pelanggan atau cetak slip kantong khusus GoFood.
              </p>
            </div>
            <Link href="/dashboard/orders" className="text-[11px] font-bold text-orange-600 hover:underline flex items-center gap-1">
              Lunasi Meja <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-2">
            <div>
              <span className="w-6 h-6 rounded-full bg-slate-700 text-white font-black text-xs flex items-center justify-center mb-2">
                5
              </span>
              <h3 className="font-bold text-slate-900 text-xs">Tutup & Rekonsiliasi</h3>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Hitung sisa fisik (Stock Opname), catat limbah jika ada, dan cek laporan omzet & bagi hasil investor.
              </p>
            </div>
            <Link href="/dashboard/reports/monthly-distribution" className="text-[11px] font-bold text-orange-600 hover:underline flex items-center gap-1">
              Lap. Investor <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Category Pills Navigation */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          const count = cat.id === "all" ? guides.length : guides.filter((g) => g.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Guides List */}
      <div className="space-y-4">
        {filteredGuides.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500">
            <HelpCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-base">Tidak ada panduan yang cocok</h3>
            <p className="text-xs text-slate-400 mt-1">
              Coba gunakan kata kunci pencarian lain atau pilih kategori 'Semua Panduan'.
            </p>
          </div>
        ) : (
          filteredGuides.map((guide) => {
            const isExpanded = expandedTopics[guide.id];
            return (
              <div
                key={guide.id}
                className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs hover:border-slate-300 transition-all"
              >
                {/* Accordion Header */}
                <div
                  onClick={() => toggleTopic(guide.id)}
                  className="p-5 sm:p-6 flex items-start justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 border border-orange-200">
                        {categories.find((c) => c.id === guide.category)?.label || "Umum"}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-slate-900 leading-snug">
                      {guide.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {guide.summary}
                    </p>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-700 shrink-0">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-slate-100 space-y-4">
                    {/* Steps List */}
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                        Langkah-Langkah:
                      </h4>
                      <ol className="space-y-2">
                        {guide.steps.map((step, idx) => (
                          <li key={idx} className="text-xs text-slate-700 flex items-start gap-2.5 leading-relaxed">
                            <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="flex-1">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Pro Tip Box */}
                    {guide.tip && (
                      <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/70 flex items-start gap-2.5 text-amber-900 text-xs">
                        <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Tips Praktis: </span>
                          <span>{guide.tip}</span>
                        </div>
                      </div>
                    )}

                    {/* Direct Shortcut Link */}
                    {guide.linkHref && (
                      <div className="pt-2 flex justify-end">
                        <Link
                          href={guide.linkHref}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 text-xs font-bold transition-colors"
                        >
                          <span>{guide.linkLabel || "Buka Halaman Terkait"}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* FAQ Accordion Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-5 shadow-sm">
        <div className="space-y-1 border-b pb-4 border-slate-100">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-orange-500" />
            Pertanyaan yang Sering Diajukan (FAQ)
          </h2>
          <p className="text-xs text-slate-500">
            Jawaban kilat untuk kendala operasional yang sering terjadi di restoran.
          </p>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
            <p className="font-bold text-slate-900">
              Q: Mengapa hasil bagi hasil investor GoFood berbeda dengan total omzet kotor?
            </p>
            <p className="text-slate-600 leading-relaxed">
              J: Karena GoFood memotong komisi platform sebesar 20%. Uang yang masuk ke rekening bank adalah <strong>Net Payout (80%)</strong>. Jika bagi hasil dihitung dari omzet kotor 100%, restoran akan tekor membagikan uang yang sebenarnya tidak pernah masuk ke kantong. Sistem Taichan POS secara otomatis menghitung bagi hasil berbasis uang bersih riil!
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
            <p className="font-bold text-slate-900">
              Q: Bagaimana jika koki tidak sengaja menekan tombol 'Pesanan Telah Dibuat'?
            </p>
            <p className="text-slate-600 leading-relaxed">
              J: Jangan panik! Buka tab <strong>'Selesai Hari Ini'</strong> di Layar Dapur, cari pesanan tersebut, lalu klik tombol <strong>'Batal Selesai'</strong>. Pesanan akan kembali ke antrean aktif seketika.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
            <p className="font-bold text-slate-900">
              Q: Apakah kasir bisa menghapus pesanan untuk mencurangi uang kas?
            </p>
            <p className="text-slate-600 leading-relaxed">
              J: <strong>Tidak bisa.</strong> Pembatalan pesanan di kasir bersifat <em>non-destructive</em>. Nomor pesanan tetap ada dengan status 'Cancelled', alasan pembatalan wajib dicatat, dan jika makanan sudah dibuat, HPP-nya otomatis dicatat ke riwayat kerugian limbah (waste). Pemilik dan investor bisa mengaudit setiap pesanan yang dibatalkan.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
            <p className="font-bold text-slate-900">
              Q: Bagaimana cara agar printer thermal tidak mencetak tulisan URL website atau tanggal di pojok kertas?
            </p>
            <p className="text-slate-600 leading-relaxed">
              J: Pada jendela cetak Chrome/Edge (tekan Ctrl+P), klik <em>More settings</em>, lalu <strong>HILANGKAN CENTANG pada pilihan 'Headers and footers'</strong>. Struk Anda akan tercetak bersih dan profesional.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

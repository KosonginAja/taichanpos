# Rencana Fase 3a — Persiapan Integrasi Delivery Platform (GoFood & ShopeeFood)

## 1. Kondisi Nyata (hasil riset)

- **GoFood (GoBiz)**: punya developer portal publik (`developer.gobiz.com`). Dua jalur integrasi:
  - _Direct Integration_: host-to-host untuk 1 merchant, OAuth2 client_credentials, butuh App ID & Secret dari GoBiz.
  - _Facilitator Model_: untuk penyedia POS pihak ketiga yang mau menyambungkan banyak merchant sekaligus di bawah satu akun partner — cocok kalau Taralaya mau tawarkan fitur ini ke klien lain juga ke depannya. Wajib daftar & disetujui sebagai "GoBiz Partner" dulu (ada form pengajuan resmi).
- **ShopeeFood**: tidak ditemukan developer portal publik/self-serve sejelas GoBiz untuk konteks Indonesia. Kemungkinan besar akses API integrasi POS harus lewat kontak Business Development Shopee secara langsung, bukan pendaftaran mandiri.

**Konsekuensi**: endpoint, format payload, dan mekanisme autentikasi final baru bisa dipastikan setelah kredensial developer/sandbox didapat dari masing-masing platform. Menulis kode integrasi spesifik sekarang berisiko salah tebak dan harus ditulis ulang. Fase 3a ini fokus ke **persiapan arsitektur yang platform-agnostic**, bukan integrasi final.

## 2. Yang Disiapkan di Fase 3a

### Perubahan pada `orders`

Tambahan kolom:

```
source   text not null default 'pos'   -- 'pos' | 'gofood' | 'shopeefood' (nilai lain nanti ditambah sesuai platform yang jadi terhubung)
```

### `external_order_channels` (tabel baru — tempat kredensial & status koneksi per platform)

```
id                serial primary key
platform          text not null unique   -- 'gofood' | 'shopeefood'
outletExternalId  text                   -- ID outlet di sisi platform, diisi setelah linking berhasil
apiCredentials     text                   -- kredensial terenkripsi (App ID/Secret/token), diisi manual setelah didapat dari platform
isActive          boolean not null default false
lastSyncAt        timestamp
createdAt / updatedAt
```

### Endpoint Webhook Generik (skeleton)

`POST /api/webhooks/delivery-orders` — struktur dasar penerima notifikasi order dari platform delivery, insert ke `orders` dengan `source` sesuai platform pengirim. Payload parsing per-platform (GoFood vs ShopeeFood beda format) **baru diisi detailnya setelah dokumentasi API resmi masing-masing didapat** — di fase ini cukup skeleton + validasi signature dasar.

### Halaman Pengaturan — Section "Integrasi Delivery Platform"

Placeholder UI: kartu status per platform ("Belum Terhubung" / "Terhubung"), tombol "Hubungkan" yang nanti diisi form input kredensial begitu tersedia. Untuk sekarang cukup menunjukkan status, tidak ada fungsi live.

### Dokumentasi Internal

`docs/DELIVERY_INTEGRATION_NOTES.md` — catatan progres pendaftaran partner (status aplikasi GoBiz Partner, kontak BD Shopee yang sudah dihubungi, kredensial yang sudah/belum didapat) supaya prosesnya gak hilang track meskipun makan waktu berminggu-minggu (approval partner biasanya bukan proses instan).

## 3. Urutan Pengerjaan

1. Ajukan pendaftaran GoBiz Partner (Facilitator Model) via form di `developer.gobiz.com`
2. Hubungi tim BD Shopee/ShopeeFood untuk menanyakan jalur akses API integrasi POS eksternal
3. Tambah kolom `source` di `orders`, tabel `external_order_channels`, migrasi ke Neon
4. Bangun skeleton endpoint webhook generik `/api/webhooks/delivery-orders`
5. Bangun UI placeholder "Integrasi Delivery Platform" di halaman Pengaturan
6. Buat `docs/DELIVERY_INTEGRATION_NOTES.md` untuk tracking progres aplikasi partner
7. **Menunggu approval/kredensial dari GoFood dan/atau ShopeeFood** — begitu didapat, baru masuk Fase 3b (implementasi final: OAuth flow, catalog/menu sync, parsing payload order asli, rekonsiliasi ke `cash_pockets`/HPP)

## 4. Keputusan Desain & Asumsi

- Kredensial API (`apiCredentials`) disimpan terenkripsi, bukan plaintext — detail metode enkripsi ditentukan saat implementasi (misal via `crypto` Node built-in dengan key dari environment variable, bukan hardcoded).
- Fase 3a **tidak** membuat integrasi yang benar-benar jalan — outputnya adalah kerangka yang siap diisi begitu API access nyata didapat. Jangan menganggap fitur ini "selesai" sampai Fase 3b tuntas.
- Prioritas pendaftaran: GoFood duluan (jalur lebih jelas & self-serve) sambil paralel hubungi Shopee BD, karena timeline approval ShopeeFood kemungkinan lebih tidak terprediksi.

## 5. Fase 3b (belum bisa direncanakan detail — menunggu API access)

Setelah kredensial didapat dari masing-masing platform, baru disusun rencana rinci untuk:

- OAuth2 flow & penyimpanan token per platform
- Sinkronisasi katalog/menu (POS → platform, satu arah)
- Parsing & penanganan order masuk sesuai format asli tiap platform
- Auto-86 stok (produk otomatis disembunyikan di platform kalau stok bahan habis)
- Rekonsiliasi pembayaran platform terhadap `cash_pockets`/Laporan Arus Kas (payout dari GoFood/ShopeeFood biasanya net setelah potongan komisi — perlu kategori kas masuk tersendiri, bukan digabung sama kategori "Penjualan" dari POS langsung)

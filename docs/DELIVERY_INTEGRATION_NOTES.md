# Panduan & Catatan Integrasi Delivery Platform (GoFood & ShopeeFood)

Dokumen ini melacak progres pendaftaran akun partner pengembang (developer) dan status sandbox untuk masing-masing delivery platform.

## 1. Integrasi GoFood (GoBiz Partner)
GoGek menyediakan platform pengembang mandiri melalui **GoBiz Developer Portal**.

### Langkah Pendaftaran
1. Kunjungi **[developer.gobiz.com](https://developer.gobiz.com)**.
2. Daftar akun baru menggunakan email bisnis resmi.
3. Ajukan akses partner POS menggunakan **Facilitator Model** (agar satu integrasi API POS bisa dipakai oleh banyak outlet client Taralaya POS).
4. Setelah disetujui, Anda akan mendapatkan:
   - **App ID**
   - **App Secret**
   - Akses ke Merchant Sandbox untuk pengujian transaksi tiruan.

### Status Sandbox Kredensial (GoFood)
*   **App ID**: `[Belum Diisi]`
*   **App Secret**: `[Belum Diisi]`
*   **Status Approval**: `Pending` (Menunggu pengajuan mandiri oleh Owner/Developer)

---

## 2. Integrasi ShopeeFood
Shopee tidak memiliki developer portal mandiri yang bersifat publik di Indonesia.

### Langkah Pendaftaran
1. Hubungi **Business Development (BD) Shopee / Shopee Food** melalui kontak Merchant Relations Anda.
2. Ajukan permintaan "Integrasi API POS Pihak Ketiga (External POS Integration)".
3. Tim BD Shopee akan memberikan dokumen spesifikasi API dan formulir persetujuan merchant.
4. Setelah disetujui, tim teknis Shopee akan mengirimkan kredensial API berupa Client ID / Token akses khusus untuk lingkungan Sandbox.

### Status Sandbox Kredensial (ShopeeFood)
*   **Client ID**: `[Belum Diisi]`
*   **Client Secret / Token**: `[Belum Diisi]`
*   **Status Approval**: `Pending` (Menunggu respon/kontak ke BD Shopee)

---

## 3. Langkah Lanjutan Setelah Kredensial Diperoleh (Fase 3b)
Begitu salah satu atau kedua kredensial di atas diperoleh:
1. Masukkan kredensial ke menu **Pengaturan Usaha -> Integrasi Delivery** di POS Taralaya (fitur placeholder sudah disediakan di halaman settings).
2. Ubah berkas webhook riil di `/api/webhooks/delivery-orders` untuk memproses payload order masuk sesuai format JSON resmi GoBiz/Shopee.
3. Aktifkan sinkronisasi menu dan kontrol stok.

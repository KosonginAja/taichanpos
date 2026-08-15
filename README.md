# Food POS & Inventory System (HPP, Gudang, Pesanan & Struk)

Aplikasi Web Point of Sales (POS) dan Manajemen Stok terintegrasi untuk UMKM makanan/minuman, dibangun dengan Next.js App Router, Tailwind CSS, PostgreSQL (Neon), dan Drizzle ORM.

## 🚀 Fitur Utama
1. **Kalkulasi HPP Real-time**: Hitung harga pokok produksi dinamis berdasarkan komposisi resep terbaru.
2. **Gudang & Audit Log**: Kontrol stok masuk/penyesuaian dengan catatan histori lengkap (`stock_movements`).
3. **Kasir POS & Validasi Stok**: Checkout multi-item dengan validasi otomatis terhadap ketersediaan bahan baku di gudang sebelum transaksi diproses (Database Transaction).
4. **Cetak Struk Thermal**: Halaman struk format thermal 58mm/80mm siap print dengan dukungan Chrome Kiosk Printing.
5. **Dashboard & Ekspor Laporan**: Visualisasi omzet/profit bulanan dan ekspor spreadsheet CSV.

---

## 🛠️ Panduan Setup & Instalasi Lokal

### 1. Prasyarat (Prerequisites)
- Node.js versi 18 atau lebih baru.
- Akun/Database PostgreSQL (Direkomendasikan menggunakan [Neon.tech](https://neon.tech/)).

### 2. Kloning & Instalasi Dependensi
```bash
# Masuk ke direktori project
cd "POS - Gweh"

# Install semua package/dependensi
npm install
```

### 3. Konfigurasi Environment Variables
Salin file `.env.example` menjadi `.env` di root project:
```bash
cp .env.example .env
```
Isi variabel berikut di dalam `.env`:
- `DATABASE_URL`: Connection string dari Neon PostgreSQL.
- `BETTER_AUTH_SECRET`: String random (panjang bebas) sebagai pengaman enkripsi sesi token.
- `BETTER_AUTH_URL`: Url lokal app, biasanya `http://localhost:3000`.

### 4. Sinkronisasi Skema Database (Drizzle Migration)
Untuk membuat tabel-tabel di database Neon, jalankan perintah Drizzle berikut:
```bash
# Push skema langsung ke Neon PostgreSQL
npx drizzle-kit push
```

### 5. Menjalankan Aplikasi Secara Lokal
```bash
# Jalankan development server
npm run dev
```
Aplikasi dapat dibuka di browser pada URL: [http://localhost:3000](http://localhost:3000).

> [!TIP]
> **Pendaftar Pertama Otomatis Menjadi Admin**: Saat pertama kali membuka halaman registrasi, akun pertama yang terdaftar akan otomatis memiliki peran (role) **Admin** untuk konfigurasi awal menu makanan dan bahan baku.

---

## 🖥️ Konfigurasi Printer Thermal (Chrome Kiosk Printing)

Agar kasir dapat langsung mencetak struk transaksi tanpa memunculkan kotak dialog cetak browser (print preview), ikuti panduan berikut:

### Windows:
1. Pastikan Printer Thermal Anda (58mm atau 80mm) sudah terinstall di OS dan diset sebagai **Default Printer**.
2. Tutup semua jendela browser Google Chrome yang sedang aktif.
3. Buka menu Run (`Win + R`), ketik perintah berikut, lalu tekan Enter:
   ```cmd
   chrome.exe --kiosk-printing
   ```
   Atau buat shortcut Chrome baru, klik kanan → **Properties**, lalu tambahkan `--kiosk-printing` di ujung kolom **Target**:
   `"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing`

### macOS / Linux:
Jalankan Chrome melalui Terminal dengan parameter berikut:
```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --kiosk-printing

# Linux
google-chrome --kiosk-printing
```

Setelah mode ini aktif, menekan tombol **"Cetak Struk"** pada POS otomatis memicu mesin mencetak struk thermal langsung.

---

## ☁️ Panduan Deploy ke Vercel

1. Buat project baru di **Vercel** dan sambungkan ke repositori Git project ini.
2. Pada pengaturan project di Vercel, tambahkan Environment Variables:
   - `DATABASE_URL` (Sama dengan nilai koneksi database Neon)
   - `BETTER_AUTH_SECRET` (Sama dengan secret lokal)
   - `BETTER_AUTH_URL` (URL domain production Anda, misal: `https://gwehpos.vercel.app`)
3. Jalankan deploy. Vercel akan otomatis mendeteksi konfigurasi Next.js App Router dan melakukan build.

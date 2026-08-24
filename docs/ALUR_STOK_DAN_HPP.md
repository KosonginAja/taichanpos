# Dokumentasi Alur Stok & Perhitungan HPP Sate

Dokumen ini menjelaskan alur operasional, konfigurasi sistem, dan perhitungan HPP untuk menu **Sate** pada aplikasi POS & Inventory.

---

## 1. Alur Stok (Gudang ke Produk Jadi)

Sistem menggunakan model **Produksi (Semi-Manufaktur)** untuk memisahkan bahan mentah di gudang dengan produk jadi di kasir.

```mermaid
graph LR
    Gudang[Gudang Bahan Baku<br/>Daging Mentah: kg] -->|Proses Produksi<br/>Potong & Tusuk| Produk[Produk Kasir<br/>Sate Porsi: porsi]
    Produk -->|Transaksi Kasir| Penjualan[Pengurangan Stok Produk]
```

### Konsep Konversi Stok Sate
*   **Bahan Baku (Gudang):** `Daging` diukur dalam satuan **kg** (kilogram).
*   **Rasio Tusuk:** 1 kg daging = 40 tusuk sate.
*   **Porsi Jual (Kasir):** 1 porsi sate = 10 tusuk.
*   **Rasio Porsi:** 1 kg daging = 4 porsi sate (karena 40 tusuk / 10 tusuk = 4 porsi).

---

## 2. Opsi Konfigurasi Resep di Sistem POS

Ada dua cara untuk menginput resep ini ke dalam sistem. Keduanya menghasilkan HPP dan pemotongan stok bahan baku yang sama secara matematis.

### Opsi A: Menggunakan Batch 1 kg (Sangat Direkomendasikan)
Opsi ini paling mudah diinput karena tidak memerlukan pecahan desimal yang rumit untuk bahan baku utama.

*   **Nama Produk:** Sate (1 Porsi)
*   **Yield Quantity (Hasil per Resep):** 4 (Porsi)
*   **Bahan Baku Resep:**
    *   `Daging Mentah` -> Qty: 1 (kg)
    *   `Tusuk Sate` -> Qty: 40 (pcs)

> **Cara Kerja Produksi:** Ketika admin memproduksi **4 porsi** sate, sistem otomatis memotong **1 kg** daging dan **40** tusuk sate dari gudang, lalu menambah **4 porsi** ke stok produk sate siap jual.

### Opsi B: Menggunakan Batch 1 Porsi
Opsi ini fokus pada kebutuhan per porsi tunggal.

*   **Nama Produk:** Sate (1 Porsi)
*   **Yield Quantity (Hasil per Resep):** 1 (Porsi)
*   **Bahan Baku Resep:**
    *   `Daging Mentah` -> Qty: 0.25 (kg) (didapat dari 1 kg / 4)
    *   `Tusuk Sate` -> Qty: 10 (pcs)

---

## 3. Simulasi Perhitungan HPP (Harga Pokok Penjualan)

HPP dihitung secara dinamis berdasarkan harga beli terbaru dari bahan baku di gudang.

### Rumus HPP per Porsi
HPP per Porsi = (Jumlah (Qty Resep Bahan * Harga Terakhir Bahan)) / Yield Quantity

### Contoh Simulasi Angka
Misalkan harga bahan baku saat ini:
1.  **Daging Mentah:** Rp 120.000 / kg
2.  **Tusuk Sate:** Rp 10.000 / pak (isi 500 pcs) -> Rp 20 / pcs
3.  **Bumbu & Arang (Pelengkap):** Estimasi Rp 2.000 / porsi (atau dimasukkan ke bahan baku porsi)

#### Perhitungan menggunakan Opsi A (Batch 4 Porsi):
*   **Total Biaya Daging (1 kg):** 1 * Rp 120.000 = Rp 120.000
*   **Total Biaya Tusuk (40 pcs):** 40 * Rp 20 = Rp 800
*   **Total Biaya Bumbu (estimasi):** 4 porsi * Rp 2.000 = Rp 8.000
*   **Total Biaya 1 Batch (4 Porsi):** Rp 128.800

HPP per Porsi = Rp 128.800 / 4 = Rp 32.200

Jika sate dijual seharga **Rp 45.000 / porsi**, maka profit per porsinya adalah:
Profit per Porsi = Rp 45.000 - Rp 32.200 = Rp 12.800

---

## 4. Alur Pemotongan Stok Aktual saat Operasional

1.  **Restock Gudang:** Admin membeli daging mentah (misal 10 kg) -> Stok `Daging Mentah` di Gudang bertambah menjadi 10 kg.
2.  **Proses Produksi:** Di pagi hari/sebelum buka, admin/koki menusuk sate. Mereka menggunakan 5 kg daging -> Admin input produksi **20 porsi** Sate di menu Produksi.
    *   Stok `Daging Mentah` di Gudang berkurang: 5 kg (sisa 5 kg).
    *   Stok `Sate (1 Porsi)` di Kasir bertambah: **20 porsi**.
3.  **Transaksi Kasir (Checkout):** Kasir menjual 2 porsi Sate.
    *   Stok `Sate (1 Porsi)` di Kasir berkurang: **2 porsi** (sisa 18 porsi).
    *   Stok bahan baku di gudang **tidak berubah** saat checkout kasir karena sudah dipotong di awal saat produksi.

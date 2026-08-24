# Rencana — Kesesuaian Sistem dengan Perjanjian Investor "SATELITE" & Analisis Menu

## Bagian A — Kesesuaian dengan Perjanjian Kerjasama SATELITE

### Ringkasan Kontrak (relevan ke sistem)

- Biaya operasional inti (dikurangkan dari omzet SEBELUM Laba Bersih): **Bahan Baku, Sewa Tempat, Gas, Listrik**, + biaya lain yang **disetujui bersama**.
- Laba Bersih dihitung & dibagi **sebulan sekali, paling lambat tanggal 5 bulan berikutnya**.
- Split Laba Bersih: **PIHAK PERTAMA 40%, PIHAK KEDUA 40%, Dana Cadangan Operasional 10%, Dana Insentif/THR/Bonus 10%**.
- PIHAK KEDUA **tidak digaji terpisah** — kompensasinya adalah 40% bagian laba tsb.
- PIHAK PERTAMA berhak menerima laporan keuangan & melakukan pengawasan.
- PIHAK KEDUA wajib kirim laporan penjualan harian + rekap bulanan ke PIHAK PERTAMA.

### Gap yang Perlu Direvisi di Sistem

1. **Kategori "Gaji" berpotensi salah pakai.** Default kategori kas keluar operasional saat ini termasuk "Gaji" (`isOperational=true`). Untuk kontrak ini, PIHAK KEDUA tidak bergaji terpisah — kompensasinya dari 40% profit share. Kalau kategori "Gaji" tetap dipakai buat PIHAK KEDUA, laporan yang dibaca investor bisa keliatan janggal (seolah kompensasi dihitung dobel). Kategori ini sebaiknya cuma dipakai untuk staf lain di luar PARA PIHAK.
2. **Kategori "Bahan Habis Pakai" belum ada.** Kontrak menyebut Gas sebagai contoh biaya operasional, tapi realitanya ada banyak bahan habis pakai serupa (kemasan, tisu, sabun cuci, dll) yang sama sifatnya — dikonsumsi terus-menerus untuk operasional, bukan cuma sekali beli. Sebaiknya jadi satu kategori umum "Bahan Habis Pakai" (dengan Gas sebagai salah satu contohnya), bukan kategori "Gas" doang yang sempit.
3. **"Bahan Baku" tidak muncul eksplisit sebagai baris di laporan.** Secara angka sudah benar (terpotong lewat mekanisme HPP/margin), tapi kalau investor baca laporan dan tidak melihat baris "Bahan Baku" — padahal itu disebut eksplisit di kontrak sebagai biaya operasional — bisa menimbulkan pertanyaan yang sebenarnya tidak perlu. Ini murni soal presentasi, bukan kesalahan hitung.
4. **Belum ada laporan berformat kontrak.** Laporan Laba Rugi yang ada sekarang lebih ke laporan analisis internal (fleksibel per rentang tanggal apapun), belum ada versi yang strukturnya eksplisit mengikuti Pasal 3 & 4 — cocok dibaca orang di luar tim teknis seperti investor.
5. **Belum ada laporan harian siap-kirim.** Dashboard sudah menampilkan ringkasan harian, tapi belum ada export satu halaman yang rapi untuk langsung dikirim ke PIHAK PERTAMA tiap hari sesuai Pasal 6.1 — sekarang harus screenshot dashboard atau export CSV mentah yang kurang nyaman dibaca orang non-teknis.

### Yang Sudah Sesuai (tidak perlu diubah)

- Biaya Bahan Baku sudah terpotong secara ekonomis lewat mekanisme HPP (margin produk), bukan sebagai baris kas keluar literal — hasil akhirnya ke Laba Bersih tetap sama, cuma jalurnya beda dari yang tertulis harfiah di kontrak.
- Kantong Kas real-time tidak bermasalah untuk model ini — itu murni pembukuan internal (berapa yang sudah "berhak" per pihak). Pencairan aktual (transfer ke rekening masing-masing) tetap manual, dilakukan sekali sebulan sebagai satu entri kas keluar besar dari kantong terkait, sebelum tanggal 5 sesuai kontrak. Siapa yang boleh mencatat pengeluaran dari kantong mana adalah urusan proses/kesepakatan antar pihak, bukan sesuatu yang perlu dikunci di level sistem.
- Persentase 40/40/10/10 dan label kantong (nama PIHAK PERTAMA/PIHAK KEDUA/Dana Cadangan Operasional/Dana Insentif) tinggal dikonfigurasi langsung di halaman Pengaturan Kantong Kas yang sudah ada — bukan pekerjaan coding.

## Bagian B — Analisis Menu (Product Performance)

Murni fitur baca/agregasi dari data `order_items` yang sudah ada — tidak perlu perubahan skema.

### Fitur

- Ranking produk berdasarkan qty terjual & total revenue dalam rentang tanggal
- Badge "Best Seller" (top N atau di atas threshold) dan "Kurang Laris/Tidak Laku" (di bawah threshold atau 0 terjual dalam periode)
- Kolom margin per unit & total kontribusi profit per produk (qty × margin) — supaya kelihatan bukan cuma yang paling laris, tapi juga yang laris-tapi-tipis-margin vs jarang laku-tapi-margin-tebal
- Export ke CSV/Excel

## Urutan Pengerjaan

1. Tinjau & sesuaikan daftar kategori default `cash_transactions` — tambah "Bahan Habis Pakai" (gas, kemasan, tisu, sabun cuci, dll), batasi kategori "Gaji" hanya untuk staf di luar PARA PIHAK
2. Implementasi halaman/export "Laporan Distribusi Bulanan" — format eksplisit sesuai Pasal 3 & 4 (Omzet → Biaya Operasional per kategori termasuk baris "Bahan Baku" yang dipisah jelas dari Σ `hppTotal`, dan "Bahan Habis Pakai" → Laba Bersih → breakdown 4 arah dengan nominal), filter per bulan kalender, siap cetak/kirim
3. Implementasi export "Laporan Harian" satu halaman dari Dashboard — ringkasan omzet, biaya, profit hari itu dalam format rapi siap kirim (PDF), terpisah dari export CSV mentah yang sudah ada
4. Implementasi halaman "Analisis Menu" — ranking qty & revenue per produk, badge Best Seller/Kurang Laris, margin & kontribusi profit, export

## Keputusan Desain & Asumsi

- Perubahan kategori "Gaji"/"Gas" bersifat penyesuaian daftar pilihan di form, bukan migrasi skema — `category` di `cash_transactions` memang sudah didesain fleksibel (bukan enum ketat).
- "Laporan Distribusi Bulanan" dan "Laporan Harian" adalah tampilan/export baru yang murni untuk kejelasan presentasi ke pihak luar (investor) — tidak mengubah kalkulasi Laba Rugi/Arus Kas yang sudah ada, cuma menyusun ulang angka yang sama jadi format yang lebih mudah dibaca dan cocok sama struktur kontrak.
- Tidak ada perubahan role/akses login — semua tetap `admin`/`kasir` seperti sekarang, laporan dikirim manual (PDF/screenshot) ke investor, bukan lewat akses login terpisah.

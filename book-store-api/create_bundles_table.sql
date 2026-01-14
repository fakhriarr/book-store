-- =====================================================
-- TABEL BUNDLES - Menyimpan informasi paket bundling
-- =====================================================

CREATE TABLE IF NOT EXISTS bundles (
    bundle_id INT PRIMARY KEY AUTO_INCREMENT,
    bundle_name VARCHAR(255) NOT NULL,
    selling_price DECIMAL(12, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================
-- TABEL BUNDLE_ITEMS - Relasi bundle dengan buku
-- =====================================================

CREATE TABLE IF NOT EXISTS bundle_items (
    bundle_item_id INT PRIMARY KEY AUTO_INCREMENT,
    bundle_id INT NOT NULL,
    book_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    FOREIGN KEY (bundle_id) REFERENCES bundles(bundle_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
);

-- =====================================================
-- MODIFIKASI TABEL TRANSACTION_ITEMS (untuk support bundle)
-- Jalankan query ini untuk menambahkan support bundle di transaksi
-- =====================================================

-- Tambah kolom bundle_id (NULL jika item adalah buku biasa)
-- ALTER TABLE transaction_items ADD COLUMN bundle_id INT NULL;
-- ALTER TABLE transaction_items MODIFY COLUMN book_id INT NULL;

-- Atau gunakan query dengan pengecekan:
-- SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'transaction_items' AND column_name = 'bundle_id');
-- SET @sqlstmt := IF(@exist = 0, 'ALTER TABLE transaction_items ADD COLUMN bundle_id INT NULL', 'SELECT "Column already exists"');
-- PREPARE stmt FROM @sqlstmt;
-- EXECUTE stmt;
-- DEALLOCATE PREPARE stmt;

-- =====================================================
-- INDEX UNTUK PERFORMA
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle ON bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_book ON bundle_items(book_id);
CREATE INDEX IF NOT EXISTS idx_bundles_active ON bundles(is_active);

-- Script untuk membuat tabel stock_history
-- Jalankan script ini di database MySQL Anda untuk mengaktifkan fitur riwayat stok

CREATE TABLE IF NOT EXISTS stock_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    quantity_change INT NOT NULL COMMENT 'Perubahan stok (positif untuk masuk, negatif untuk keluar)',
    reason VARCHAR(255) NOT NULL COMMENT 'Alasan perubahan (Stok Masuk Manual, Stok Keluar Manual, Penjualan Otomatis, dll)',
    transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    INDEX idx_book_id (book_id),
    INDEX idx_transaction_date (transaction_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


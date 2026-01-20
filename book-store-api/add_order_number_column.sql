-- Menambahkan kolom order_number untuk menyimpan nomor pesanan dari e-commerce
ALTER TABLE transactions ADD COLUMN order_number VARCHAR(100) NULL;

-- Index untuk mempercepat pencarian berdasarkan order_number
CREATE INDEX idx_order_number ON transactions(order_number);

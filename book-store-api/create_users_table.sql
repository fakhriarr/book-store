-- Tabel users untuk autentikasi
CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role ENUM('owner', 'admin') NOT NULL DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Index untuk pencarian username
CREATE INDEX idx_username ON users(username);

-- Insert default users (password akan di-hash saat server pertama kali jalan)
-- Password default: owner untuk owner, admin untuk admin
-- CATATAN: Jalankan script insert dari backend setelah bcrypt tersedia

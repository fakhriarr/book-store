const mysql = require('mysql2');
require('dotenv').config(); // Untuk membaca file .env

// Buat pool koneksi untuk efisiensi
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Tes koneksi
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Koneksi Database Gagal:', err.message);
        return;
    }
    console.log('Koneksi Database MySQL Berhasil!');
    connection.release(); // Lepaskan koneksi setelah tes
});

module.exports = pool.promise(); // Ekspor sebagai promise untuk penggunaan async/await yang mudah
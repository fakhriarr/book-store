const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Pastikan .env dibaca
const db = require('./config/db'); // Import koneksi
const bookRoutes = require('./routes/bookRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const bundleRoutes = require('./routes/bundleRoutes');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Rute Dasar (Untuk Tes)
app.get('/', (req, res) => {
    res.json({ message: 'API Toko Buku Berjalan!' });
});

// --- Rute API (akan kita buat di Tahap 3) ---
app.use('/api/books', bookRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/bundles', bundleRoutes);

// Jalankan Server
app.listen(PORT, () => {
    console.log(`Server API berjalan di http://localhost:${PORT}`);
});
// book-store-api/routes/dashboardRoutes.js

const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/metrics', async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10); // Format YYYY-MM-DD

        // Query 1: Total Penjualan (Omzet) Hari Ini & Total Transaksi Hari Ini
        const [salesResult] = await db.query(
            `SELECT 
                COALESCE(SUM(total_amount), 0) AS total_revenue_today,
                COUNT(transaction_id) AS total_transactions_today
             FROM transactions
             WHERE DATE(transaction_date) = ?`, [today]
        );

        // Query 2: Jumlah SKU (Total Buku Unik)
        const [skuResult] = await db.query('SELECT COUNT(book_id) AS total_sku FROM books');

        // Query 3: Stok Rendah (Misal, Stok < 10)
        const [lowStockResult] = await db.query('SELECT COUNT(book_id) AS low_stock_count FROM books WHERE stock_qty < 10');
        
        // Query 4: Penjualan Terbaru (Ambil 5 transaksi terbaru)
        const [latestSalesResult] = await db.query(`
            SELECT 
                t.transaction_date, 
                t.total_amount,
                COUNT(ti.item_id) AS total_items
            FROM transactions t
            JOIN transaction_items ti ON t.transaction_id = ti.transaction_id
            GROUP BY t.transaction_id
            ORDER BY t.transaction_date DESC
        `);

        res.json({
            revenueToday: salesResult[0].total_revenue_today,
            transactionsToday: salesResult[0].total_transactions_today,
            totalSKU: skuResult[0].total_sku,
            lowStockCount: lowStockResult[0].low_stock_count,
            latestSales: latestSalesResult,
        });

    } catch (err) {
        console.error('Error fetching dashboard metrics:', err);
        res.status(500).json({ error: 'Gagal memuat metrik dashboard.' });
    }
});

module.exports = router;
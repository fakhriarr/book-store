// book-store-api/routes/reportRoutes.js

const express = require('express');
const router = express.Router();
const db = require('../config/db');

// --- 1. Analisis Kinerja Harga (Margin Keuntungan Tertinggi) ---
router.get('/performance', async (req, res) => {
    try {
        const query = `
            SELECT 
                b.title, 
                b.selling_price, 
                b.purchase_price,
                SUM(ti.quantity) AS total_sold,
                SUM(ti.quantity * (ti.price_at_sale - b.purchase_price)) AS total_profit,
                (ti.price_at_sale - b.purchase_price) AS unit_margin
            FROM 
                transaction_items ti
            JOIN 
                books b ON ti.book_id = b.book_id
            GROUP BY 
                ti.book_id
            ORDER BY 
                total_profit DESC
            LIMIT 10;
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching profit analysis:', err);
        res.status(500).json({ error: 'Gagal mengambil data kinerja harga.' });
    }
});


// --- 2. Analisis Pola Konsumen (Kategori Terlaris Berdasarkan Omzet) ---
router.get('/categories-by-revenue', async (req, res) => {
    try {
        const query = `
            SELECT 
                b.category, 
                SUM(ti.quantity * ti.price_at_sale) AS total_revenue
            FROM 
                transaction_items ti
            JOIN 
                books b ON ti.book_id = b.book_id
            GROUP BY 
                b.category
            ORDER BY 
                total_revenue DESC;
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching category revenue:', err);
        res.status(500).json({ error: 'Gagal mengambil data kategori terlaris.' });
    }
});

router.get('/sales-trend', async (req, res) => {
    try {
        const query = `
            SELECT 
                DATE(transaction_date) AS sale_date,
                COALESCE(SUM(total_amount), 0) AS daily_revenue
            FROM transactions
            WHERE transaction_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY sale_date
            ORDER BY sale_date ASC;
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching sales trend:', err);
        res.status(500).json({ error: 'Gagal mengambil data tren penjualan.' });
    }
});

// Catatan: Market Basket Analysis (Buku yang dibeli bersamaan) memerlukan query yang jauh lebih kompleks 
// atau tools analisis yang lebih canggih. Untuk Tugas Akhir, fokus pada margin dan kategori ini sudah kuat.

module.exports = router;
// --- 3. Omzet bulanan per tahun ---
router.get('/monthly-revenue', async (req, res) => {
    try {
        const year = parseInt(req.query.year || new Date().getFullYear(), 10);
        const [rows] = await db.query(`
            SELECT 
                MONTH(transaction_date) AS month,
                COALESCE(SUM(total_amount), 0) AS revenue
            FROM transactions
            WHERE YEAR(transaction_date) = ?
            GROUP BY MONTH(transaction_date)
            ORDER BY month
        `, [year]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching monthly revenue:', err);
        res.status(500).json({ error: 'Gagal mengambil omzet bulanan.' });
    }
});

// --- 4. Buku dengan penurunan penjualan terbesar (MoM) ---
router.get('/top-decline-books', async (req, res) => {
    try {
        const year = parseInt(req.query.year || new Date().getFullYear(), 10);
        const month = parseInt(req.query.month || (new Date().getMonth() + 1), 10);
        const prevYear = month === 1 ? year - 1 : year;
        const prevMonth = month === 1 ? 12 : (month - 1);

        const [rows] = await db.query(`
            SELECT 
                b.book_id,
                b.title,
                COALESCE(SUM(CASE WHEN YEAR(t.transaction_date)=? AND MONTH(t.transaction_date)=? THEN ti.quantity ELSE 0 END),0) AS qty_cur,
                COALESCE(SUM(CASE WHEN YEAR(t.transaction_date)=? AND MONTH(t.transaction_date)=? THEN ti.quantity ELSE 0 END),0) AS qty_prev,
                (COALESCE(SUM(CASE WHEN YEAR(t.transaction_date)=? AND MONTH(t.transaction_date)=? THEN ti.quantity ELSE 0 END),0)
                 - COALESCE(SUM(CASE WHEN YEAR(t.transaction_date)=? AND MONTH(t.transaction_date)=? THEN ti.quantity ELSE 0 END),0)) AS delta_qty
            FROM transaction_items ti
            JOIN transactions t ON ti.transaction_id = t.transaction_id
            JOIN books b ON ti.book_id = b.book_id
            GROUP BY b.book_id
            ORDER BY delta_qty ASC
            LIMIT 10
        `, [year, month, prevYear, prevMonth, prevYear, prevMonth, year, month]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching top decline books:', err);
        res.status(500).json({ error: 'Gagal mengambil data penurunan penjualan.' });
    }
});

// --- 5. Frekuensi pembelian pelanggan ---
router.get('/purchase-frequency', async (req, res) => {
    try {
        // Distribusi jumlah transaksi per customer
        const [rows] = await db.query(`
            SELECT c.customer_id, c.name, COUNT(t.transaction_id) AS tx_count
            FROM customers c
            LEFT JOIN transactions t ON t.customer_id = c.customer_id
            GROUP BY c.customer_id
            ORDER BY tx_count DESC, c.name ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching purchase frequency:', err);
        res.status(500).json({ error: 'Gagal mengambil data frekuensi pembelian.' });
    }
});

// --- 6. Rata-rata item per transaksi + jam/hari tersibuk ---
router.get('/tx-metrics', async (req, res) => {
    try {
        const [[avgItemsRow]] = await db.query(`
            SELECT AVG(item_count) AS avg_items
            FROM (
              SELECT t.transaction_id, SUM(ti.quantity) AS item_count
              FROM transactions t
              JOIN transaction_items ti ON t.transaction_id = ti.transaction_id
              GROUP BY t.transaction_id
            ) x
        `);

        const [[busiestHourRow]] = await db.query(`
            SELECT HOUR(transaction_date) AS hour, COUNT(*) AS cnt
            FROM transactions
            GROUP BY HOUR(transaction_date)
            ORDER BY cnt DESC
            LIMIT 1
        `);

        const [[busiestDayRow]] = await db.query(`
            SELECT DAYNAME(transaction_date) AS day_name, COUNT(*) AS cnt
            FROM transactions
            GROUP BY DAYOFWEEK(transaction_date), DAYNAME(transaction_date)
            ORDER BY cnt DESC
            LIMIT 1
        `);

        res.json({
            avg_items: Number(avgItemsRow?.avg_items || 0),
            busiest_hour: busiestHourRow?.hour ?? null,
            busiest_day: busiestDayRow?.day_name ?? null,
        });
    } catch (err) {
        console.error('Error fetching tx metrics:', err);
        res.status(500).json({ error: 'Gagal mengambil metrik transaksi.' });
    }
});

// --- 7. Ringkasan untuk export & dashboard mini ---
router.get('/summary', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const params = [];
        let where = '1=1';
        if (startDate) { where += ' AND DATE(t.transaction_date) >= ?'; params.push(startDate); }
        if (endDate) { where += ' AND DATE(t.transaction_date) <= ?'; params.push(endDate); }

        const [[sums]] = await db.query(`
            SELECT COUNT(DISTINCT t.transaction_id) AS total_transactions,
                   COALESCE(SUM(t.total_amount),0) AS total_revenue
            FROM transactions t
            WHERE ${where}
        `, params);

        const [[bestBook]] = await db.query(`
            SELECT b.title, SUM(ti.quantity * (ti.price_at_sale - b.purchase_price)) AS profit
            FROM transaction_items ti
            JOIN transactions t ON t.transaction_id = ti.transaction_id
            JOIN books b ON b.book_id = ti.book_id
            WHERE ${where}
            GROUP BY b.book_id
            ORDER BY profit DESC
            LIMIT 1
        `, params);

        const [[topCategory]] = await db.query(`
            SELECT b.category, SUM(ti.quantity * ti.price_at_sale) AS revenue
            FROM transaction_items ti
            JOIN transactions t ON t.transaction_id = ti.transaction_id
            JOIN books b ON b.book_id = ti.book_id
            WHERE ${where}
            GROUP BY b.category
            ORDER BY revenue DESC
            LIMIT 1
        `, params);

        // rata-rata nilai transaksi
        const avgValue = Number(sums.total_transactions || 0) > 0 
          ? Number(sums.total_revenue) / Number(sums.total_transactions)
          : 0;

        res.json({
            total_transactions: Number(sums.total_transactions || 0),
            total_revenue: Number(sums.total_revenue || 0),
            bestselling_book: bestBook?.title || null,
            dominant_category: topCategory?.category || null,
            avg_tx_value: avgValue,
        });
    } catch (err) {
        console.error('Error fetching summary:', err);
        res.status(500).json({ error: 'Gagal mengambil ringkasan laporan.' });
    }
});
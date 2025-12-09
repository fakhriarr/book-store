const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Ambil daftar transaksi (gabungan transaksi keluar dan stok masuk manual)
router.get('/', async (req, res) => {
    const { q, category, startDate, endDate, type } = req.query;

    // Base query untuk transaksi keluar (sales) - dengan grouping untuk multiple items
    const params = [];
    let whereOut = '1=1';
    if (startDate) { whereOut += ' AND DATE(t.transaction_date) >= ?'; params.push(startDate); }
    if (endDate) { whereOut += ' AND DATE(t.transaction_date) <= ?'; params.push(endDate); }
    if (q) {
        whereOut += ' AND (b.title LIKE ? OR b.isbn LIKE ?)';
        params.push(`%${q}%`, `%${q}%`);
    }
    if (category) {
        whereOut += ' AND (b.category = ?)';
        params.push(category);
    }

    // Query untuk transaksi OUT (penjualan) - grouping by transaction
    const outQuery = `
        SELECT 
            t.transaction_id AS id,
            t.transaction_date AS date,
            GROUP_CONCAT(DISTINCT b.isbn ORDER BY b.title SEPARATOR ', ') AS isbn,
            GROUP_CONCAT(DISTINCT b.title ORDER BY b.title SEPARATOR ', ') AS title,
            GROUP_CONCAT(DISTINCT b.author ORDER BY b.title SEPARATOR ', ') AS author,
            GROUP_CONCAT(DISTINCT ti.price_at_sale ORDER BY b.title SEPARATOR ', ') AS selling_price,
            'OUT' AS trans_type,
            GROUP_CONCAT(ti.quantity ORDER BY b.title SEPARATOR ', ') AS quantity,
            SUM(ti.quantity * ti.price_at_sale) AS total,
            t.payment_method,
            c.name AS customerName,
            COUNT(DISTINCT ti.book_id) AS item_count
        FROM transactions t
        JOIN transaction_items ti ON t.transaction_id = ti.transaction_id
        JOIN books b ON ti.book_id = b.book_id
        LEFT JOIN customers c ON t.customer_id = c.customer_id
        WHERE ${whereOut}
        GROUP BY t.transaction_id, t.transaction_date, t.payment_method, c.name
    `;

    // Base query untuk stok masuk manual sebagai transaksi IN (tanpa header transaksi)
    const paramsIn = [];
    let whereIn = "sh.reason IN ('Penambahan Stok')"; // hanya stok masuk
    if (startDate) { whereIn += ' AND DATE(sh.transaction_date) >= ?'; paramsIn.push(startDate); }
    if (endDate) { whereIn += ' AND DATE(sh.transaction_date) <= ?'; paramsIn.push(endDate); }
    if (q) {
        whereIn += ' AND (b.title LIKE ? OR b.isbn LIKE ?)';
        paramsIn.push(`%${q}%`, `%${q}%`);
    }
    if (category) {
        whereIn += ' AND (b.category = ?)';
        paramsIn.push(category);
    }

    const inQuery = `
        SELECT 
            NULL AS id,
            sh.transaction_date AS date,
            b.isbn,
            b.title,
            b.author,
            b.purchase_price,
            b.selling_price,
            'IN' AS trans_type,
            sh.quantity_change AS quantity,
            (sh.quantity_change * b.purchase_price) AS total,
            NULL AS payment_method,
            NULL AS customerName,
            1 AS item_count
        FROM stock_history sh
        JOIN books b ON sh.book_id = b.book_id
        WHERE ${whereIn}
    `;

    try {
        let finalQuery;
        let finalParams;

        if (type === 'OUT') {
            finalQuery = `${outQuery} ORDER BY date DESC LIMIT 500`;
            finalParams = params;
        } else if (type === 'IN') {
            finalQuery = `${inQuery} ORDER BY date DESC LIMIT 500`;
            finalParams = paramsIn;
        } else {
            finalQuery = `(${outQuery}) UNION ALL (${inQuery}) ORDER BY date DESC LIMIT 500`;
            finalParams = [...params, ...paramsIn];
        }

        const [rows] = await db.query(finalQuery, finalParams);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching transactions:', err);
        res.status(500).json({ error: 'Gagal mengambil data transaksi.' });
    }
});

// Mencatat Transaksi Penjualan Baru
router.post('/', async (req, res) => {
    // req.body: { items: [{ book_id, quantity, price_at_sale }], payment_method?, customer_name? }
    const { items, payment_method, customer_name } = req.body; 
    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Transaksi harus memiliki minimal 1 item' });
    }

    // 1. Hitung Total Jumlah Transaksi
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price_at_sale), 0);
    let connection; // Untuk menangani transaction MySQL

    try {
        connection = await db.getConnection();
        await connection.beginTransaction(); // Mulai transaksi database

        // Pastikan kolom payment_method ada (jika belum ada, tambahkan)
        try { await connection.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32) NOT NULL DEFAULT 'cash'"); } catch (e) {}
        try { await connection.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_id INT NULL"); } catch (e) {}

        // 1.a. Upsert customer jika ada customer_name
        let customerId = null;
        if (customer_name && String(customer_name).trim().length > 0) {
            // pastikan tabel customers ada
            try { await connection.query("CREATE TABLE IF NOT EXISTS customers (customer_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, phone VARCHAR(50) NULL, email VARCHAR(255) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uniq_customer_name (name))"); } catch (e) {}
            // cari atau buat
            const [found] = await connection.query('SELECT customer_id FROM customers WHERE name = ? LIMIT 1', [customer_name.trim()]);
            if (found.length > 0) {
                customerId = found[0].customer_id;
            } else {
                const [ins] = await connection.query('INSERT INTO customers (name) VALUES (?)', [customer_name.trim()]);
                customerId = ins.insertId;
            }
        }
        // 2. Insert ke Tabel Transaksi (Header)
        const [transResult] = await connection.query(
            'INSERT INTO transactions (transaction_date, total_amount, payment_method, customer_id) VALUES (NOW(), ?, ?, ?)',
            [totalAmount, (payment_method || 'cash'), customerId]
        );
        const transactionId = transResult.insertId;

        // 3. Insert ke Detail Transaksi & Update Stok
        for (const item of items) {
            // Insert ke transaction_items
            await connection.query(
                'INSERT INTO transaction_items (transaction_id, book_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)',
                [transactionId, item.book_id, item.quantity, item.price_at_sale]
            );

            // Update Stok (Kurangi stok buku)
            await connection.query(
                'UPDATE books SET stock_qty = stock_qty - ? WHERE book_id = ?',
                [item.quantity, item.book_id]
            );

            // Log ke stock_history jika tabel ada
            try {
                await connection.query(
                    'INSERT INTO stock_history (book_id, quantity_change, reason, transaction_date) VALUES (?, ?, ?, NOW())',
                    [item.book_id, -item.quantity, 'Penjualan Stok']
                );
            } catch (historyErr) {
                // Jika tabel stock_history tidak ada, skip logging
                console.log('Tabel stock_history tidak ditemukan, skip logging');
            }
        }

        await connection.commit(); // Komit semua perubahan jika berhasil
        res.status(201).json({ 
            transaction_id: transactionId, 
            message: 'Transaksi berhasil dicatat dan stok diperbarui' 
        });

    } catch (err) {
        if (connection) {
            await connection.rollback(); // Rollback jika ada error (stok tidak berkurang, dll.)
        }
        console.error('Error during transaction:', err);
        res.status(500).json({ error: 'Pencatatan transaksi gagal.' });
    } finally {
        if (connection) {
            connection.release(); // Pastikan koneksi dilepas
        }
    }
});

// Ambil detail transaksi berdasarkan ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        // Query untuk mendapatkan data header transaksi
        const [headerRows] = await db.query(`
            SELECT 
                t.transaction_id,
                t.transaction_date,
                t.total_amount,
                t.payment_method,
                c.name as customer_name,
                c.customer_id
            FROM transactions t
            LEFT JOIN customers c ON t.customer_id = c.customer_id
            WHERE t.transaction_id = ?
        `, [id]);

        if (headerRows.length === 0) {
            return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
        }

        const transaction = headerRows[0];

        // Query untuk mendapatkan items dalam transaksi
        const [itemRows] = await db.query(`
            SELECT 
                ti.book_id,
                ti.quantity,
                ti.price_at_sale,
                b.isbn,
                b.title,
                b.author,
                (ti.quantity * ti.price_at_sale) as subtotal
            FROM transaction_items ti
            JOIN books b ON ti.book_id = b.book_id
            WHERE ti.transaction_id = ?
        `, [id]);

        // Format response
        const response = {
            transaction_id: transaction.transaction_id,
            transaction_date: transaction.transaction_date,
            total_amount: transaction.total_amount,
            payment_method: transaction.payment_method,
            customer_name: transaction.customer_name,
            customer_id: transaction.customer_id,
            items: itemRows.map(item => ({
                book_id: item.book_id,
                isbn: item.isbn,
                title: item.title,
                author: item.author,
                quantity: item.quantity,
                unit_price: item.price_at_sale,
                subtotal: item.subtotal
            }))
        };

        res.json(response);
    } catch (err) {
        console.error('Error fetching transaction detail:', err);
        res.status(500).json({ error: 'Gagal mengambil detail transaksi' });
    }
});

module.exports = router;
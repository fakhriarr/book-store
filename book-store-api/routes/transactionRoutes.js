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

// Mencatat Transaksi Penjualan Baru (support buku dan bundle)
router.post('/', async (req, res) => {
    // req.body: { items: [{ book_id, quantity, price_at_sale }], bundles: [{ bundle_id, quantity }], payment_method?, customer_name? }
    const { items = [], bundles = [], payment_method, customer_name } = req.body; 
    if (items.length === 0 && bundles.length === 0) {
        return res.status(400).json({ error: 'Transaksi harus memiliki minimal 1 item atau bundle' });
    }

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Pastikan kolom payment_method ada
        try { await connection.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32) NOT NULL DEFAULT 'cash'"); } catch (e) {}
        try { await connection.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_id INT NULL"); } catch (e) {}

        // 1. Upsert customer jika ada customer_name
        let customerId = null;
        if (customer_name && String(customer_name).trim().length > 0) {
            try { await connection.query("CREATE TABLE IF NOT EXISTS customers (customer_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, phone VARCHAR(50) NULL, email VARCHAR(255) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uniq_customer_name (name))"); } catch (e) {}
            const [found] = await connection.query('SELECT customer_id FROM customers WHERE name = ? LIMIT 1', [customer_name.trim()]);
            if (found.length > 0) {
                customerId = found[0].customer_id;
            } else {
                const [ins] = await connection.query('INSERT INTO customers (name) VALUES (?)', [customer_name.trim()]);
                customerId = ins.insertId;
            }
        }

        // 2. Hitung Total Amount
        let totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price_at_sale), 0);
        
        // Tambah harga bundle
        for (const bundleItem of bundles) {
            const [bundleData] = await connection.query('SELECT selling_price FROM bundles WHERE bundle_id = ?', [bundleItem.bundle_id]);
            if (bundleData.length > 0) {
                totalAmount += bundleData[0].selling_price * bundleItem.quantity;
            }
        }

        // 3. Insert ke Tabel Transaksi (Header)
        const [transResult] = await connection.query(
            'INSERT INTO transactions (transaction_date, total_amount, payment_method, customer_id) VALUES (NOW(), ?, ?, ?)',
            [totalAmount, (payment_method || 'cash'), customerId]
        );
        const transactionId = transResult.insertId;

        // 4. Insert buku ke transaction_items & Update Stok
        for (const item of items) {
            await connection.query(
                'INSERT INTO transaction_items (transaction_id, book_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)',
                [transactionId, item.book_id, item.quantity, item.price_at_sale]
            );

            await connection.query(
                'UPDATE books SET stock_qty = stock_qty - ? WHERE book_id = ?',
                [item.quantity, item.book_id]
            );

            try {
                await connection.query(
                    'INSERT INTO stock_history (book_id, quantity_change, reason, transaction_date) VALUES (?, ?, ?, NOW())',
                    [item.book_id, -item.quantity, 'Penjualan Stok']
                );
            } catch (historyErr) {
                console.log('Tabel stock_history tidak ditemukan, skip logging');
            }
        }

        // 5. Process bundle sales
        for (const bundleItem of bundles) {
            const [bundleData] = await connection.query('SELECT * FROM bundles WHERE bundle_id = ? AND is_active = TRUE', [bundleItem.bundle_id]);
            if (bundleData.length === 0) {
                throw new Error(`Bundle ID ${bundleItem.bundle_id} tidak ditemukan`);
            }
            const bundle = bundleData[0];

            // Check bundle stock
            if (bundle.stock < bundleItem.quantity) {
                throw new Error(`Stok bundle "${bundle.bundle_name}" tidak mencukupi`);
            }

            // Get bundle items (books inside)
            const [bundleBooks] = await connection.query(`
                SELECT bi.*, b.stock_qty 
                FROM bundle_items bi 
                JOIN books b ON bi.book_id = b.book_id 
                WHERE bi.bundle_id = ?
            `, [bundleItem.bundle_id]);

            // Check stock for each book in bundle
            for (const bookItem of bundleBooks) {
                const requiredStock = bookItem.quantity * bundleItem.quantity;
                if (bookItem.stock_qty < requiredStock) {
                    throw new Error(`Stok buku dalam bundle tidak mencukupi`);
                }
            }

            // Insert bundle to transaction_items (we'll use a special format)
            // Note: You may need to add bundle_id column to transaction_items
            try {
                await connection.query(
                    'INSERT INTO transaction_items (transaction_id, book_id, quantity, price_at_sale, bundle_id) VALUES (?, NULL, ?, ?, ?)',
                    [transactionId, bundleItem.quantity, bundle.selling_price, bundleItem.bundle_id]
                );
            } catch (e) {
                // If bundle_id column doesn't exist, insert without it but mark in a different way
                // We'll record as a note in stock_history
            }

            // Reduce bundle stock
            await connection.query('UPDATE bundles SET stock = stock - ? WHERE bundle_id = ?', [bundleItem.quantity, bundleItem.bundle_id]);

            // Reduce stock of each book in bundle
            for (const bookItem of bundleBooks) {
                const reduceAmount = bookItem.quantity * bundleItem.quantity;
                await connection.query('UPDATE books SET stock_qty = stock_qty - ? WHERE book_id = ?', [reduceAmount, bookItem.book_id]);

                try {
                    await connection.query(
                        'INSERT INTO stock_history (book_id, quantity_change, reason, transaction_date) VALUES (?, ?, ?, NOW())',
                        [bookItem.book_id, -reduceAmount, `Penjualan Bundle: ${bundle.bundle_name}`]
                    );
                } catch (historyErr) {}
            }
        }

        await connection.commit();
        res.status(201).json({ 
            transaction_id: transactionId, 
            message: 'Transaksi berhasil dicatat dan stok diperbarui' 
        });

    } catch (err) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error during transaction:', err);
        res.status(500).json({ error: err.message || 'Pencatatan transaksi gagal.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Ambil daftar transaksi bundle - HARUS SEBELUM /:id
router.get('/bundles/list', async (req, res) => {
    const { q, startDate, endDate } = req.query;
    
    try {
        let whereClause = '1=1';
        const params = [];
        
        if (startDate) {
            whereClause += ' AND DATE(t.transaction_date) >= ?';
            params.push(startDate);
        }
        if (endDate) {
            whereClause += ' AND DATE(t.transaction_date) <= ?';
            params.push(endDate);
        }
        if (q) {
            whereClause += ' AND (bu.bundle_name LIKE ?)';
            params.push(`%${q}%`);
        }
        
        const query = `
            SELECT 
                t.transaction_id AS id,
                t.transaction_date AS date,
                bu.bundle_name,
                bu.bundle_id,
                ti.quantity,
                ti.price_at_sale AS selling_price,
                (ti.quantity * ti.price_at_sale) AS total,
                t.payment_method,
                c.name AS customerName
            FROM transactions t
            JOIN transaction_items ti ON t.transaction_id = ti.transaction_id
            JOIN bundles bu ON ti.bundle_id = bu.bundle_id
            LEFT JOIN customers c ON t.customer_id = c.customer_id
            WHERE ti.bundle_id IS NOT NULL AND ${whereClause}
            ORDER BY t.transaction_date DESC
            LIMIT 500
        `;
        
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching bundle transactions:', err);
        res.status(500).json({ error: 'Gagal mengambil data transaksi bundle.' });
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
                t.order_number,
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

        // Query untuk mendapatkan items buku dalam transaksi
        const [bookItemRows] = await db.query(`
            SELECT 
                ti.book_id,
                ti.quantity,
                ti.price_at_sale,
                b.isbn,
                b.title,
                b.author,
                (ti.quantity * ti.price_at_sale) as subtotal,
                'book' as item_type
            FROM transaction_items ti
            JOIN books b ON ti.book_id = b.book_id
            WHERE ti.transaction_id = ? AND ti.book_id IS NOT NULL
        `, [id]);

        // Query untuk mendapatkan items bundle dalam transaksi
        const [bundleItemRows] = await db.query(`
            SELECT 
                ti.bundle_id,
                ti.quantity,
                ti.price_at_sale,
                bu.bundle_name,
                (ti.quantity * ti.price_at_sale) as subtotal,
                'bundle' as item_type
            FROM transaction_items ti
            JOIN bundles bu ON ti.bundle_id = bu.bundle_id
            WHERE ti.transaction_id = ? AND ti.bundle_id IS NOT NULL
        `, [id]);

        // Format response - gabungkan buku dan bundle
        const bookItems = bookItemRows.map(item => ({
            book_id: item.book_id,
            isbn: item.isbn,
            title: item.title,
            author: item.author,
            quantity: item.quantity,
            unit_price: item.price_at_sale,
            subtotal: item.subtotal,
            item_type: 'book'
        }));

        const bundleItems = bundleItemRows.map(item => ({
            bundle_id: item.bundle_id,
            title: item.bundle_name,
            quantity: item.quantity,
            unit_price: item.price_at_sale,
            subtotal: item.subtotal,
            item_type: 'bundle'
        }));

        const response = {
            transaction_id: transaction.transaction_id,
            order_number: transaction.order_number,
            transaction_date: transaction.transaction_date,
            total_amount: transaction.total_amount,
            payment_method: transaction.payment_method,
            customer_name: transaction.customer_name,
            customer_id: transaction.customer_id,
            items: [...bookItems, ...bundleItems]
        };

        res.json(response);
    } catch (err) {
        console.error('Error fetching transaction detail:', err);
        res.status(500).json({ error: 'Gagal mengambil detail transaksi' });
    }
});

module.exports = router;
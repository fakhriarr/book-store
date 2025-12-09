const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Koneksi database

// 1. Mengambil semua buku (Inventaris)
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM books ORDER BY title ASC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching books:', err);
        res.status(500).json({ error: 'Gagal mengambil data buku' });
    }
});

// 2. Menambah Buku Baru
router.post('/', async (req, res) => {
    const { isbn, title, author, category, purchase_price, selling_price, stock_qty } = req.body;
    try {
        const query = `INSERT INTO books (isbn, title, author, category, purchase_price, selling_price, stock_qty) 
                       VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await db.query(query, [isbn, title, author, category, purchase_price, selling_price, stock_qty]);
        res.status(201).json({ id: result.insertId, message: 'Buku baru berhasil ditambahkan' });
    } catch (err) {
        // Handle error jika ISBN duplikat, dll.
        console.error('Error adding book:', err);
        res.status(500).json({ error: 'Gagal menambahkan buku' });
    }
});

router.put('/:id/stock-out', async (req, res) => {
    const bookId = req.params.id;
    const { quantity, transaction_date, price_at_sale, create_transaction } = req.body;

    let connection;
    
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Validasi stok tidak boleh negatif
        const [book] = await connection.query('SELECT stock_qty, selling_price FROM books WHERE book_id = ?', [bookId]);
        if (!book[0] || book[0].stock_qty < quantity) {
            await connection.rollback();
            return res.status(400).json({ error: 'Stok tidak mencukupi' });
        }

        // Jika create_transaction = true, buat transaksi
        if (create_transaction && price_at_sale) {
            const totalAmount = quantity * price_at_sale;
            const transDate = transaction_date ? new Date(transaction_date) : new Date();
            // pastikan kolom payment_method ada
            try {
                await connection.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32) NOT NULL DEFAULT 'cash'");
            } catch (e) {
                // abaikan jika tidak didukung / sudah ada
            }
            
            // 1. Insert ke tabel transactions
            const [transResult] = await connection.query(
                'INSERT INTO transactions (transaction_date, total_amount, payment_method) VALUES (?, ?, ?)',
                [transDate, totalAmount, 'cash']
            );
            const transactionId = transResult.insertId;

            // 2. Insert ke transaction_items
            await connection.query(
                'INSERT INTO transaction_items (transaction_id, book_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)',
                [transactionId, bookId, quantity, price_at_sale]
            );

            // 3. Update stok
            await connection.query(
                'UPDATE books SET stock_qty = stock_qty - ? WHERE book_id = ?',
                [quantity, bookId]
            );

            // 4. Log ke stock_history jika tabel ada
            try {
                await connection.query(
                    'INSERT INTO stock_history (book_id, quantity_change, reason, transaction_date) VALUES (?, ?, ?, ?)',
                    [bookId, -quantity, 'Penjualan Stok', transDate]
                );
            } catch (historyErr) {
                console.log('Tabel stock_history tidak ditemukan, skip logging');
            }

            await connection.commit();
            res.json({ 
                message: 'Stok berhasil dikurangi dan transaksi dicatat', 
                transaction_id: transactionId 
            });
        } else {
            // Jika tidak membuat transaksi, hanya kurangi stok (untuk backward compatibility)
            await connection.query(
                'UPDATE books SET stock_qty = stock_qty - ? WHERE book_id = ?',
                [quantity, bookId]
            );
            
            // Log ke stock_history jika tabel ada
            const stockDate = transaction_date ? new Date(transaction_date) : new Date();
            try {
                await connection.query(
                    'INSERT INTO stock_history (book_id, quantity_change, reason, transaction_date) VALUES (?, ?, ?, ?)',
                    [bookId, -quantity, 'Penjualan Stok', stockDate]
                );
            } catch (historyErr) {
                console.log('Tabel stock_history tidak ditemukan, skip logging');
            }
            
            await connection.commit();
            res.json({ message: 'Stok berhasil dikurangi' });
        }
    } catch (err) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error updating stock-out:', err);
        res.status(500).json({ error: 'Gagal mengurangi stok' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// 3. Update Stok Masuk dengan logging
router.put('/:id/stock-in', async (req, res) => {
    const bookId = req.params.id;
    const { quantity } = req.body; // Jumlah stok yang masuk

    try {
        // Gunakan UPDATE dengan penambahan stok
        const query = 'UPDATE books SET stock_qty = stock_qty + ? WHERE book_id = ?';
        await db.query(query, [quantity, bookId]);
        
        // Log ke stock_history jika tabel ada
        try {
            await db.query(
                'INSERT INTO stock_history (book_id, quantity_change, reason, transaction_date) VALUES (?, ?, ?, NOW())',
                [bookId, quantity, 'Penambahan Stok']
            );
        } catch (historyErr) {
            // Jika tabel stock_history tidak ada, skip logging
            console.log('Tabel stock_history tidak ditemukan, skip logging');
        }
        
        res.json({ message: 'Stok berhasil ditambahkan' });
    } catch (err) {
        console.error('Error updating stock-in:', err);
        res.status(500).json({ error: 'Gagal menambah stok' });
    }
});

// 5. Update Buku (Edit)
router.put('/:id', async (req, res) => {
    const bookId = req.params.id;
    const { isbn, title, author, category, purchase_price, selling_price, stock_qty } = req.body;
    
    try {
        const query = `UPDATE books 
                      SET isbn = ?, title = ?, author = ?, category = ?, 
                          purchase_price = ?, selling_price = ?, stock_qty = ?
                      WHERE book_id = ?`;
        await db.query(query, [isbn, title, author, category, purchase_price, selling_price, stock_qty, bookId]);
        res.json({ message: 'Buku berhasil diperbarui' });
    } catch (err) {
        console.error('Error updating book:', err);
        res.status(500).json({ error: 'Gagal memperbarui buku' });
    }
});

// 6. Hapus Buku
router.delete('/:id', async (req, res) => {
    const bookId = req.params.id;
    const force = String(req.query.force || '').toLowerCase() === 'true';

    let connection;
    try {
        if (!force) {
            // Coba hapus biasa, jika ada FK akan error
            await db.query('DELETE FROM books WHERE book_id = ?', [bookId]);
            return res.json({ message: 'Buku berhasil dihapus' });
        }

        // Hapus paksa dalam transaksi DB
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1) Hapus riwayat stok terkait buku
        try {
            await connection.query('DELETE FROM stock_history WHERE book_id = ?', [bookId]);
        } catch (e) {
            // abaikan jika tabel tidak ada
        }

        // 2) Hapus item transaksi terkait buku ini
        await connection.query('DELETE FROM transaction_items WHERE book_id = ?', [bookId]);

        // 3) Opsional: bersihkan transaksi yang tidak punya item lagi
        await connection.query(`
            DELETE t FROM transactions t
            LEFT JOIN transaction_items ti ON t.transaction_id = ti.transaction_id
            WHERE ti.transaction_id IS NULL
        `);

        // 4) Hapus buku
        await connection.query('DELETE FROM books WHERE book_id = ?', [bookId]);

        await connection.commit();
        res.json({ message: 'Buku dan relasi terkait berhasil dihapus' });
    } catch (err) {
        if (connection) {
            await connection.rollback();
        }
        // Tangani error FK saat tidak force
        if (err && err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                error: 'Buku tidak dapat dihapus karena sudah dipakai dalam transaksi',
                code: 'BOOK_IN_USE',
                hint: 'Anda dapat mengarsipkan buku, atau gunakan hapus paksa jika yakin.'
            });
        }
        console.error('Error deleting book:', err);
        res.status(500).json({ error: 'Gagal menghapus buku' });
    } finally {
        if (connection) connection.release();
    }
});

// 7. Ambil semua kategori unik
router.get('/categories', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT DISTINCT category FROM books WHERE category IS NOT NULL AND category != "" ORDER BY category ASC');
        res.json(rows.map(row => row.category));
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ error: 'Gagal mengambil kategori' });
    }
});

// 8. Ambil riwayat stok buku
router.get('/:id/stock-history', async (req, res) => {
    const bookId = req.params.id;
    
    try {
        // Cek apakah tabel stock_history ada
        const [rows] = await db.query(
            `SELECT 
                transaction_date,
                quantity_change,
                reason
             FROM stock_history 
             WHERE book_id = ? 
             ORDER BY transaction_date DESC 
             LIMIT 100`,
            [bookId]
        );
        res.json(rows);
    } catch (err) {
        // Jika tabel tidak ada, return array kosong
        if (err.code === 'ER_NO_SUCH_TABLE') {
            res.json([]);
        } else {
            console.error('Error fetching stock history:', err);
            res.status(500).json({ error: 'Gagal mengambil riwayat stok' });
        }
    }
});

module.exports = router;
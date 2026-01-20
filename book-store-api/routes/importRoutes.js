const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../config/db');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        } else {
            cb(new Error('Hanya file Excel (.xlsx, .xls) yang diperbolehkan'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper: Parse Indonesian number format (e.g., '30.000' or '1.500.000')
function parseIndonesianNumber(value) {
    if (value === null || value === undefined) return 0;
    
    // If it's already a number
    if (typeof value === 'number') {
        // Check if it looks like it was parsed wrong (e.g., 30.0 instead of 30000)
        // If the number has decimals and is small, it might be wrongly parsed
        return value;
    }
    
    // Convert to string and clean up
    let str = String(value).trim();
    
    // Remove leading apostrophe (Excel text indicator)
    str = str.replace(/^'/, '');
    
    // Remove currency symbols and spaces
    str = str.replace(/[Rp\s]/gi, '');
    
    // Handle Indonesian format: dots as thousand separators, comma as decimal
    // e.g., '1.500.000' -> 1500000, '30.000,50' -> 30000.50
    
    // Check if it's Indonesian format (has dots but no comma, or dots before comma)
    const dotCount = (str.match(/\./g) || []).length;
    const commaCount = (str.match(/,/g) || []).length;
    
    if (dotCount > 0 && commaCount === 0) {
        // Format: 30.000 or 1.500.000 (Indonesian thousand separator)
        str = str.replace(/\./g, '');
    } else if (dotCount > 0 && commaCount === 1) {
        // Format: 1.500.000,50 (Indonesian with decimal)
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (commaCount === 1 && dotCount === 0) {
        // Format: 30000,50 (decimal comma without thousand separator)
        str = str.replace(',', '.');
    }
    
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
}

// Helper: Calculate string similarity (Levenshtein distance based)
function stringSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1;
    
    // Check if one contains the other
    if (longer.includes(shorter) || shorter.includes(longer)) {
        return shorter.length / longer.length + 0.3; // Boost for containment
    }
    
    // Levenshtein distance
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    
    return (longer.length - costs[s2.length]) / longer.length;
}

// Helper: Find best matching book/bundle
async function findBestMatch(productName, type) {
    const cleanName = productName.replace(/\[Bundle\]/gi, '').trim();
    
    if (type === 'bundle') {
        const [bundles] = await db.query('SELECT bundle_id, bundle_name, selling_price, stock FROM bundles WHERE is_active = 1');
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const bundle of bundles) {
            const score = stringSimilarity(cleanName, bundle.bundle_name);
            if (score > bestScore && score >= 0.5) { // Minimum 50% similarity
                bestScore = score;
                bestMatch = { ...bundle, matchScore: score };
            }
        }
        
        return bestMatch;
    } else {
        const [books] = await db.query('SELECT book_id, title, isbn, author, selling_price, stock_qty FROM books');
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const book of books) {
            const score = stringSimilarity(cleanName, book.title);
            if (score > bestScore && score >= 0.5) { // Minimum 50% similarity
                bestScore = score;
                bestMatch = { ...book, matchScore: score };
            }
        }
        
        return bestMatch;
    }
}

// Helper: Parse Excel date
function parseExcelDate(dateValue) {
    if (!dateValue) return new Date();
    
    // If it's already a Date object
    if (dateValue instanceof Date) return dateValue;
    
    // If it's a string
    if (typeof dateValue === 'string') {
        // Try parsing DD-MM-YYYY HH:mm or DD/MM/YYYY HH:mm
        const match = dateValue.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\s*(\d{1,2})?:?(\d{1,2})?/);
        if (match) {
            const [, day, month, year, hour = 0, minute = 0] = match;
            return new Date(year, month - 1, day, hour, minute);
        }
        // Try standard date parsing
        const parsed = new Date(dateValue);
        if (!isNaN(parsed)) return parsed;
    }
    
    // If it's an Excel serial number
    if (typeof dateValue === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + dateValue * 86400000);
    }
    
    return new Date();
}

// Helper: Map payment method from Excel
function mapPaymentMethod(paymentStr) {
    if (!paymentStr) return 'cash';
    const lower = paymentStr.toLowerCase();
    
    if (lower.includes('qris')) return 'qris';
    if (lower.includes('transfer') || lower.includes('bank')) return 'transfer';
    if (lower.includes('debit') || lower.includes('kartu')) return 'debit';
    if (lower.includes('cod') || lower.includes('tunai') || lower.includes('cash')) return 'cash';
    
    return 'transfer'; // Default for e-commerce
}

// POST /api/transactions/import/preview - Preview import data
router.post('/preview', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'File tidak ditemukan' });
        }

        // Parse Excel file
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet);

        if (rawData.length === 0) {
            return res.status(400).json({ error: 'File Excel kosong' });
        }

        // Group by order number
        const orderGroups = {};
        
        for (const row of rawData) {
            const orderNumber = String(row['Nomor Pesanan'] || row['No. Pesanan'] || row['Order Number'] || '').trim();
            if (!orderNumber) continue;

            if (!orderGroups[orderNumber]) {
                orderGroups[orderNumber] = {
                    orderNumber,
                    date: parseExcelDate(row['Waktu Pengiriman Diatur'] || row['Waktu Pesanan Dibuat'] || row['Order Date']),
                    paymentMethod: mapPaymentMethod(row['Metode Pembayaran'] || row['Payment Method']),
                    customerName: row['Username (Pembeli)'] || row['Username'] || row['Nama Pembeli'] || row['Customer Name'] || '',
                    totalPayment: parseIndonesianNumber(row['Total Pembayaran'] || row['Total Payment'] || 0),
                    items: []
                };
            }

            const productName = row['Nama Produk'] || row['Product Name'] || '';
            const isBundle = productName.toLowerCase().includes('[bundle]');
            const quantity = parseInt(row['Jumlah Produk Dipesan'] || row['Jumlah'] || row['Quantity'] || 1);
            const productPrice = parseIndonesianNumber(row['Total Harga Produk'] || row['Harga Produk'] || row['Price'] || 0);

            orderGroups[orderNumber].items.push({
                productName,
                isBundle,
                quantity,
                productPrice,
                unitPrice: quantity > 0 ? productPrice / quantity : productPrice
            });
        }

        // Check for existing orders and match products
        const previewData = [];
        const warnings = [];
        let newCount = 0;
        let replaceCount = 0;
        let unmatchedItems = [];

        for (const order of Object.values(orderGroups)) {
            // Check if order already exists
            const [existingOrder] = await db.query(
                'SELECT transaction_id FROM transactions WHERE order_number = ?',
                [order.orderNumber]
            );
            
            const isExisting = existingOrder.length > 0;
            if (isExisting) {
                replaceCount++;
            } else {
                newCount++;
            }

            // Match items with database
            const matchedItems = [];
            for (const item of order.items) {
                const match = await findBestMatch(item.productName, item.isBundle ? 'bundle' : 'book');
                
                const matchedItem = {
                    ...item,
                    type: item.isBundle ? 'bundle' : 'book',
                    matched: !!match,
                    matchedData: match ? {
                        id: item.isBundle ? match.bundle_id : match.book_id,
                        name: item.isBundle ? match.bundle_name : match.title,
                        isbn: match.isbn || null,
                        author: match.author || null,
                        dbPrice: match.selling_price,
                        currentStock: item.isBundle ? match.stock : match.stock_qty,
                        matchScore: Math.round(match.matchScore * 100)
                    } : null
                };
                
                matchedItems.push(matchedItem);
                
                if (!match) {
                    unmatchedItems.push({
                        orderNumber: order.orderNumber,
                        productName: item.productName,
                        type: item.isBundle ? 'bundle' : 'book'
                    });
                }
            }

            previewData.push({
                ...order,
                items: matchedItems,
                isExisting,
                existingId: isExisting ? existingOrder[0].transaction_id : null
            });
        }

        // Generate warnings
        if (unmatchedItems.length > 0) {
            warnings.push({
                type: 'unmatched',
                message: `${unmatchedItems.length} item tidak ditemukan di database dan akan diimpor dengan data minimal`,
                items: unmatchedItems
            });
        }

        if (replaceCount > 0) {
            warnings.push({
                type: 'replace',
                message: `${replaceCount} transaksi sudah ada dan akan di-replace`
            });
        }

        res.json({
            success: true,
            summary: {
                totalOrders: Object.keys(orderGroups).length,
                newOrders: newCount,
                replaceOrders: replaceCount,
                totalItems: Object.values(orderGroups).reduce((sum, o) => sum + o.items.length, 0),
                unmatchedItems: unmatchedItems.length
            },
            warnings,
            data: previewData
        });

    } catch (err) {
        console.error('Error previewing import:', err);
        res.status(500).json({ error: 'Gagal memproses file: ' + err.message });
    }
});

// POST /api/transactions/import/confirm - Confirm and execute import
router.post('/confirm', express.json({ limit: '10mb' }), async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        const { data } = req.body;
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ error: 'Data tidak valid' });
        }

        await connection.beginTransaction();

        const results = {
            imported: 0,
            replaced: 0,
            stockUpdates: [],
            errors: []
        };

        for (const order of data) {
            try {
                // If order exists, delete it first (for replace)
                if (order.isExisting && order.existingId) {
                    // Get old transaction items to restore stock
                    const [oldItems] = await connection.query(
                        'SELECT book_id, bundle_id, quantity FROM transaction_items WHERE transaction_id = ?',
                        [order.existingId]
                    );
                    
                    // Restore old stock
                    for (const oldItem of oldItems) {
                        if (oldItem.book_id) {
                            await connection.query(
                                'UPDATE books SET stock_qty = stock_qty + ? WHERE book_id = ?',
                                [oldItem.quantity, oldItem.book_id]
                            );
                        }
                        if (oldItem.bundle_id) {
                            await connection.query(
                                'UPDATE bundles SET stock = stock + ? WHERE bundle_id = ?',
                                [oldItem.quantity, oldItem.bundle_id]
                            );
                        }
                    }
                    
                    // Delete old transaction items
                    await connection.query(
                        'DELETE FROM transaction_items WHERE transaction_id = ?',
                        [order.existingId]
                    );
                    
                    // Delete old transaction
                    await connection.query(
                        'DELETE FROM transactions WHERE transaction_id = ?',
                        [order.existingId]
                    );
                    
                    results.replaced++;
                }

                // Get or create customer
                let customerId = null;
                if (order.customerName) {
                    const [existingCustomer] = await connection.query(
                        'SELECT customer_id FROM customers WHERE name = ?',
                        [order.customerName]
                    );
                    
                    if (existingCustomer.length > 0) {
                        customerId = existingCustomer[0].customer_id;
                    } else {
                        const [newCustomer] = await connection.query(
                            'INSERT INTO customers (name) VALUES (?)',
                            [order.customerName]
                        );
                        customerId = newCustomer.insertId;
                    }
                }

                // Calculate total amount
                const totalAmount = order.items.reduce((sum, item) => sum + item.productPrice, 0);

                // Insert transaction
                const [transactionResult] = await connection.query(
                    `INSERT INTO transactions (transaction_date, total_amount, payment_method, customer_id, order_number) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [order.date, totalAmount, order.paymentMethod, customerId, order.orderNumber]
                );
                
                const transactionId = transactionResult.insertId;

                // Insert transaction items and update stock
                for (const item of order.items) {
                    if (item.type === 'bundle') {
                        // Insert bundle item
                        const bundleId = item.matchedData?.id || null;
                        const priceAtSale = item.unitPrice;
                        
                        await connection.query(
                            `INSERT INTO transaction_items (transaction_id, bundle_id, quantity, price_at_sale) 
                             VALUES (?, ?, ?, ?)`,
                            [transactionId, bundleId, item.quantity, priceAtSale]
                        );
                        
                        // Update bundle stock (can go negative)
                        if (bundleId) {
                            await connection.query(
                                'UPDATE bundles SET stock = stock - ? WHERE bundle_id = ?',
                                [item.quantity, bundleId]
                            );
                            
                            results.stockUpdates.push({
                                type: 'bundle',
                                name: item.matchedData?.name || item.productName,
                                quantitySold: item.quantity
                            });
                        }
                    } else {
                        // Insert book item
                        const bookId = item.matchedData?.id || null;
                        const priceAtSale = item.unitPrice;
                        
                        await connection.query(
                            `INSERT INTO transaction_items (transaction_id, book_id, quantity, price_at_sale) 
                             VALUES (?, ?, ?, ?)`,
                            [transactionId, bookId, item.quantity, priceAtSale]
                        );
                        
                        // Update book stock (can go negative)
                        if (bookId) {
                            await connection.query(
                                'UPDATE books SET stock_qty = stock_qty - ? WHERE book_id = ?',
                                [item.quantity, bookId]
                            );
                            
                            results.stockUpdates.push({
                                type: 'book',
                                name: item.matchedData?.name || item.productName,
                                quantitySold: item.quantity
                            });
                        }
                    }
                }

                results.imported++;

            } catch (itemErr) {
                console.error('Error processing order:', order.orderNumber, itemErr);
                results.errors.push({
                    orderNumber: order.orderNumber,
                    error: itemErr.message
                });
            }
        }

        await connection.commit();

        res.json({
            success: true,
            message: `Berhasil mengimpor ${results.imported} transaksi`,
            results
        });

    } catch (err) {
        await connection.rollback();
        console.error('Error confirming import:', err);
        res.status(500).json({ error: 'Gagal mengimpor data: ' + err.message });
    } finally {
        connection.release();
    }
});

module.exports = router;

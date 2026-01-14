const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ========== GET ALL BUNDLES ==========
router.get('/', async (req, res) => {
  try {
    // First, get all active bundles
    const [bundles] = await db.query(`
      SELECT * FROM bundles WHERE is_active = TRUE ORDER BY created_at DESC
    `);

    // Then, get items for each bundle
    const bundlesWithItems = await Promise.all(bundles.map(async (bundle) => {
      const [items] = await db.query(`
        SELECT bi.book_id, bi.quantity, bk.title, bk.selling_price as book_price
        FROM bundle_items bi
        JOIN books bk ON bi.book_id = bk.book_id
        WHERE bi.bundle_id = ?
      `, [bundle.bundle_id]);

      return {
        ...bundle,
        items: items
      };
    }));

    res.json(bundlesWithItems);
  } catch (error) {
    console.error('Error fetching bundles:', error);
    res.status(500).json({ error: 'Failed to fetch bundles' });
  }
});

// ========== GET SINGLE BUNDLE ==========
router.get('/:id', async (req, res) => {
  try {
    const [bundles] = await db.query(`
      SELECT b.* FROM bundles b WHERE b.bundle_id = ? AND b.is_active = TRUE
    `, [req.params.id]);

    if (bundles.length === 0) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    const [items] = await db.query(`
      SELECT bi.*, bk.title, bk.selling_price as book_price
      FROM bundle_items bi
      JOIN books bk ON bi.book_id = bk.book_id
      WHERE bi.bundle_id = ?
    `, [req.params.id]);

    res.json({
      ...bundles[0],
      items
    });
  } catch (error) {
    console.error('Error fetching bundle:', error);
    res.status(500).json({ error: 'Failed to fetch bundle' });
  }
});

// ========== CREATE BUNDLE ==========
router.post('/', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { bundle_name, selling_price, stock, items } = req.body;

    // Validasi
    if (!bundle_name || !selling_price || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert bundle
    const [result] = await connection.query(`
      INSERT INTO bundles (bundle_name, selling_price, stock)
      VALUES (?, ?, ?)
    `, [bundle_name, selling_price, stock || 0]);

    const bundleId = result.insertId;

    // Insert bundle items
    for (const item of items) {
      await connection.query(`
        INSERT INTO bundle_items (bundle_id, book_id, quantity)
        VALUES (?, ?, ?)
      `, [bundleId, item.book_id, item.quantity || 1]);
    }

    await connection.commit();

    res.status(201).json({
      message: 'Bundle created successfully',
      bundle_id: bundleId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating bundle:', error);
    res.status(500).json({ error: 'Failed to create bundle' });
  } finally {
    connection.release();
  }
});

// ========== UPDATE BUNDLE ==========
router.put('/:id', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { bundle_name, selling_price, stock, items } = req.body;
    const bundleId = req.params.id;

    // Update bundle info
    await connection.query(`
      UPDATE bundles 
      SET bundle_name = ?, selling_price = ?, stock = ?
      WHERE bundle_id = ?
    `, [bundle_name, selling_price, stock, bundleId]);

    // Delete existing items and re-insert
    await connection.query(`DELETE FROM bundle_items WHERE bundle_id = ?`, [bundleId]);

    // Insert new items
    for (const item of items) {
      await connection.query(`
        INSERT INTO bundle_items (bundle_id, book_id, quantity)
        VALUES (?, ?, ?)
      `, [bundleId, item.book_id, item.quantity || 1]);
    }

    await connection.commit();

    res.json({ message: 'Bundle updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating bundle:', error);
    res.status(500).json({ error: 'Failed to update bundle' });
  } finally {
    connection.release();
  }
});

// ========== DELETE BUNDLE (Soft Delete) ==========
router.delete('/:id', async (req, res) => {
  try {
    await db.query(`UPDATE bundles SET is_active = FALSE WHERE bundle_id = ?`, [req.params.id]);
    res.json({ message: 'Bundle deleted successfully' });
  } catch (error) {
    console.error('Error deleting bundle:', error);
    res.status(500).json({ error: 'Failed to delete bundle' });
  }
});

// ========== SELL BUNDLE (Kurangi stok bundle & buku) ==========
router.post('/:id/sell', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const bundleId = req.params.id;
    const { quantity = 1, transaction_id } = req.body;

    // Get bundle info
    const [bundles] = await connection.query(`
      SELECT * FROM bundles WHERE bundle_id = ? AND is_active = TRUE
    `, [bundleId]);

    if (bundles.length === 0) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    const bundle = bundles[0];

    // Check stock
    if (bundle.stock < quantity) {
      return res.status(400).json({ error: 'Insufficient bundle stock' });
    }

    // Get bundle items
    const [items] = await connection.query(`
      SELECT bi.*, bk.stock as book_stock
      FROM bundle_items bi
      JOIN books bk ON bi.book_id = bk.book_id
      WHERE bi.bundle_id = ?
    `, [bundleId]);

    // Check if all books have enough stock
    for (const item of items) {
      const requiredStock = item.quantity * quantity;
      if (item.book_stock < requiredStock) {
        await connection.rollback();
        return res.status(400).json({ 
          error: `Insufficient stock for book ID ${item.book_id}` 
        });
      }
    }

    // Reduce bundle stock
    await connection.query(`
      UPDATE bundles SET stock = stock - ? WHERE bundle_id = ?
    `, [quantity, bundleId]);

    // Reduce book stocks
    for (const item of items) {
      const reduceAmount = item.quantity * quantity;
      await connection.query(`
        UPDATE books SET stock = stock - ? WHERE book_id = ?
      `, [reduceAmount, item.book_id]);

      // Record stock history
      await connection.query(`
        INSERT INTO stock_history (book_id, change_type, quantity, notes)
        VALUES (?, 'out', ?, ?)
      `, [item.book_id, reduceAmount, `Sold as part of bundle: ${bundle.bundle_name}`]);
    }

    await connection.commit();

    res.json({ 
      message: 'Bundle sold successfully',
      bundle_id: bundleId,
      quantity_sold: quantity
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error selling bundle:', error);
    res.status(500).json({ error: 'Failed to sell bundle' });
  } finally {
    connection.release();
  }
});

module.exports = router;

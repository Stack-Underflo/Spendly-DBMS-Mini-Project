// backend/routes/expenses.js
const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');

// GET /api/expenses — list all
router.get('/', async (req, res) => {
  try {
    // ROOT FIX: If there is no authenticated user, return an empty list immediately
    if (!req.userId) {
      return res.json({ success: true, data: [] });
    }

    const filter = { userId: req.userId.toString() };
    
    if (req.query.category) filter.category = req.query.category;
    const limit = parseInt(req.query.limit) || 0;

    const expenses = await Expense.find(filter).sort({ date: -1, createdAt: -1 }).limit(limit);
    res.json({ success: true, data: expenses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/expenses/stats — dashboard stats
router.get('/stats', async (req, res) => {
  try {
    // ROOT FIX: Return zeroed out structures immediately for guests
    if (!req.userId) {
      return res.json({
        success: true,
        data: {
          allTime: { total: 0, count: 0 },
          monthly: { total: 0, count: 0 },
          byCategory: []
        }
      });
    }

    const userIdStr = req.userId.toString();

    const allTimeAgg = await Expense.aggregate([
      { $match: { userId: userIdStr } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyAgg = await Expense.aggregate([
      { $match: { userId: userIdStr, date: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const byCategory = await Expense.aggregate([
      { $match: { userId: userIdStr } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        allTime: allTimeAgg[0] || { total: 0, count: 0 },
        monthly: monthlyAgg[0] || { total: 0, count: 0 },
        byCategory,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. POST /api/expenses — create new expense
// POST /api/expenses — create new expense
router.post('/', async (req, res) => {
  try {
    // ROOT FIX: Block writes if unauthenticated
    if (!req.userId) {
      return res.status(401).json({ success: false, message: 'Please sign in to log expenses.' });
    }

    const { title, amount, category, date, notes } = req.body;
    const expense = await Expense.create({ 
      title, 
      amount, 
      category, 
      date, 
      notes, 
      userId: req.userId.toString()
    });

    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    const msg = err.errors ? Object.values(err.errors)[0].message : err.message;
    res.status(400).json({ success: false, message: msg });
  }
});

// 4. DELETE /api/expenses/:id — delete expense
router.delete('/:id', async (req, res) => {
  try {
    const userIdStr = req.userId ? req.userId.toString() : '000000000000000000000000';
    
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      userId: userIdStr
    });

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found or unauthorized' });
    }

    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
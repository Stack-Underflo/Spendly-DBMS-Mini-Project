// backend/routes/expenses.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // NEEDED FOR OBJECTID CASTING
const Expense = require('../models/Expense');

// GET /api/expenses — list all
router.get('/', async (req, res) => {
  try {
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
    
    // SAFEDOCK CONFIGURATION: Create a strict ObjectId wrapper for cloud database engine compatibility
    let userIdObj = null;
    try {
      userIdObj = new mongoose.Types.ObjectId(userIdStr);
    } catch (e) {
      // Fallback if string isn't valid ObjectId format
    }

    // MATCH FILTER MATRIX: Matches whether stored as a plain String OR formal ObjectId
    const matchUserCondition = userIdObj 
      ? { $or: [{ userId: userIdStr }, { userId: userIdObj }] }
      : { userId: userIdStr };

    // 1. Calculate All-Time Totals
    const allTimeAgg = await Expense.aggregate([
      { $match: matchUserCondition },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    // 2. Calculate Current Month Totals
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyAgg = await Expense.aggregate([
      { 
        $match: {
          ...matchUserCondition,
          date: { $gte: monthStart }
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    // 3. Group by Category Matrix
    const byCategory = await Expense.aggregate([
      { $match: matchUserCondition },
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

// POST /api/expenses — create new expense
router.post('/', async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: 'Please sign in to log expenses.' });
    }

    const { title, amount, category, date, notes } = req.body;
    
    // Parse the date explicitly so MongoDB treats it as a true Date index rather than a string representation
    const parsedDate = date ? new Date(date) : new Date();

    const expense = await Expense.create({ 
      title, 
      amount: parseFloat(amount), 
      category, 
      date: parsedDate, 
      notes, 
      userId: req.userId.toString()
    });

    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    const msg = err.errors ? Object.values(err.errors)[0].message : err.message;
    res.status(400).json({ success: false, message: msg });
  }
});

// DELETE /api/expenses/:id — delete expense
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

// backend/routes/ai.js
const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');

// SAFETY ANCHOR: Force dotenv to load directly here just in case server.js execution order got shifted
require('dotenv').config();

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent';
const CATEGORIES = ['Food', 'Transport', 'Housing', 'Entertainment', 'Health', 'Shopping', 'Education', 'Other'];

// ─── Helper: call Gemini API with correct structure ───
async function gemini(contents, systemInstructionText = null) {
  const body = { contents };
  
  if (systemInstructionText) {
    body.systemInstruction = {
      parts: [{ text: systemInstructionText }]
    };
  }

  // CLEANING MATRIX: Extract key and aggressively trim any hidden whitespace/newlines/quotes from the .env file
  const rawApiKey = process.env.GEMINI_API_KEY;
  const apiKey = rawApiKey ? rawApiKey.replace(/['";\s]/g, '') : '';

  // Bulletproof fallback condition validation
  if (!apiKey || apiKey === '' || apiKey === 'AIzaSyDNx6lO5GMEo7Ea4pB5DHmzn5P5HKvl2EA') {
    throw new Error(`Gemini API key is unconfigured or evaluation failed. Value state: ${typeof rawApiKey}`);
  }

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API returned error state code: ${res.status}`);
  }

  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

// POST /api/ai/categorize — auto-tag an expense title
router.post('/categorize', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required' });

    const prompt = `Categorize this expense title: "${title}". Choose exactly one from: ${CATEGORIES.join(', ')}. Reply with ONLY the category name.`;
    const reply = await gemini([{ parts: [{ text: prompt }] }]);
    
    const cleanReply = reply.trim();
    const finalCategory = CATEGORIES.includes(cleanReply) ? cleanReply : 'Other';

    res.json({ success: true, category: finalCategory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/ai/analyze — monthly insights report
router.post('/analyze', async (req, res) => {
  try {
    if (!req.userId) {
      return res.json({ 
        success: true, 
        analysis: "### Guest Mode Analytical Matrix\nTo unlock customized AI spending advice, category distribution metrics, and actionable budgeting advice, please register or sign into your profile account container." 
      });
    }

    const expenses = await Expense.find({ userId: req.userId.toString() }).sort({ date: -1 }).limit(100);

    const dataSummary = expenses.map(e => ({
      title: e.title,
      amount: e.amount,
      category: e.category,
      date: e.date.toISOString().split('T')[0]
    }));

    const systemPrompt = "You are a professional financial advisor bot named Spendly AI. Analyze the user's transaction data, point out spending habits, highlight categories costing them the most, and provide 3 highly actionable budgeting tips. Use Markdown for structuring headers and bullet lines.";
    const userMessage = `Here are my recent expenses:\n${JSON.stringify(dataSummary, null, 2)}`;

    const reply = await gemini([{ parts: [{ text: userMessage }] }], systemPrompt);
    res.json({ success: true, analysis: reply });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/ai/chat — contextual conversational chatbot
router.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required' });

    let dataSummary = [];
    if (req.userId) {
      const expenses = await Expense.find({ userId: req.userId.toString() }).sort({ date: -1 }).limit(100);
      dataSummary = expenses.map(e => ({
        title: e.title,
        amount: e.amount,
        category: e.category,
        date: e.date.toISOString().split('T')[0]
      }));
    }

    const systemPrompt = `You are Spendly AI, a helpful personal finance companion. You have real-time access to the user's database records. Answer their questions accurately based on this ledger data.\n\nUser's Current Expenses:\n${JSON.stringify(dataSummary, null, 2)}`;

    const contents = [];
    if (history && Array.isArray(history)) {
      history.forEach(turn => {
        contents.push({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.content }]
        });
      });
    }
    
    contents.push({ role: 'user', parts: [{ text: message }] });

    const reply = await gemini(contents, systemPrompt);
    res.json({ success: true, reply });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
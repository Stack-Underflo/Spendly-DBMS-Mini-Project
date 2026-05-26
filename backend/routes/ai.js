// backend/routes/ai.js
const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const { GoogleGenAI } = require('@google/genai'); // 1. Import official SDK

// SAFETY ANCHOR: Force dotenv to load directly here just in case server.js execution order got shifted
require('dotenv').config();

const CATEGORIES = ['Food', 'Transport', 'Housing', 'Entertainment', 'Health', 'Shopping', 'Education', 'Other'];

// CLEANING MATRIX: Extract key and aggressively trim any hidden whitespace/newlines/quotes from the .env file
const rawApiKey = process.env.GEMINI_API_KEY;
const apiKey = rawApiKey ? rawApiKey.replace(/['";\s]/g, '') : '';

// 2. Initialize the client using the exact syntax from your snippet
const ai = new GoogleGenAI({ apiKey: apiKey });
const MODEL_NAME = 'gemini-3.1-flash-lite'; // Picked up directly from your AI Studio config

// POST /api/ai/categorize — auto-tag an expense title
router.post('/categorize', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required' });

    const prompt = `Categorize this expense title: "${title}". Choose exactly one from: ${CATEGORIES.join(', ')}. Reply with ONLY the category name.`;
    
    // 3. Replaced custom fetch wrapper with clean native client generation call
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    const reply = response.text || 'Other';
    const cleanReply = reply.trim();
    const finalCategory = CATEGORIES.includes(cleanReply) ? cleanReply : 'Other';

    res.json({ success: true, category: finalCategory });
  } catch (err) {
    console.error("AI Categorization failed:", err.message);
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
      date: e.date ? e.date.toISOString().split('T')[0] : 'Unknown Date'
    }));

    const userMessage = `Here are my recent expenses:\n${JSON.stringify(dataSummary, null, 2)}`;

    // 4. Injected your precise systemInstructions payload structure straight from your snippet
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: "You are Spendly AI, a helpful personal finance companion. You analyze transaction logs, point out spending habits, and give 3 highly actionable budgeting tips using clean Markdown format.",
      }
    });

    res.json({ success: true, analysis: response.text });
  } catch (err) {
    console.error("AI Analysis failing trace:", err.message);
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
        date: e.date ? e.date.toISOString().split('T')[0] : 'Unknown Date'
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

    // 5. Native SDK generation execution map with matching session history matrix arrays
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    res.json({ success: true, reply: response.text });
  } catch (err) {
    console.error("AI Chat engine dropped packet error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

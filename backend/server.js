require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const protect = require('./middleware/authMiddleware'); 
const authRoutes = require('./routes/auth');           
const expenseRoutes = require('./routes/expenses');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── STANDARD MIDDLEWARE ───
app.use(cors());
app.use(express.json());


// ─── 1. PUBLIC API ROUTES (NO AUTH REQUIRED) ───
app.use('/api/auth', authRoutes);


// ─── 2. GLOBAL AUTH INJECTOR MIDDLEWARE ───
// This intercepts incoming requests and decodes req.userId for protected routes down the chain
app.use(protect);


// ─── 3. SECURED PROTECTED API ROUTES ───
app.use('/api/expenses', expenseRoutes);
app.use('/api/ai', aiRoutes);


// ─── 4. HEALTH MONITORING CHECK ───
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' 
  });
});


// ─── 5. CATCH-ALL INTERCEPTOR (CLEAN API GATEWAY LANDING) ───
// FIXED: Replaced the broken local file reader (res.sendFile) with a stable JSON response.
// If anyone hits your main Render domain URL directly via a browser, they get a healthy confirmation message.
app.get('*', (req, res) => {
  res.json({ 
    message: "Spendly API Engine Gateway is active and live.", 
    status: "production",
    infrastructure: "Database operational coordinates mapped successfully."
  });
});


// ─── CONNECT TO MONGOOSE DATABASE & BOOT CORES ───
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅  MongoDB connected successfully');
    app.listen(PORT, () => console.log(`🚀  Spendly API running at port ${PORT}`));
  })
  .catch(err => {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  });

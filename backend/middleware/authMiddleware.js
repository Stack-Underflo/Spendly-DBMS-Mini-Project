// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // If there's no token header at all, treat them cleanly as a guest
    if (!authHeader) {
      req.userId = null;
      return next();
    }

    // Extract the token string cleanly even if it contains extra spaces
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : authHeader;

    if (!token || token === 'null' || token === 'undefined') {
      req.userId = null;
      return next();
    }

    // Verify token payload matrix
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId; // Securely attach the true user ID to the request object
    
    next();
  } catch (err) {
    // If token verification fails (expired or altered), clear the session context instead of crashing
    req.userId = null;
    next();
  }
};
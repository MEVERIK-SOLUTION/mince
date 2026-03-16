// Security Hardening Middleware
// Comprehensive security measures for production deployment

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const validator = require('validator');
const xss = require('xss');
const { body, validationResult } = require('express-validator');

// Security configuration
const SECURITY_CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
  LOCKOUT_TIME: parseInt(process.env.LOCKOUT_TIME) || 15 * 60 * 1000, // 15 minutes
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIRE_SPECIAL: true,
  PASSWORD_REQUIRE_NUMBER: true,
  PASSWORD_REQUIRE_UPPERCASE: true,
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
};

// Password strength validation
const validatePasswordStrength = (password) => {
  const errors = [];
  
  if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters long`);
  }
  
  if (SECURITY_CONFIG.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (SECURITY_CONFIG.PASSWORD_REQUIRE_NUMBER && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (SECURITY_CONFIG.PASSWORD_REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check against common passwords
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Input sanitization
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove XSS attempts
  let sanitized = xss(input, {
    whiteList: {}, // No HTML tags allowed
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script']
  });
  
  // Remove SQL injection attempts
  sanitized = sanitized.replace(/['";\\]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
};

// Request sanitization middleware
const sanitizeRequest = (req, res, next) => {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    }
  }
  
  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeInput(req.query[key]);
      }
    }
  }
  
  // Sanitize URL parameters
  if (req.params && typeof req.params === 'object') {
    for (const key in req.params) {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeInput(req.params[key]);
      }
    }
  }
  
  next();
};

// Advanced rate limiting with progressive delays
const createAdvancedRateLimit = (options) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    delayAfter = 50,
    delayMs = 500,
    maxDelayMs = 20000,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = (req) => req.ip,
  } = options;
  
  const limiter = rateLimit({
    windowMs,
    max,
    skipSuccessfulRequests,
    skipFailedRequests,
    keyGenerator,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000),
        message: 'Please try again later'
      });
    }
  });
  
  const speedLimiter = slowDown({
    windowMs,
    delayAfter,
    delayMs,
    maxDelayMs,
    keyGenerator,
  });
  
  return [limiter, speedLimiter];
};

// JWT token management
class TokenManager {
  static generateTokens(payload) {
    const accessToken = jwt.sign(
      payload,
      SECURITY_CONFIG.JWT_SECRET,
      { expiresIn: SECURITY_CONFIG.JWT_EXPIRES_IN }
    );
    
    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      SECURITY_CONFIG.JWT_SECRET,
      { expiresIn: SECURITY_CONFIG.REFRESH_TOKEN_EXPIRES_IN }
    );
    
    return { accessToken, refreshToken };
  }
  
  static verifyToken(token, type = 'access') {
    try {
      const decoded = jwt.verify(token, SECURITY_CONFIG.JWT_SECRET);
      
      if (type === 'refresh' && decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      
      return { valid: true, decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
  
  static refreshAccessToken(refreshToken) {
    const verification = this.verifyToken(refreshToken, 'refresh');
    
    if (!verification.valid) {
      throw new Error('Invalid refresh token');
    }
    
    const { decoded } = verification;
    const newPayload = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };
    
    return this.generateTokens(newPayload);
  }
}

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    const verification = TokenManager.verifyToken(token);
    
    if (!verification.valid) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.user = verification.decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Token verification failed' });
  }
};

// Role-based authorization
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

// Account lockout management
class AccountLockout {
  constructor() {
    this.attempts = new Map(); // In production, use Redis
    this.lockouts = new Map();
  }
  
  recordFailedAttempt(identifier) {
    const now = Date.now();
    const attempts = this.attempts.get(identifier) || [];
    
    // Remove old attempts (outside window)
    const recentAttempts = attempts.filter(
      attempt => now - attempt < SECURITY_CONFIG.LOCKOUT_TIME
    );
    
    recentAttempts.push(now);
    this.attempts.set(identifier, recentAttempts);
    
    if (recentAttempts.length >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
      this.lockouts.set(identifier, now + SECURITY_CONFIG.LOCKOUT_TIME);
      return true; // Account locked
    }
    
    return false;
  }
  
  isLocked(identifier) {
    const lockoutTime = this.lockouts.get(identifier);
    if (!lockoutTime) return false;
    
    if (Date.now() > lockoutTime) {
      this.lockouts.delete(identifier);
      this.attempts.delete(identifier);
      return false;
    }
    
    return true;
  }
  
  clearAttempts(identifier) {
    this.attempts.delete(identifier);
    this.lockouts.delete(identifier);
  }
  
  getRemainingLockoutTime(identifier) {
    const lockoutTime = this.lockouts.get(identifier);
    if (!lockoutTime) return 0;
    
    const remaining = lockoutTime - Date.now();
    return Math.max(0, remaining);
  }
}

const accountLockout = new AccountLockout();

// Session management
class SessionManager {
  constructor() {
    this.sessions = new Map(); // In production, use Redis
  }
  
  createSession(userId, sessionData = {}) {
    const sessionId = crypto.randomUUID();
    const session = {
      id: sessionId,
      userId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      data: sessionData,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
    };
    
    this.sessions.set(sessionId, session);
    
    // Clean up expired sessions
    this.cleanupExpiredSessions();
    
    return sessionId;
  }
  
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    // Check if session is expired
    if (Date.now() - session.lastActivity > SECURITY_CONFIG.SESSION_TIMEOUT) {
      this.sessions.delete(sessionId);
      return null;
    }
    
    // Update last activity
    session.lastActivity = Date.now();
    return session;
  }
  
  updateSession(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.data = { ...session.data, ...data };
      session.lastActivity = Date.now();
    }
  }
  
  destroySession(sessionId) {
    this.sessions.delete(sessionId);
  }
  
  destroyUserSessions(userId) {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
      }
    }
  }
  
  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > SECURITY_CONFIG.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

const sessionManager = new SessionManager();

// Input validation schemas
const validationSchemas = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
    
  password: body('password')
    .isLength({ min: SECURITY_CONFIG.PASSWORD_MIN_LENGTH })
    .withMessage(`Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters`)
    .custom((value) => {
      const validation = validatePasswordStrength(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      return true;
    }),
    
  coinData: [
    body('denomination').trim().isLength({ min: 1, max: 100 }).withMessage('Denomination is required'),
    body('year').isInt({ min: 1, max: new Date().getFullYear() + 1 }).withMessage('Valid year is required'),
    body('country_id').isInt({ min: 1 }).withMessage('Valid country is required'),
    body('material_id').isInt({ min: 1 }).withMessage('Valid material is required'),
    body('condition').isIn(['poor', 'fair', 'good', 'very_good', 'fine', 'very_fine', 'extremely_fine', 'uncirculated']).withMessage('Valid condition is required'),
  ],
  
  collectionData: [
    body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Collection name is required'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description too long'),
  ],
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// File upload security
const validateFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }
  
  const files = req.files || [req.file];
  
  for (const file of files) {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'
      });
    }
    
    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return res.status(400).json({
        error: 'File too large. Maximum size is 5MB.'
      });
    }
    
    // Check for malicious content (basic check)
    if (file.buffer) {
      const header = file.buffer.slice(0, 10).toString('hex');
      const validHeaders = {
        'ffd8ff': 'jpeg',
        '89504e': 'png',
        '524946': 'webp'
      };
      
      const isValid = Object.keys(validHeaders).some(h => header.startsWith(h));
      if (!isValid) {
        return res.status(400).json({
          error: 'Invalid file format or corrupted file.'
        });
      }
    }
  }
  
  next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HSTS header for HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
};

// IP whitelist/blacklist
class IPFilter {
  constructor() {
    this.whitelist = new Set(process.env.IP_WHITELIST?.split(',') || []);
    this.blacklist = new Set(process.env.IP_BLACKLIST?.split(',') || []);
  }
  
  isAllowed(ip) {
    if (this.blacklist.has(ip)) return false;
    if (this.whitelist.size > 0 && !this.whitelist.has(ip)) return false;
    return true;
  }
  
  addToBlacklist(ip) {
    this.blacklist.add(ip);
  }
  
  removeFromBlacklist(ip) {
    this.blacklist.delete(ip);
  }
}

const ipFilter = new IPFilter();

// IP filtering middleware
const filterIPs = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (!ipFilter.isAllowed(clientIP)) {
    return res.status(403).json({
      error: 'Access denied from this IP address'
    });
  }
  
  next();
};

// Export all security components
module.exports = {
  SECURITY_CONFIG,
  validatePasswordStrength,
  sanitizeInput,
  sanitizeRequest,
  createAdvancedRateLimit,
  TokenManager,
  authenticateToken,
  authorize,
  accountLockout,
  sessionManager,
  validationSchemas,
  handleValidationErrors,
  validateFileUpload,
  securityHeaders,
  ipFilter,
  filterIPs,
  AccountLockout,
  SessionManager,
  IPFilter,
};
// Monitoring and Logging Middleware
// Advanced monitoring, error tracking, and performance analytics

const winston = require('winston');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');

// Configure Winston Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
  ),
  defaultMeta: {
    service: 'coin-collection-api',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
  ],
});

// Add external logging services in production
if (process.env.NODE_ENV === 'production') {
  // Sentry integration
  if (process.env.SENTRY_DSN) {
    const Sentry = require('@sentry/node');
    
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      release: process.env.APP_VERSION,
      tracesSampleRate: 0.1,
      profilesSampleRate: 0.1,
    });
    
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          if (level === 'error') {
            Sentry.captureException(new Error(message), { extra: meta });
          }
          return `${timestamp} [${level}]: ${message} ${JSON.stringify(meta)}`;
        })
      )
    }));
  }
  
  // DataDog integration
  if (process.env.DATADOG_API_KEY) {
    const datadogWinston = require('datadog-winston');
    
    logger.add(new datadogWinston({
      apikey: process.env.DATADOG_API_KEY,
      hostname: process.env.HOSTNAME || 'coin-collection-api',
      service: 'coin-collection',
      ddsource: 'nodejs',
      ddtags: `env:${process.env.NODE_ENV},version:${process.env.APP_VERSION}`
    }));
  }
}

// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: [],
      memoryUsage: [],
      cpuUsage: [],
    };
    
    this.startTime = Date.now();
    this.collectSystemMetrics();
  }
  
  collectSystemMetrics() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.metrics.memoryUsage.push({
        timestamp: Date.now(),
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
      });
      
      this.metrics.cpuUsage.push({
        timestamp: Date.now(),
        user: cpuUsage.user,
        system: cpuUsage.system,
      });
      
      // Keep only last 100 entries
      if (this.metrics.memoryUsage.length > 100) {
        this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
      }
      if (this.metrics.cpuUsage.length > 100) {
        this.metrics.cpuUsage = this.metrics.cpuUsage.slice(-100);
      }
      
      // Log high memory usage
      if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
        logger.warn('High memory usage detected', {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          rss: memUsage.rss
        });
      }
      
    }, 30000); // Every 30 seconds
  }
  
  recordRequest(duration, statusCode, route) {
    this.metrics.requests++;
    this.metrics.responseTime.push({
      timestamp: Date.now(),
      duration,
      statusCode,
      route
    });
    
    if (statusCode >= 400) {
      this.metrics.errors++;
    }
    
    // Keep only last 1000 entries
    if (this.metrics.responseTime.length > 1000) {
      this.metrics.responseTime = this.metrics.responseTime.slice(-1000);
    }
    
    // Log slow requests
    if (duration > 5000) { // 5 seconds
      logger.warn('Slow request detected', {
        duration,
        route,
        statusCode
      });
    }
  }
  
  getMetrics() {
    const now = Date.now();
    const uptime = now - this.startTime;
    
    const recentResponseTimes = this.metrics.responseTime
      .filter(r => now - r.timestamp < 300000) // Last 5 minutes
      .map(r => r.duration);
    
    const avgResponseTime = recentResponseTimes.length > 0
      ? recentResponseTimes.reduce((a, b) => a + b, 0) / recentResponseTimes.length
      : 0;
    
    const recentErrors = this.metrics.responseTime
      .filter(r => now - r.timestamp < 300000 && r.statusCode >= 400)
      .length;
    
    const recentRequests = this.metrics.responseTime
      .filter(r => now - r.timestamp < 300000)
      .length;
    
    const errorRate = recentRequests > 0 ? (recentErrors / recentRequests) * 100 : 0;
    
    return {
      uptime,
      totalRequests: this.metrics.requests,
      totalErrors: this.metrics.errors,
      recentRequests,
      recentErrors,
      errorRate,
      avgResponseTime,
      memoryUsage: this.metrics.memoryUsage.slice(-1)[0],
      cpuUsage: this.metrics.cpuUsage.slice(-1)[0],
    };
  }
}

const performanceMonitor = new PerformanceMonitor();

// Request logging middleware
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  // Override res.send to capture response
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const route = req.route ? req.route.path : req.path;
    
    // Record metrics
    performanceMonitor.recordRequest(duration, res.statusCode, route);
    
    // Log request
    logger.info('HTTP Request', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id,
      requestId: req.id,
    });
    
    // Call original send
    originalSend.call(this, data);
  };
  
  next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  const errorId = require('crypto').randomUUID();
  
  logger.error('Application Error', {
    errorId,
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
    requestId: req.id,
    body: req.body,
    query: req.query,
    params: req.params,
  });
  
  // Send error response
  res.status(err.status || 500).json({
    error: {
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message,
      errorId,
      timestamp: new Date().toISOString(),
    }
  });
};

// Health check endpoint
const healthCheck = (req, res) => {
  const metrics = performanceMonitor.getMetrics();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: metrics.uptime,
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    metrics: {
      requests: {
        total: metrics.totalRequests,
        recent: metrics.recentRequests,
        errors: metrics.recentErrors,
        errorRate: metrics.errorRate,
      },
      performance: {
        avgResponseTime: metrics.avgResponseTime,
        memoryUsage: metrics.memoryUsage,
        cpuUsage: metrics.cpuUsage,
      },
    },
    dependencies: {
      database: 'healthy', // Would check actual DB connection
      redis: 'healthy',    // Would check actual Redis connection
      storage: 'healthy',  // Would check actual storage connection
    }
  };
  
  // Determine overall health status
  if (metrics.errorRate > 10) {
    health.status = 'degraded';
  }
  
  if (metrics.errorRate > 50 || metrics.avgResponseTime > 10000) {
    health.status = 'unhealthy';
  }
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
};

// Metrics endpoint for monitoring systems
const metricsEndpoint = (req, res) => {
  const metrics = performanceMonitor.getMetrics();
  
  // Prometheus-style metrics format
  const prometheusMetrics = `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metrics.totalRequests}

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_sum ${metrics.avgResponseTime / 1000}
http_request_duration_seconds_count ${metrics.recentRequests}

# HELP http_errors_total Total number of HTTP errors
# TYPE http_errors_total counter
http_errors_total ${metrics.totalErrors}

# HELP process_resident_memory_bytes Resident memory size in bytes
# TYPE process_resident_memory_bytes gauge
process_resident_memory_bytes ${metrics.memoryUsage?.rss || 0}

# HELP process_heap_bytes Process heap size in bytes
# TYPE process_heap_bytes gauge
process_heap_bytes ${metrics.memoryUsage?.heapUsed || 0}

# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total ${(metrics.cpuUsage?.user + metrics.cpuUsage?.system) / 1000000 || 0}
  `.trim();
  
  res.set('Content-Type', 'text/plain');
  res.send(prometheusMetrics);
};

// Rate limiting configuration
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
      });
      
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
};

// Security middleware configuration
const securityMiddleware = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://api.supabase.co"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
  
  compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    threshold: 1024,
  }),
  
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200,
  }),
];

// Rate limiters for different endpoints
const rateLimiters = {
  general: createRateLimiter(15 * 60 * 1000, 100, 'Too many requests'),
  auth: createRateLimiter(15 * 60 * 1000, 5, 'Too many authentication attempts'),
  upload: createRateLimiter(60 * 60 * 1000, 20, 'Too many upload attempts'),
  api: createRateLimiter(15 * 60 * 1000, 1000, 'API rate limit exceeded'),
};

// Database query monitoring
const queryMonitor = {
  logSlowQueries: (query, duration, params = {}) => {
    if (duration > 1000) { // Log queries slower than 1 second
      logger.warn('Slow database query', {
        query: query.substring(0, 200), // Truncate long queries
        duration,
        params: Object.keys(params).length > 0 ? params : undefined,
      });
    }
  },
  
  logQueryError: (query, error, params = {}) => {
    logger.error('Database query error', {
      query: query.substring(0, 200),
      error: error.message,
      params: Object.keys(params).length > 0 ? params : undefined,
    });
  },
};

// Custom monitoring hooks
const monitoringHooks = {
  onUserLogin: (userId, ip, userAgent) => {
    logger.info('User login', { userId, ip, userAgent });
  },
  
  onUserLogout: (userId) => {
    logger.info('User logout', { userId });
  },
  
  onCoinAdded: (userId, coinId, collectionId) => {
    logger.info('Coin added', { userId, coinId, collectionId });
  },
  
  onCollectionShared: (userId, collectionId, sharedWithUserId) => {
    logger.info('Collection shared', { userId, collectionId, sharedWithUserId });
  },
  
  onBackupCreated: (userId, backupId, size) => {
    logger.info('Backup created', { userId, backupId, size });
  },
  
  onSecurityEvent: (event, userId, details) => {
    logger.warn('Security event', { event, userId, details });
  },
};

// Export all monitoring components
module.exports = {
  logger,
  performanceMonitor,
  requestLogger,
  errorLogger,
  healthCheck,
  metricsEndpoint,
  rateLimiters,
  securityMiddleware,
  queryMonitor,
  monitoringHooks,
};
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const propertyRoutes = require('./routes/properties.routes');
const tenantRoutes = require('./routes/tenants.routes');
const contractRoutes = require('./routes/contracts.routes');
const paymentRoutes = require('./routes/payments.routes');
const expenseRoutes = require('./routes/expenses.routes');
const maintenanceRoutes = require('./routes/maintenance.routes');
const reportRoutes = require('./routes/reports.routes');
const lawyerRoutes = require('./routes/lawyers.routes');
const marketPricesRoutes = require('./routes/market_prices.routes');
const taxRoutes = require('./routes/taxes.routes');
const locationRoutes = require('./routes/locations.routes');
const documentRoutes = require('./routes/documents.routes');
const organizationRoutes = require('./routes/organizations.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);

// Security
app.use(helmet());

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : null; // null = tüm originlere izin ver

app.use(cors({
  origin: corsOrigins
    ? (origin, cb) => {
        // origin undefined = Postman/curl/mobil gibi non-browser istekler — izin ver
        if (!origin || corsOrigins.includes('*') || corsOrigins.includes(origin)) {
          cb(null, true);
        } else {
          cb(new Error('CORS policy: bu origin izin listesinde değil'));
        }
      }
    : true, // CORS_ORIGIN tanımlı değilse herkese izin ver
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Çok fazla deneme, 15 dakika bekleyin' }
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/properties', propertyRoutes);
app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/contracts', contractRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/maintenance', maintenanceRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/legal', lawyerRoutes);
app.use('/api/v1/market-prices', marketPricesRoutes);
app.use('/api/v1/taxes', taxRoutes);
app.use('/api/v1/locations', locationRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/organizations', organizationRoutes);

// 404
app.use((_req, res) => res.status(404).json({ success: false, message: 'Endpoint bulunamadı' }));

// Error handler
app.use(errorHandler);

module.exports = app;

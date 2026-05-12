// index.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');

const app = express();
const PORT = process.env.PORT || 3000;

// --- SECURITY ---
app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['*'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, error: "Too many requests, please try again later." }
});
app.use('/api', limiter);

app.use(express.json());

// --- CONFIGURATION FROM ENVIRONMENT VARIABLES ---
const NW_API_KEY = process.env.NW_API_KEY;
const NW_API_SECRET = process.env.NW_API_SECRET;
const BRIDGE_API_KEY = process.env.RENDER_BRIDGE_KEY;
const NW_BASE_URL = 'https://api.northwestregisteredagent.com/v1/filings';

if (!NW_API_KEY || !NW_API_SECRET || !BRIDGE_API_KEY) {
    console.error('CRITICAL ERROR: Missing environment variables. Check Render dashboard.');
    process.exit(1);
}

// --- AUTHORIZATION MIDDLEWARE ---
app.use('/api', (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: "Unauthorized: Missing token" });
    }

    const token = authHeader.split(' ')[1];
    if (token !== BRIDGE_API_KEY) {
        return res.status(401).json({ success: false, error: "Unauthorized: Invalid token" });
    }

    next();
});

// --- INPUT VALIDATION ---
const filingSchema = Joi.object({
    state: Joi.string().required().min(2).max(2).uppercase(),
    entityType: Joi.string().valid('LLC', 'Corp', 'LLP', 'LP', 'S-Corp').default('LLC'),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^\+?[\d\s-()]{10,}$/).required(),
    companyName: Joi.string().min(3).required(),
    address1: Joi.string().min(5).required(),
    city: Joi.string().min(2).required(),
    zip: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required()
});

// --- ROUTES ---

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api', async (req, res) => {
    try {
        const { error, value } = filingSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                error: "Invalid input data", 
                details: error.details.map(d => d.message) 
            });
        }

        const payload = {
            filings: [{
                state: value.state.toUpperCase(),
                entity_type: value.entityType,
                client_email: value.email,
                client_phone: value.phone,
                entity_name: value.companyName,
                address1: value.address1,
                city: value.city,
                state_code: value.state.toUpperCase(),
                zip: value.zip,
                country: "US"
            }]
        };

        const authString = Buffer.from(`${NW_API_KEY}:${NW_API_SECRET}`).toString('base64');

        const response = await axios.post(NW_BASE_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authString}`,
                'User-Agent': 'Wix-NW-Bridge/1.0'
            },
            timeout: 10000
        });

        res.status(200).json({ 
            success: true, 
            message: "Filing request submitted successfully.",
            data: response.data
        });

    } catch (error) {
        console.error('API Error:', error.message);
        const statusCode = error.response?.status || 500;
        res.status(statusCode).json({ 
            success: false, 
            error: "Failed to submit filing. Please try again or contact support." 
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 NW-Wix Bridge running on port ${PORT}`);
    console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
});

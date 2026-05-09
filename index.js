require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');

const app = express();
const PORT = process.env.PORT || 3000;

// --- SECURITY CONFIGURATION ---

// 1. Helmet: Sets various HTTP headers to secure the app
app.use(helmet());

// 2. CORS: Restrict access to your Wix domain only (Update 'YOUR_WIX_DOMAIN' later)
// For now, we allow all origins but log a warning. In production, replace '*' with your domain.
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. Rate Limiting: Prevent abuse (100 requests per 15 mins per IP)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, 
    message: { success: false, error: "Too many requests, please try again later." }
});
app.use('/api', limiter);

app.use(express.json());

// --- CONFIGURATION ---
const NW_API_KEY = process.env.NW_API_KEY;
const NW_API_SECRET = process.env.NW_API_SECRET;
const NW_BASE_URL = 'https://api.northwestregisteredagent.com/v1/filings';

// Validate environment variables immediately
if (!NW_API_KEY || !NW_API_SECRET) {
    console.error('CRITICAL ERROR: Missing NW_API_KEY or NW_API_SECRET in environment variables.');
    process.exit(1);
}

// --- INPUT VALIDATION SCHEMA (Joi) ---
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

// --- ENDPOINTS ---

// Health Check (Useful for Render monitoring)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main Filing Endpoint
app.post('/api', async (req, res) => {
    try {
        const { state, entityType, email, phone, companyName, address1, city, zip } = req.body;

        // 1. Validate Input
        const { error, value } = filingSchema.validate({ state, entityType, email, phone, companyName, address1, city, zip });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                error: "Invalid input data", 
                details: error.details.map(d => d.message) 
            });
        }

        // 2. Prepare Payload
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

        // 3. Create Auth Header
        const authString = Buffer.from(`${NW_API_KEY}:${NW_API_SECRET}`).toString('base64');

        // 4. Call Northwest API
        const response = await axios.post(NW_BASE_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authString}`,
                'User-Agent': 'Wix-NW-Bridge/1.0'
            },
            timeout: 10000 // 10 second timeout
        });

        // 5. Return Success (White-labeled)
        res.status(200).json({ 
            success: true, 
            message: "Filing request submitted successfully.",
            data: response.data // You can strip specific NW fields here if you want to hide their internal IDs
        });

    } catch (error) {
        // Log the error for debugging (Render logs will capture this)
        console.error('API Error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });

        // Return a generic error to the client (don't leak internal NW errors)
        const statusCode = error.response?.status || 500;
        const errorMessage = error.response?.data?.message || "Internal server error during filing submission.";

        res.status(statusCode).json({ 
            success: false, 
            error: errorMessage 
        });
    }
});

// --- SERVER STARTUP ---
app.listen(PORT, () => {
    console.log(`🚀 NW-Wix Bridge is running on port ${PORT}`);
    console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
});

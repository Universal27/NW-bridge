require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');

const app = express();
const PORT = process.env.PORT || 3000;

// ====================== SECURITY ======================
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['https://www.universallawadvisors.com', 'https://universallawadvisors.com'];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting
app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
}));

// ====================== CONFIG ======================
const BRIDGE_API_KEY = process.env.RENDER_BRIDGE_KEY;
const NW_API_KEY = process.env.NW_API_KEY;
const NW_API_SECRET = process.env.NW_API_SECRET;
const NW_BASE_URL = 'https://api.northwestregisteredagent.com/v1';

if (!BRIDGE_API_KEY || !NW_API_KEY || !NW_API_SECRET) {
    console.error('❌ Missing critical environment variables!');
    process.exit(1);
}

// Auth Middleware
const authenticateBridge = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token !== BRIDGE_API_KEY) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    next();
};

// ====================== ROUTES ======================
app.get('/health', (req, res) => res.json({ status: 'ok', version: '2.0' }));

// Main Filing Endpoint (supports LLC, Corp, Registered Agent, etc.)
app.post('/api/filing', authenticateBridge, async (req, res) => {
    try {
        const schema = Joi.object({
            productType: Joi.string().valid('LLC', 'Corp', 'RegisteredAgent', 'S-Corp').default('LLC'),
            state: Joi.string().length(2).uppercase().required(),
            entityName: Joi.string().min(3).required(),
            email: Joi.string().email().required(),
            phone: Joi.string().required(),
            address1: Joi.string().required(),
            city: Joi.string().required(),
            zip: Joi.string().required(),
            // Future fields
            // owners, ein, etc.
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, error: error.details[0].message });
        }

        const payload = {
            filings: [{
                state: value.state,
                entity_type: value.productType === 'RegisteredAgent' ? 'RegisteredAgent' : value.productType,
                entity_name: value.entityName,
                client_email: value.email,
                client_phone: value.phone,
                address1: value.address1,
                city: value.city,
                state_code: value.state,
                zip: value.zip,
                country: "US"
            }]
        };

        const authString = Buffer.from(`${NW_API_KEY}:${NW_API_SECRET}`).toString('base64');

        const nwResponse = await axios.post(`${NW_BASE_URL}/filings`, payload, {
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json',
                'User-Agent': 'UniversalLawAdvisors-Bridge/2.0'
            },
            timeout: 15000
        });

        res.json({
            success: true,
            message: "Order submitted successfully to Northwest",
            orderId: nwResponse.data?.order_id || null,
            data: nwResponse.data
        });

    } catch (error) {
        console.error('Northwest API Error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: "Failed to submit order. Please try again or contact support."
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Northwest Bridge v2.0 running on port ${PORT}`);
});

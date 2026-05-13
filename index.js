require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['https://www.universallawadvisors.com'];

app.use(cors({
    origin: allowedOrigins,
    methods: ['POST', 'GET', 'OPTIONS']
}));

app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
}));

// Config
const BRIDGE_API_KEY = process.env.RENDER_BRIDGE_KEY;
const NW_API_KEY = process.env.NW_API_KEY;
const NW_API_SECRET = process.env.NW_API_SECRET;

if (!BRIDGE_API_KEY || !NW_API_KEY || !NW_API_SECRET) {
    console.error('❌ Missing environment variables!');
    process.exit(1);
}

// Auth Middleware
app.use('/api', (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token !== BRIDGE_API_KEY) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    next();
});

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '2.2' });
});

// Main Endpoint
app.post('/api/filing', async (req, res) => {
    try {
        const schema = Joi.object({
            state: Joi.string().length(2).uppercase().required(),
            productType: Joi.string().default('LLC'),
            entityName: Joi.string().min(3).required(),
            email: Joi.string().email().required(),
            phone: Joi.string().required(),
            address1: Joi.string().required(),
            city: Joi.string().required(),
            zip: Joi.string().required(),
        });

        const { error, value } = schema.validate(req.body);
        if (error) return res.status(400).json({ success: false, error: error.details[0].message });

        const payload = {
            filings: [{
                state: value.state,
                entity_type: value.productType,
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

        const nwResponse = await axios.post('https://api.northwestregisteredagent.com/v1/filings', payload, {
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({ success: true, data: nwResponse.data });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Failed to submit to Northwest" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Bridge v2.2 running on port ${PORT}`);
});

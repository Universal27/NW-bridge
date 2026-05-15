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

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true
}));

// Rate limiting
app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
}));

const BRIDGE_API_KEY = process.env.RENDER_BRIDGE_KEY;

// Auth
app.use('/api', (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token !== BRIDGE_API_KEY) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    next();
});

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '2.5' });
});

// Main Filing Endpoint
app.post('/api/filing', async (req, res) => {
    try {
        const { state, productType = "LLC", entityName, email, phone, address1, city, zip } = req.body;

        if (!state || !entityName || !email) {
            return res.status(400).json({ success: false, error: "Missing required fields" });
        }

        const payload = {
            filings: [{
                state: state.toUpperCase(),
                entity_type: productType,
                entity_name: entityName,
                client_email: email,
                client_phone: phone,
                address1: address1,
                city: city,
                state_code: state.toUpperCase(),
                zip: zip,
                country: "US"
            }]
        };

        const authString = Buffer.from(`${process.env.NW_API_KEY}:${process.env.NW_API_SECRET}`).toString('base64');

        const nwResponse = await axios.post('https://api.northwestregisteredagent.com/v1/filings', payload, {
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        res.json({ success: true, data: nwResponse.data });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Failed to submit order" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Railway Bridge v2.5 running on port ${PORT}`);
});

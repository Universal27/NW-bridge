require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];

app.use(cors({
    origin: allowedOrigins,
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use('/api', rateLimit({ windowMs: 15*60*1000, max: 100 }));

app.use(express.json());

const BRIDGE_API_KEY = process.env.RENDER_BRIDGE_KEY;
const NW_API_KEY = process.env.NW_API_KEY;
const NW_API_SECRET = process.env.NW_API_SECRET;
const NW_BASE_URL = 'https://api.northwestregisteredagent.com/v1';

// Auth Middleware
app.use('/api', (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token !== BRIDGE_API_KEY) return res.status(401).json({success: false, error: "Unauthorized"});
    next();
});

// Health
app.get('/health', (req, res) => res.json({status: 'ok'}));

// === MAIN FILING ENDPOINT (expandable) ===
app.post('/api/filing', async (req, res) => {
    try {
        const schema = Joi.object({
            state: Joi.string().length(2).required(),
            entityType: Joi.string().valid('LLC','Corp','S-Corp').default('LLC'),
            // ... add more fields later
        });

        const { error, value } = schema.validate(req.body);
        if (error) return res.status(400).json({success: false, error: error.details[0].message});

        const payload = { filings: [{ ...value }] };   // adjust as needed

        const auth = Buffer.from(`${NW_API_KEY}:${NW_API_SECRET}`).toString('base64');

        const nwResponse = await axios.post(`${NW_BASE_URL}/filings`, payload, {
            headers: { 'Authorization': `Basic ${auth}` }
        });

        res.json({success: true, data: nwResponse.data});
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({success: false, error: "Filing failed"});
    }
});

app.listen(PORT, () => console.log(`Bridge running on ${PORT}`));

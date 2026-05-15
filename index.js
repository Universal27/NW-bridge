require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(express.json());

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true
}));

const BRIDGE_API_KEY = process.env.RENDER_BRIDGE_KEY;

app.use('/api', (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token !== BRIDGE_API_KEY) {
        console.log("❌ Unauthorized attempt");
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    next();
});

app.get('/health', (req, res) => res.json({ status: 'ok', version: '2.3' }));

app.post('/api/filing', async (req, res) => {
    console.log("📥 Received request from Wix:", req.body);

    try {
        if (!req.body.state) {
            return res.status(400).json({ success: false, error: "state is required" });
        }

        const payload = {
            filings: [{
                state: req.body.state.toUpperCase(),
                entity_type: req.body.productType || "LLC",
                entity_name: req.body.entityName,
                client_email: req.body.email,
                client_phone: req.body.phone,
                address1: req.body.address1,
                city: req.body.city,
                state_code: req.body.state.toUpperCase(),
                zip: req.body.zip,
                country: "US"
            }]
        };

        const authString = Buffer.from(`${process.env.NW_API_KEY}:${process.env.NW_API_SECRET}`).toString('base64');

        console.log("Sending to Northwest...");

        const nwResponse = await axios.post('https://api.northwestregisteredagent.com/v1/filings', payload, {
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
            }
        });

        console.log("✅ Northwest Success");
        res.json({ success: true, data: nwResponse.data });

    } catch (error) {
        console.error("💥 ERROR:", error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: error.response?.data?.message || error.message 
        });
    }
});

app.listen(PORT, () => console.log(`🚀 Bridge v2.3 running`));

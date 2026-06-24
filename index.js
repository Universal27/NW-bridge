require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(express.json());

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true
}));

// Use BRIDGE_KEY - make sure this matches Railway exactly
const BRIDGE_API_KEY = process.env.BRIDGE_KEY;

app.use('/api', (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token !== BRIDGE_API_KEY) {
        console.log("❌ Unauthorized. Received:", token ? token.substring(0,15) : "none");
        console.log("Expected key length:", BRIDGE_API_KEY ? BRIDGE_API_KEY.length : 0);
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    next();
});

app.get('/health', (req, res) => res.json({ status: 'ok', version: 'final-fix' }));

app.post('/api/filing', async (req, res) => {
    try {
        const payload = {
            filings: [{
                state: (req.body.state || "DE").toUpperCase(),
                entity_type: req.body.productType || "LLC",
                entity_name: req.body.entityName,
                client_email: req.body.email,
                client_phone: req.body.phone,
                address1: req.body.address1,
                city: req.body.city,
                state_code: (req.body.state || "DE").toUpperCase(),
                zip: req.body.zip,
                country: "US"
            }]
        };

        const authString = Buffer.from(`${process.env.NW_API_KEY}:${process.env.NW_API_SECRET}`).toString('base64');

        const nwResponse = await axios.post('https://api.corporatetools.com/v1/filings', payload, {
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({ success: true, data: nwResponse.data });

    } catch (error) {
        console.error("Northwest Error:", error.message);
        res.status(500).json({ success: false, error: "Failed to submit" });
    }
});

app.listen(PORT, () => console.log(`🚀 Railway Bridge Final Fix Running`));

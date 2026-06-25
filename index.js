require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(express.json());

app.use(cors({ origin: true }));   // Allow all for testing

app.get('/health', (req, res) => res.json({ status: 'ok', version: 'no-auth-debug' }));

app.post('/api/filing', async (req, res) => {
    console.log("=== REQUEST RECEIVED FROM WIX ===");
    console.log("Body:", req.body);

    try {
        const payload = {
            filings: [{
                state: (req.body.state || "DE").toUpperCase(),
                entity_type: req.body.productType || "LLC",
                entity_name: req.body.entityName || "Test LLC",
                client_email: req.body.email,
                client_phone: req.body.phone,
                address1: req.body.address1,
                city: req.body.city,
                state_code: (req.body.state || "DE").toUpperCase(),
                zip: req.body.zip,
                country: "US"
            }]
        };

        console.log("Payload to Northwest:", payload);

        const authString = Buffer.from(`${process.env.NW_API_KEY}:${process.env.NW_API_SECRET}`).toString('base64');

        const nwResponse = await axios.post('https://api.corporatetools.com/v1/filings', payload, {
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
            }
        });

        console.log("✅ Northwest Success!");
        res.json({ success: true, data: nwResponse.data });

    } catch (error) {
        console.error("💥 Northwest Failed:", error.message);
        if (error.response) console.error("Response Data:", error.response.data);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 NO-AUTH DEBUG BRIDGE RUNNING`));

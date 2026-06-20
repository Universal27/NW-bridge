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
    origin: true
}));

app.get('/health', (req, res) => res.json({ status: 'ok', version: 'debug-2' }));

app.post('/api/filing', async (req, res) => {
    console.log("=== FULL REQUEST FROM WIX ===");
    console.log("Body:", req.body);
    console.log("NW_API_KEY exists:", !!process.env.NW_API_KEY);
    console.log("NW_API_SECRET exists:", !!process.env.NW_API_SECRET);

    try {
        const payload = {
            filings: [{
                state: (req.body.state || "DE").toUpperCase(),
                entity_type: req.body.productType || "LLC",
                entity_name: req.body.entityName || "Test LLC",
                client_email: req.body.email || "test@universallawadvisors.com",
                client_phone: req.body.phone || "3025551234",
                address1: req.body.address1 || "123 Test St",
                city: req.body.city || "Wilmington",
                state_code: (req.body.state || "DE").toUpperCase(),
                zip: req.body.zip || "19801",
                country: "US"
            }]
        };

        console.log("Payload being sent to NW:", JSON.stringify(payload, null, 2));

        const authString = Buffer.from(`${process.env.NW_API_KEY}:${process.env.NW_API_SECRET}`).toString('base64');

        const nwResponse = await axios.post('https://api.northwestregisteredagent.com/v1/filings', payload, {
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
            },
            timeout: 20000
        });

        console.log("✅ Northwest responded successfully");
        res.json({ success: true, data: nwResponse.data });

    } catch (error) {
        console.error("💥 CRITICAL ERROR:", {
            message: error.message,
            code: error.code,
            responseData: error.response?.data,
            status: error.response?.status
        });

        res.status(500).json({ 
            success: false, 
            error: error.message || "Failed to submit to Northwest" 
        });
    }
});

app.listen(PORT, () => console.log(`🚀 Debug Bridge v2 running`));

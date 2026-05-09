require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS so Wix can talk to this server
app.use(cors());
app.use(express.json());

// Configuration (These come from Render Environment Variables)
const NW_API_KEY = process.env.NW_API_KEY;
const NW_API_SECRET = process.env.NW_API_SECRET;
const NW_BASE_URL = 'https://api.northwestregisteredagent.com/v1/filings';

// The endpoint Wix will call
app.post('/api', async (req, res) => {
    try {
        // 1. Create Basic Auth Header (Required by Northwest)
        const authString = Buffer.from(`${NW_API_KEY}:${NW_API_SECRET}`).toString('base64');
        
        // 2. Prepare the Payload (Matches Northwest Schema)
        const { state, entityType, email, phone, companyName, address1, city, zip } = req.body;
        
        const payload = {
            filings: [{
                state: state.toUpperCase(),
                entity_type: entityType || "LLC",
                client_email: email,
                client_phone: phone,
                entity_name: companyName,
                address1: address1 || "",
                city: city || "",
                state_code: state.toUpperCase(),
                zip: zip || "",
                country: "US"
            }]
        };

        // 3. Call Northwest API
        const response = await axios.post(NW_BASE_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authString}`
            }
        });

        // 4. Send Success back to Wix
        res.status(200).json({ success: true, data: response.data });

    } catch (error) {
        console.error('Northwest API Error:', error.response?.data || error.message);
        // Send Error back to Wix
        res.status(500).json({ 
            success: false, 
            error: error.response?.data || error.message 
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Bridge running on port ${PORT}`);
});

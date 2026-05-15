require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => res.json({ status: 'ok', version: '2.4' }));

// Test Northwest connectivity
app.get('/test-nw', async (req, res) => {
    try {
        const response = await axios.get('https://api.northwestregisteredagent.com', { timeout: 8000 });
        res.json({ success: true, message: "Can reach Northwest" });
    } catch (err) {
        res.json({ 
            success: false, 
            message: err.message,
            code: err.code 
        });
    }
});

app.listen(PORT, () => console.log(`v2.4 running`));

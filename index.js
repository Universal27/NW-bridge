require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', async (req, res) => {
    try {
        const test = await axios.get('https://api.northwestregisteredagent.com/v1/filings', { timeout: 10000 });
        res.json({ status: 'ok', northwest_reachable: true });
    } catch (e) {
        res.json({ 
            status: 'ok', 
            northwest_reachable: false, 
            error: e.message 
        });
    }
});

app.listen(PORT, () => console.log(`Diagnostic running`));

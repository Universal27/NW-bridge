require('dotenv').config();

console.log("=== RENDER ENVIRONMENT DEBUG ===");
console.log("NW_API_KEY exists:", !!process.env.NW_API_KEY);
console.log("NW_API_SECRET exists:", !!process.env.NW_API_SECRET);
console.log("RENDER_BRIDGE_KEY exists:", !!process.env.RENDER_BRIDGE_KEY);
console.log("ALLOWED_ORIGINS:", process.env.ALLOWED_ORIGINS || "NOT SET");

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
    res.json({
        status: "ok",
        message: "Diagnostic version running",
        env: {
            NW_API_KEY: !!process.env.NW_API_KEY,
            NW_API_SECRET: !!process.env.NW_API_SECRET,
            RENDER_BRIDGE_KEY: !!process.env.RENDER_BRIDGE_KEY
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Diagnostic server running on port ${PORT}`);
});

const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Intentional security issues for testing JFrog SAST

// ISSUE 1: Hardcoded secret (SAST should detect this)
const SECRET_KEY = "hardcoded-secret-key-123";

// ISSUE 2: SQL Injection vulnerability pattern
app.get('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    // Simulated SQL query - vulnerable to injection
    const query = `SELECT * FROM users WHERE id = ${userId}`;
    console.log('Executing query:', query);
    res.json({ message: 'User data', query: query });
});

// ISSUE 3: Command Injection vulnerability
app.post('/api/ping', (req, res) => {
    const { host } = req.body;
    // Dangerous: executing user input directly
    const exec = require('child_process').exec;
    exec(`ping -c 4 ${host}`, (error, stdout, stderr) => {
        res.json({ output: stdout, error: stderr });
    });
});

// ISSUE 4: Weak JWT token generation
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // Weak token generation with hardcoded secret
    const token = jwt.sign({ username }, SECRET_KEY, { 
        algorithm: 'HS256',
        expiresIn: '1h'
    });
    res.json({ token });
});

// ISSUE 5: Insecure direct object reference
app.get('/api/file/:filename', (req, res) => {
    const { filename } = req.params;
    // Path traversal vulnerability
    const filePath = `./uploads/${filename}`;
    res.sendFile(filePath);
});

// ISSUE 6: Using vulnerable version of packages (package.json)
// - express 4.17.1 has known vulnerabilities
// - lodash 4.17.19 has known vulnerabilities
// - axios 0.21.1 has known vulnerabilities

// ISSUE 7: Eval usage (code injection risk)
app.post('/api/calculate', (req, res) => {
    const { expression } = req.body;
    try {
        const result = eval(expression);
        res.json({ result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ISSUE 8: No input validation
app.post('/api/data', (req, res) => {
    const data = req.body;
    // No validation - accepts any data
    console.log('Received data:', data);
    res.json({ success: true, data });
});

// ISSUE 9: Information disclosure
app.get('/api/debug', (req, res) => {
    res.json({
        env: process.env,
        config: {
            secret: SECRET_KEY,
            database: "mongodb://admin:password123@localhost:27017"
        }
    });
});

// Health check endpoint (safe)
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Home route
app.get('/', (req, res) => {
    res.json({
        message: 'JFrog Security Test Application',
        version: '1.0.0',
        endpoints: [
            'GET /health - Health check',
            'GET /api/user/:id - Get user (SQL injection test)',
            'POST /api/ping - Ping host (command injection test)',
            'POST /api/login - Login (weak JWT test)',
            'GET /api/file/:filename - Get file (path traversal test)',
            'POST /api/calculate - Calculate expression (eval test)',
            'POST /api/data - Submit data (no validation test)',
            'GET /api/debug - Debug info (information disclosure test)'
        ]
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: err.message,
        stack: err.stack  // ISSUE 10: Exposing stack traces
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

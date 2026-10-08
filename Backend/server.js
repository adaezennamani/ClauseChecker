require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
const path = require('path');

// Serve static files from the Frontend folder
app.use(express.static(path.join(__dirname, '../Frontend'), { index: false }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'login.html'));
});


// Explicit route for Sign In page
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'login.html'));
});

// Explicit route for Sign Up page
app.get('/signup.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'signup.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'index.html'));
});

// Explicit route for Forgot Password page
app.get('/forgot-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'forgot-password.html'));
});

const db = require('./db');

db.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Successfully connected to Supabase PostgreSQL at:', res.rows[0].now);
    }
});

//Setting up Middleware
app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    next();
});
app.use(cors()); //Allows our frontend talk to our backend
app.use(express.json()); //Allows the server to understand JSON data
// Make sure this is added near your other app.use() statements in server.js
app.use(express.json()); // Parses JSON bodies (for Postman)
app.use(express.urlencoded({ extended: true })); // <-- ADD THIS LINE to parse HTML form bodies!

//Import Routes
const apiRoutes = require('./routes/api')
app.use('/api', apiRoutes);

//Basic Health Check Route
app.get('/', (req, res) => {
    res.send('Legal Document Analyzer API is running.');
});

//Global Error Handler (catches errors like file size limits)
app.use((err, req, res, next) => {
    if (err) {
        res.status(400).json({ error: err.message });
    }
});

//Start the Server
app.listen(PORT, () => {
    console.log(`Server is actively running on http://localhost:${PORT}`)
})
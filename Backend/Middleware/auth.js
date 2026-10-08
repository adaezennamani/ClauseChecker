const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    //Get the token from the request headers
    // Tokens are usually sent in the format: "Bearer [your_token_string]"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    //If there is no token, block the request
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No authentication token provided.' });
    }

    try {
        //Verify the token using the same secret key from your login route
        const secretKey = process.env.JWT_SECRET || 'super_secret_development_key';
        const verified = jwt.verify(token, secretKey);

        //Attach the decoded user data to the request object so future routes can use it
        req.user = verified;

        //Move on to the actual route handler (like /api/analyze)
        next();
    } catch (error) {
        // If the token is fake, altered, or expired, block the request
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

module.exports = authenticateToken;
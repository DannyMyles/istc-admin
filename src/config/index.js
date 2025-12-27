module.exports = {
    // JWT Configuration
    jwt: {
        secret: process.env.JWT_SECRET_KEY,
        accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
        refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
        resetPasswordExpiration: process.env.JWT_RESET_PASSWORD_EXPIRATION || '15m'
    },

    // Database Configuration
    database: {
        uri: process.env.MONGODB_URI,
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        }
    },

    // Server Configuration
    server: {
        port: process.env.PORT || 5000,
        environment: process.env.NODE_ENV || 'development',
        corsOrigin: process.env.CORS_ORIGIN || '*'
    },

    // Rate Limiting Configuration
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100
    },

    // File Upload Configuration
    upload: {
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/jpg']
    },

    // Security Configuration
    security: {
        bcryptRounds: 10,
        passwordMinLength: 6
    }
};
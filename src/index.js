const express = require("express");
const app = express();
const connectDB = require("./db/connect");
require("dotenv").config();
const cors = require('cors');
const morgan = require('morgan');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const blogRoutes = require('./routes/blogRoutes');
const { errorHandler } = require('./middleware/index');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const seedRoles = require('./utils/seedRoles');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(helmet());

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Routes
app.get('/', (req, res) => {
    res.json({ 
        message: 'Application up and Running!',
        version: '1.0.0',
        endpoints: {
            auth: '/api/v1/auth',
            users: '/api/v1/users',
            roles: '/api/v1/roles',

        }
    });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', userRoutes);
app.use('/api/v1/blogs', blogRoutes);


// Error handling middleware (should be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path,
        method: req.method
    });
});

const port = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        await seedRoles();
        app.listen(port, () => {
            console.log(`✅ Server running on Port: ${port}`);
            console.log(`📁 Uploads directory: ${uploadDir}`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error("❌ Error connecting to database:", error);
        process.exit(1);
    }
};

startServer();
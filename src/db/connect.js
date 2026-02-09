const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME || 'istc_db',
    process.env.DB_USER || 'admin@muhadi',
    process.env.DB_PASS || '',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            timestamps: true,
            underscored: true,
            freezeTableName: true
        }
    }
);

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ MySQL Database Connected Successfully!');
        
        // Sync models (use { alter: true } in development to update schema)
        const syncOption = process.env.NODE_ENV === 'development' ? { alter: true } : false;
        if (syncOption) {
            await sequelize.sync(syncOption);
            console.log('✅ Database models synchronized');
        }
        
        return sequelize;
    } catch (error) {
        console.log('❌ Error connecting to Database!', error.message);
        throw error;
    }
};

module.exports = { connectDB, sequelize };


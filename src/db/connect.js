const mongoose = require('mongoose')
require('dotenv').config()

const connectDB = async () =>{
    try {
        await mongoose.connect(process.env.DB_URL)
        console.log("Db Coinnected Successfully!")
    } catch (error) {
        console.log("Error connecting to DB!", error)
    }
}

module.exports = connectDB
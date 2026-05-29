const mongoose = require('mongoose')

const connectToDB = async() => {
    try{
        await mongoose.connect(process.env.MONGO_URI)
        console.log('✅ Connected to Mongo DB successfully')
    }catch(error){
        console.error('❌ Unable to connect to mongo DB:', error.message)
        console.error('Full error:', error)
    }
}

module.exports = connectToDB
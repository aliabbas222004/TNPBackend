const mongoose = require('mongoose');
const mongoURI=process.env.MongoURI

const connectToMongo = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
};

module.exports = connectToMongo;
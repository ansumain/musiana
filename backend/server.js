require('dotenv').config();
const express = require('express');
const connectToDB = require('./database/db')
const userRoutes = require('./routes/userRoutes')
const uploadRoutes = require('./routes/uploadRoutes')
const fetchRoutes = require('./routes/fetchRoutes')

const app = express();
const PORT = 3000;

app.use(express.json())

connectToDB();

app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/fetch', fetchRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})
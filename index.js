require('dotenv').config()
const connectToMongo=require('./dbSetUp');
const express=require('express');
const app=express()
const cors =require('cors');
const port=process.env.PORT

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use("/student",require('./routes/student'));
app.use("/company",require('./routes/company'));
app.use("/admin",require('./routes/admin'));

app.get("/",(req,res)=>{
    res.send("Hello")
})

app.listen(port,()=>{
    console.log("App running on port : ",port)
})

connectToMongo();
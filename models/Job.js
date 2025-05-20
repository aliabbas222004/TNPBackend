const mongoose = require('mongoose');
const { Schema } = mongoose;

const jobSchema = new Schema({
    jobTitle: {
        type: String,
        required: true
    },
    jobDescription: {
        type: String,
        required: true
    },
    skills: {
        type: String,
        required: true
    },
    education: {
        college: {
            type: Number,
            required: true
        },
        std12_or_diploma: {
            type: Number,
            required: true
        },
        std10: {
            type: Number,
            required: true
        }
    },
    workLocation:{
        type:String,
        required:true
    },
    workDays:{
        type:String,
        required:true
    },
    workTime:{
        type:String,
        required:true
    },
    workMode:{
        type:String,
        required:true
    },
    workModel:{
        type:String,
        required:true
    },
    CTC:{
        type:String,
        required:true
    },
    department:{
        type:String,
        required:true
    },
    bond:{
        type:String,
    },
    lastDateForApplication:{
        type:Date,
        required:true,
    }

});

const Job = mongoose.model('job', jobSchema);
module.exports = Job;
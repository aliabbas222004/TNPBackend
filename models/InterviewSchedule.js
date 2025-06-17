const mongoose = require('mongoose');
const { Schema } = mongoose;

const interviewScheduleSchema = new Schema({
    jobId: {
        type: String
    },
    prn: {
        type: String,
    },
    scheduledAt: {
        type: Date
    },
    code:{
        type:String,
    }

})

const Interview = mongoose.model('interviewSchedule', interviewScheduleSchema);
module.exports = Interview;
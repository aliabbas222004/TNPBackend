const mongoose = require('mongoose');
const { Schema } = mongoose;

const studentDataSchema = new Schema({
    prn:{
        type:String,
        required:true
    },
    education: {
        college: {
            cmks: {
                type: Number,
                required: true
            },
            cimage: {
                type: String,
                required: true
            }
        },
        std12_or_diploma: {
            mks12: {
                type: Number,
                required: true
            },
            image12: {
                type: String,
                required: true
            }
        },
        std10: {
            mks10: {
                type: Number,
                required: true
            },
            image10: {
                type: String,
                required: true
            }
        }
    },
    resume:{
        type:String,
    },
    status:{
        type:String,
        default:"Not selected"
    }
})

const StudentData=mongoose.model('studentData',studentDataSchema);
module.exports=StudentData;
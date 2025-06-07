const mongoose=require('mongoose');
const {Schema}=mongoose;
const selectedStudentSchema = new Schema({
    jobId:{
        type:String,
        required:true,
    },
    companyId:{
        type:String,
    },
    prn:{
        type:String,
        required:true,
    },
    timeStamp:{
        type:Date,
        default:Date.now
    }
});

const SelectedStudent=mongoose.model('selectedStudent',selectedStudentSchema);
module.exports=SelectedStudent;
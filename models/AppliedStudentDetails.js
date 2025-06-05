const mongoose=require('mongoose');
const {Schema}=mongoose;

const AppliedStudentDetailsSchema=new Schema({
    prn:{
        type:String,
        required:true,
    },
    email:{
        type:String,
        required:true,
    },
    jobId:{
        type:String,
        required:true,
    },
    resume:{
        type:String,
    },
    status:{
        type:String,
        default:"Processing"
    }
});

const AppliedStudentDetails=mongoose.model('appliedStudentDetails',AppliedStudentDetailsSchema);
module.exports=AppliedStudentDetails;
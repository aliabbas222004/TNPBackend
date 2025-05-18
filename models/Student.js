const mongoose=require('mongoose');
const {Schema}=mongoose;
const studentSchema = new Schema({
    prn:{
        type:String,
        required:true,
        unique:true
    },
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true,
    },
    password:{
        type:String,
        required:true
    },
    profilePhoto:{
        type:String
    },
    phone:{
        type:String,
        match: /^[0-9]{10}$/,
    },
    address:{
        type:String,
    },
    timeStamp:{
        type:Date,
        default:Date.now
    }
});

const Student=mongoose.model('student',studentSchema);
module.exports=Student;
const mongoose=require('mongoose');
const {Schema}=mongoose;

const companySchema=new Schema({
    companyId:{
        type:String,
    },
    companyName:{
        type:String,
    },
    password:{
        type:String,
    },
    hasAdded:{
        type:Boolean,
        default:false,
    },
    companyProfile:{
        type:String,
    },
    description:{
        type:String,
    },
    timeStamp:{
        type:Date,
        default:Date.now
    }
})

const Company=mongoose.model('company',companySchema);
module.exports=Company;
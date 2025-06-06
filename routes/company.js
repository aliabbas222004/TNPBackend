const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { upload } = require('../config/cloudinary');
const Job = require('../models/Job');
const AppliedStudentDetails = require('../models/AppliedStudentDetails');
const Student = require('../models/Student');
const StudentData = require('../models/StudentData');
const JWT_SECRET = process.env.JWT_SECRET;



router.post('/logIn', async (req, res) => {
  try {
    const company = await Company.findOne({ companyId: req.body.companyId });
    if (!company) {
      return res.status(400).json({ error: "Invalid credentials", success: false });
    }
    const passwordCompare = await bcrypt.compare(req.body.password, company.password);
    if (!passwordCompare) {
      return res.status(400).json({ error: "Invalid credentials", success: false });
    }
    else {
      const data = {
        company: {
          id: company.id
        }
      }
      const companyToken = jwt.sign(data, JWT_SECRET);
      res.json({ companyToken, hasAdded: company.hasAdded })
    }
  }
  catch (e) {
    console.log(e);
    res.status(500).send("Something went wrong");
  }
});

router.get('/companyData', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      return res.status(401).json({ error: 'Token missing or malformed', success: false });
    }

    const token = authHeader;
    console.log('Company token:', token);

    const decoded = jwt.verify(token, JWT_SECRET);
    const companyId = decoded.company?.id;

    if (!companyId) {
      return res.status(400).json({ error: 'Invalid token payload', success: false });
    }

    const company = await Company.findById(companyId).select('-password').lean();

    if (!company) {
      return res.status(404).json({ error: 'Company not found', success: false });
    }

    console.log('Company data:', company);

    res.status(200).json({ company, success: true });
  } catch (error) {
    console.error('Error fetching company data:', error);
    res.status(500).json({ error: 'Server error', success: false });
  }
});

router.post('/addInformation', upload.single('profilePhoto'), async (req, res) => {
  try {
    const company = await Company.findOne({ companyId: req.body.companyId });
    if (!company) {
      return res.status(404).json({ message: 'Company not found', success: false });
    }
    
    const imageLink = req.file?.path || ''; 

    company.companyProfile = imageLink;
    company.description = req.body.description;
    company.companyName = req.body.companyName;
    company.hasAdded = true;
    await company.save();
    
    res.status(200).json({ message: 'Information added successfully', success: true });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


router.post('/addJob', async (req, res) => {
  const {
    jobTitle,
    jobDescription,
    skills,
    education,
    workLocation,
    workDays,
    workTime,
    workMode,
    workModel,
    CTC,
    department,
    bond,
    lastDateForApplication,
    companyId,
  } = req.body;

  // Basic validation
  try {
    if (!jobTitle || !jobTitle.trim()) {
      return res.status(400).json({ message: 'Job title is required', success: false });
    }
    if (!jobDescription || !jobDescription.trim()) {
      return res.status(400).json({ message: 'Job description is required', success: false });
    }
    if (!skills || !skills.trim()) {
      return res.status(400).json({ message: 'At least one skill is required', success: false });
    }
    if (!workLocation || !workLocation.trim()) {
      return res.status(400).json({ message: 'Work location is required', success: false });
    }
    if (!workDays || !workDays.trim()) {
      return res.status(400).json({ message: 'Work days are required', success: false });
    }
    if (!workTime || !workTime.trim()) {
      return res.status(400).json({ message: 'Work time is required', success: false });
    }
    if (!workMode || !workMode.trim()) {
      return res.status(400).json({ message: 'Work mode is required', success: false });
    }
    if (!workModel || !workModel.trim()) {
      return res.status(400).json({ message: 'Work model is required', success: false });
    }
    if (!CTC || !CTC.trim()) {
      return res.status(400).json({ message: 'CTC is required', success: false });
    }
    if (!department || !department.trim()) {
      return res.status(400).json({ message: 'Department is required', success: false });
    }
    if (!bond || !bond.trim()) {
      return res.status(400).json({ message: 'Bond information is required', success: false });
    }
    if (!lastDateForApplication) {
      return res.status(400).json({ message: 'Last date for application is required', success: false });
    }
    if (!companyId || !companyId.trim()) {
      return res.status(400).json({ message: 'Company ID is required', success: false });
    }
    // Validate education fields if provided
    if (education) {
      if (
        education.college &&
        (isNaN(education.college) || education.college < 0 || education.college > 100)
      ) {
        return res
          .status(400)
          .json({ message: 'College percentage must be between 0 and 100', success: false });
      }
      if (
        education.std12_or_diploma &&
        (isNaN(education.std12_or_diploma) ||
          education.std12_or_diploma < 0 ||
          education.std12_or_diploma > 100)
      ) {
        return res
          .status(400)
          .json({ message: '12th/Diploma percentage must be between 0 and 100', success: false });
      }
      if (education.std10 && (isNaN(education.std10) || education.std10 < 0 || education.std10 > 100)) {
        return res
          .status(400)
          .json({ message: '10th percentage must be between 0 and 100', success: false });
      }
    }

    await Job.create({
      jobTitle,
      companyId,
      jobDescription,
      skills,
      education,
      workLocation,
      workDays,
      workTime,
      workMode,
      workModel,
      CTC,
      department,
      bond,
      lastDateForApplication,
    });

    return res.status(200).json({ message: 'Job created successfully!', success: true });
  } catch (error) {
    console.error('Error creating job:', error);
    return res.status(500).json({ message: 'Server error while creating job', success: false });
  }
});

router.get('/getCreatedJobs',async (req,res)=>{
  const jobs=await Job.find({companyId:req.query.companyId});
  return res.json(jobs);
})

router.get('/interestedStudents', async (req, res) => {
  const currDate = Date.now();
  const job = await Job.findOne({ _id: req.query.jobId });
  if (currDate < job.lastDateForApplication) {
    return res.json({ error: 'The application has not yet closed. Try after the closing date', success: false });
  }

  const allStudents = await AppliedStudentDetails.find({ jobId: req.query.jobId });
  const studentIds = allStudents.map(app => app.prn);

  const allStudentDetails = await Student.find({ prn: { $in: studentIds } });

  const allStudentData = await StudentData.find({ prn: { $in: studentIds } });

  const studentDataMap = {};
  allStudentData.forEach(data => {
    studentDataMap[data.prn] = data;
  });

  const combined = allStudentDetails.map(stud => {
    return {
      ...stud.toObject(),
      additionalData: studentDataMap[stud.prn] || null
    };
  });

  return res.json(combined);
})


router.get('/selectStudents', async (req, res) => {
  const currDate = Date.now();
  const job = await Job.findOne({ _id: req.body.jobId });
  if (currDate < job.lastDateForApplication) {
    return res.json({ error: 'The application has not yet closed. Try after the closing date', success: false });
  }

  const allStudents = await AppliedStudentDetails.find({ jobId: req.body.jobId });
  const studentIds = allStudents.map(app => app.prn);

  const allStudentData = await StudentData.find({
    prn: { $in: studentIds },
    status: { $ne: 'Selected' }
  });
  const filteredPrns = allStudentData.map(data => data.prn);

  const allStudentDetails = await Student.find({ prn: { $in: filteredPrns } });

  const studentDataMap = {};
  allStudentData.forEach(data => {
    studentDataMap[data.prn] = data;
  });

  const combined = allStudentDetails.map(stud => {
    return {
      ...stud.toObject(),
      additionalData: studentDataMap[stud.prn] || null
    };
  });

  return res.json(combined);

})


router.post('/offerSelectedStudents', async (req, res) => {
  const jobId = req.body.jobId;
  const selectedStudents = req.body.prnS;

  try {
    await AppliedStudentDetails.updateMany(
      { jobId: jobId, prn: { $in: selectedStudents } },
      { $set: { status: 'Selected' } }
    );

    await StudentData.updateMany(
      { prn: { $in: selectedStudents } },
      { $set: { status: 'Selected' } }
    )

    await AppliedStudentDetails.updateMany(
      { jobId: jobId, prn: { $nin: selectedStudents } },
      { $set: { status: 'Not selected' } }
    );

    return res.json({ message: "Students have been selected", success: true })

  } catch (error) {
    res.status(500).json({ error: 'Internal server error', success: false });
  }
});

module.exports = router;                                                              
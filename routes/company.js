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
const SelectedStudent = require('../models/SelectedStudents');
const Interview = require('../models/InterviewSchedule');
const JWT_SECRET = process.env.JWT_SECRET;
const nodemailer = require('nodemailer');

require('dotenv').config();

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

router.get('/getCreatedJobs', async (req, res) => {
  const companyId = req.query.companyId;
  const selectedJobEntries = await SelectedStudent.find().select('jobId -_id');
  const selectedJobIds = selectedJobEntries.map(entry => entry.jobId.toString());

  const jobs = await Job.find({
    companyId,
    _id: { $nin: selectedJobIds }
  });
  return res.json(jobs);
})

router.get('/allocatedJobs', async (req, res) => {
  const companyId = req.query.companyId;
  const selectedJobEntries = await SelectedStudent.find().select('jobId -_id');
  const selectedJobIds = selectedJobEntries.map(entry => entry.jobId.toString());

  const jobs = await Job.find({
    companyId,
    _id: { $in: selectedJobIds }
  });
  return res.json(jobs);
})




router.get('/getAllCreatedJobs', async (req, res) => {
  const jobs = await Job.find({ companyId: req.query.companyId });
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


router.post('/selectStudents', async (req, res) => {
  const { jobId, selectedPRNs } = req.body;
  await StudentData.updateMany(
    { prn: { $in: selectedPRNs } },
    { $set: { 'status': 'placed' } }
  );

  await AppliedStudentDetails.updateMany(
    { prn: { $in: selectedPRNs }, jobId: jobId },
    { $set: { 'status': 'Selected' } }
  );

  await AppliedStudentDetails.updateMany(
    { prn: { $nin: selectedPRNs }, jobId: jobId },
    { $set: { 'status': 'Not selected' } }
  );

  const job = await Job.findOne({ _id: jobId }).select('companyId').lean();
  const companyId = job.companyId;
  for (const prn of selectedPRNs) {
    const newEntry = new SelectedStudent({
      prn,
      jobId,
      companyId
    });

    await newEntry.save();
  }

  return res.json({ message: "Students selected successfully!", success: true });

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


router.get('/selectedStudents', async (req, res) => {
  try {
    const jobId = req.query.jobId;

    const selected = await SelectedStudent.find({ jobId });
    const prns = selected.map(s => s.prn);

    const primaryDetails = await Student.find({ prn: { $in: prns } }).select('-password -hasAdded').lean();
    const additionalDetails = await StudentData.find({ prn: { $in: prns } }).lean();

    const studentDataMap = {};
    additionalDetails.forEach(data => {
      studentDataMap[data.prn] = data;
    });

    const mergedStudents = primaryDetails.map(student => ({
      ...student,
      additionalData: studentDataMap[student.prn] || null
    }));

    return res.json(mergedStudents);
  } catch (error) {
    console.error('Error fetching selected students:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});




router.get('/rejectedStudents', async (req, res) => {
  try {
    const jobId = req.query.jobId;

    const selected = await SelectedStudent.find({ jobId });
    const selectedPRNs = selected.map(s => s.prn);

    const applied = await AppliedStudentDetails.find({ jobId }).select('prn');
    const appliedPRNs = applied.map(a => a.prn);

    const rejectedPRNs = appliedPRNs.filter(prn => !selectedPRNs.includes(prn));

    const primaryDetails = await Student.find({ prn: { $in: rejectedPRNs } }).select('-password -hasAdded').lean();
    const additionalDetails = await StudentData.find({ prn: { $in: rejectedPRNs } }).lean();

    const studentDataMap = {};
    additionalDetails.forEach(data => {
      studentDataMap[data.prn] = data;
    });

    const mergedStudents = primaryDetails.map(student => ({
      ...student,
      additionalData: studentDataMap[student.prn] || null
    }));

    return res.json(mergedStudents);
  } catch (error) {
    console.error('Error fetching rejected students:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});



router.get('/getJobsForInterview', async (req, res) => {
  const companyId = req.query.companyId;

  const selectedJobs = await SelectedStudent.find({}, 'jobId');
  const selectedJobIds = [...new Set(selectedJobs.map(s => s.jobId.toString()))];

  const scheduledJobs = await Interview.find({}, 'jobId');
  const scheduledJobIds = [...new Set(scheduledJobs.map(s => s.jobId.toString()))];

  const jobs = await Job.find({
    companyId,
    _id: { $nin: [...selectedJobIds, ...scheduledJobIds] },
    lastDateForApplication: { $lt: new Date() }
  });

  return res.json(jobs);
})


const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

router.post('/scheduleInterview', async (req, res) => {
  const { jobId, prnS } = req.body; // prnS is now an array of objects with prn and scheduledAt
  const job = await Job.findById(jobId);

  try {
    if (!Array.isArray(prnS) || prnS.length === 0) {
      return res.status(400).json({ error: 'No students selected', success: false });
    }

    // Save interview schedules to the database
    const interviewData = prnS.map((student) => ({
      jobId,
      prn: student.prn,
      scheduledAt: new Date(student.scheduledAt),
      code: student.code
    }));

    await Interview.insertMany(interviewData);

    // Fetch student details for sending emails
    const prns = prnS.map((s) => s.prn);
    const students = await Student.find({ prn: { $in: prns } });

    // Send emails to each student
    for (let student of students) {
      try {
        const matchedInterview = prnS.find((s) => s.prn === student.prn);
        const interviewDate = new Date(matchedInterview.scheduledAt);
        const dateStr = interviewDate.toLocaleDateString();
        const timeStr = interviewDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        console.log(`Preparing to send email to: ${student.email}`);

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: student.email,
          subject: `Interview Scheduled for ${job.title}`,
          html: `
                        <div style="font-family: 'Segoe UI', sans-serif; background-color: #f9f9f9; padding: 20px; border-radius: 10px;">
                            <h2 style="color: #2c3e50;">📢 Interview Invitation - ${job.title}</h2>
                            <p>Dear <strong>${student.name}</strong>,</p>
                            <p>You have been shortlisted for the interview for the position of <strong>${job.title}</strong>.</p>
                            <p><strong>Date:</strong> ${dateStr}<br/><strong>Time:</strong> ${timeStr}</p>
                            <p>Kindly be available 10 minutes before your scheduled time.</p>
                            <p>Best of luck!<br/>T&P Cell</p>
                            <hr/>
                            <small style="color: #777;">If you have questions, reply to this email.</small>
                        </div>
                    `,
        };

        console.log("Sending email...");
        await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${student.email}`);
      } catch (err) {
        console.error(`❌ Failed to send email to ${student.email}:`, err.message);
      }
    }

    res.status(201).json({ message: 'Interviews scheduled successfully', success: true });
  } catch (error) {
    console.error('Error scheduling interviews:', error);
    res.status(500).json({ error: 'Internal server error', success: false });
  }
});

router.get('/scheduledJobs', async (req, res) => {
  const companyId = req.query.companyId;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // zero out time

  try {
    const futureJobIdsAgg = await Interview.aggregate([
      {
        $match: {
          scheduledAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: "$jobId"
        }
      }
    ]);

    const futureJobIds = futureJobIdsAgg.map(entry => entry._id.toString());

    const jobs = await Job.find({
      companyId,
      _id: { $in: futureJobIds }
    });

    return res.json(jobs);
  } catch (err) {
    console.error("Error in /scheduledJobs:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});




router.get('/studentsSelectedForInterview', async (req, res) => {
  const jobId = req.query.jobId;

  const interviews = await Interview.find({ jobId });

  const enrichedStudents = await Promise.all(
    interviews.map(async (interview) => {
      const prn = interview.prn;

      const basicDetails = await Student.findOne({ prn }).select('-password -_id -timeStamp -hasAdded'); // exclude sensitive info
      const educationDetails = await StudentData.findOne({ prn }).select('-_id -resume -prn -status');
      const appliedDetails = await AppliedStudentDetails.findOne({ prn, jobId });

      return {
        ...interview.toObject(),
        basicDetails,
        educationDetails,
        resume: appliedDetails?.resume || null,
      };
    })
  );
  res.json(enrichedStudents);
});

router.get('/pastScheduledJobs', async (req, res) => {
  const companyId = req.query.companyId;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Midnight today

  try {
    const pastJobIdsAgg = await Interview.aggregate([
      {
        $group: {
          _id: "$jobId",
          allPast: {
            $max: {
              $cond: [{ $gte: ["$scheduledAt", today] }, false, true]
            }
          }
        }
      },
      {
        $match: { allPast: true }
      }
    ]);

    const pastJobIds = pastJobIdsAgg.map(entry => entry._id.toString());

    const jobs = await Job.find({
      companyId,
      _id: { $in: pastJobIds }
    });

    return res.json(jobs);
  } catch (err) {
    console.error("Error in /pastScheduledJobs:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});




module.exports = router;                                                              
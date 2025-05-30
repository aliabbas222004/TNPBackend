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

router.post('/addInformation', upload.array('companyProfile', 1), async (req, res) => {
    try {
        const company = await Company.findOne({ companyId: req.body.companyId });
        if (!company) {
            return res.status(404).json({ message: 'Company not found', success: false });
        }

        const imageLink = req.files?.[0]?.path || '';

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
    const { jobTitle, jobDescription, skills, education, workLocation, workDays, workTime, workMode, workModel, CTC, department, bond, lastDateForApplication,companyId } = req.body;

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
        lastDateForApplication
    });

    return res.status(200).json({ message: "Job created successfully!", suceess: true });
})

router.get('/interestedStudents', async (req, res) => {
    const currDate = Date.now();
    const job = await Job.findOne({ _id: req.body.jobId });
    if (currDate < job.lastDateForApplication) {
        return res.json({ error: 'The application has not yet closed. Try after the closing date', success: false });
    }

    const allStudents = await AppliedStudentDetails.find({ jobId: req.body.jobId });
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

        return res.json({message:"Students have been selected",success:true})

    } catch (error) {
        res.status(500).json({ error: 'Internal server error',success:false });
    }
});

module.exports = router;                                                              
const express = require('express');
const Company = require('../models/Company');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { upload } = require('../config/cloudinary');
const Student = require('../models/Student');
const StudentData = require('../models/StudentData');
const SelectedStudent = require('../models/SelectedStudents');
const JWT_SECRET = process.env.JWT_SECRET;

router.post('/logIn', async (req, res) => {
    const salt = await bcrypt.genSalt(10);
    const safepass = await bcrypt.hash("Aliabbas", salt);
    const isSame = await bcrypt.compare(req.body.password, safepass);
    if (!isSame) {
        return res.status(400).json({ error: "Invalid credentials", success: false });
    }
    const data = {
        admin: {
            id: "abcdefg"
        }
    }
    const adminToken = jwt.sign(data, JWT_SECRET);
    return res.status(200).json({ adminToken, message: "Login successfull", sucess: true });

});


router.post('/addCompany', async (req, res) => {
    try {
        const company = await Company.findOne({ companyId: req.body.companyId });
        if (company) {
            return res.status(400).json({ error: "Company with this ID already exists", success: false });
        }
        const salt = await bcrypt.genSalt(10);
        const safePass = await bcrypt.hash(req.body.password, salt);

        await Company.create({
            companyId: req.body.companyId,
            password: safePass,
            timeStamp: req.body.timeStamp || Date.now()
        });

        return res.status(200).json({ message: "Company created successfully", success: true });
    } catch (error) {
        return res.status(500).json({ error: "Server error", success: false });
    }
});



router.get('/analytics', async (req, res) => {
    try {
        const currentYear = new Date().getFullYear(); // 2025
        //  console.log('Current Year:', currentYear);

        // Debug: Fetch all documents to check timestamp format
        const allStudents = await SelectedStudent.find().lean();
        //  console.log('All Students:', allStudents);

        // Query with correct field name 'timeStamp'
        const selectedStudents = await SelectedStudent.find({
            timeStamp: {
                $gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
                $lte: new Date(`${currentYear}-12-31T23:59:59.999Z`)
            }
        }).lean();
        // console.log('Filtered Students:', selectedStudents);

        const prns = selectedStudents.map(student => student.prn);
        const studentData = await StudentData.find({ prn: { $in: prns }, status: "placed" }).lean();

        const departmentCounts = studentData.reduce((acc, data) => {
            const dept = data.department;
            if (dept) acc[dept] = (acc[dept] || 0) + 1;
            return acc;
        }, { CSE: 0, ME: 0, EE: 0, TE: 0 });

        return res.status(200).json({ success: true, data: departmentCounts });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: "Server error", success: false });
    }
});


router.get('/allStudents', async (req, res) => {
    try {
        const priDetails = await Student.find().select('-password -hasAdded').lean();

        const addDetails = await StudentData.find().lean();

        const addMap = {};
        for (const data of addDetails) {
            addMap[data.prn] = data;
        }

        const mergedStudents = priDetails.map(student => ({
            ...student,
            additionalData: addMap[student.prn] || null
        }));

        return res.json(mergedStudents);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
    }
});


router.get('/allCompanies', async (req, res) => {
    try {
        const comapnies = await Company.find({});
        return res.json(comapnies);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
    }
});


router.get('/pendingVerifications', async (req, res) => {
    try {
        const students = await Student.find({ hasVerified: false });

        const studentPRNs = students.map(student => student.prn);

        const studentDataList = await StudentData.find({ prn: { $in: studentPRNs } });

        const mergedData = students.map(student => {
            const data = studentDataList.find(sd => sd.prn === student.prn);
            return {
                ...student.toObject(),
                data: data || null
            };
        });

        res.status(200).json({ mergedData });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
    }
});


router.post('/verifyPRN', async (req, res) => {
    try {
        const prn = req.body.prn;
        await Student.findOneAndUpdate(
            { prn },
            { $set: { hasVerified: true } },
        );
        return res.status(200).json({ message: "Verified successfully", success: true });
    } catch (error) {
        return res.status(500).json({ error: "Server error", success: false });
    }
});



module.exports = router;
const express = require('express');
const Company = require('../models/Company');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { upload } = require('../config/cloudinary');
const Student = require('../models/Student');
const StudentData = require('../models/StudentData');
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

// router.post('/addCompany',upload.array('companyPhoto',1) , async (req, res) => {

//         console.log("Body:", req.body);
//         console.log("Files:", req.files);

//     try {
//         const company = await Company.findOne({ companyId: req.body.companyId });
//         if (company) {
//             return res.status(400).json({ error: "Company with this ID already exists", success: false });
//         }
//         const salt = await bcrypt.genSalt(10);
//         const safePass = await bcrypt.hash(req.body.password, salt);

//          let companyProfile = '';
//     if (req.files && req.files.length > 0) {
//       companyProfile = req.files[0].path; // Cloudinary URL of the uploaded file
//     }

//         await Company.create({
//         companyId: req.body.companyId,
//         companyName: req.body.companyName,
//         password: safePass,
//         hasAdded: req.body.hasAdded || false,
//         companyProfile: companyProfile,
//         description: req.body.description,
//         timeStamp: req.body.timeStamp || Date.now()
//     });

//     return res.status(200).json({ message: "Company created successfully", success: true });
//     } catch (error) {
//         return res.status(500).json({ error: "Server error", success: false });
//     }
// });


// Get all companies
// router.get('/companies', async (req, res) => {
//     try {
//         const companies = await Company.find();
//         return res.status(200).json({ companies, success: true });
//     } catch (error) {
//         return res.status(500).json({ error: "Server error", success: false });
//     }
// });

// // Get a specific company by companyId
// router.get('/company/:companyId', async (req, res) => {
//     try {
//         const company = await Company.findOne({ companyId: req.params.companyId });
//         if (!company) {
//             return res.status(404).json({ error: "Company not found", success: false });
//         }
//         return res.status(200).json({ company, success: true });
//     } catch (error) {
//         return res.status(500).json({ error: "Server error", success: false });
//     }
// });

// // Update a company by companyId
// router.put('/company/:companyId', async (req, res) => {
//     try {
//         const company = await Company.findOne({ companyId: req.params.companyId });
//         if (!company) {
//             return res.status(404).json({ error: "Company not found", success: false });
//         }

//         // Update fields if provided in the request body
//         if (req.body.companyName) company.companyName = req.body.companyName;
//         if (req.body.password) {
//             const salt = await bcrypt.genSalt(10);
//             company.password = await bcrypt.hash(req.body.password, salt);
//         }
//         if (req.body.hasAdded !== undefined) company.hasAdded = req.body.hasAdded;
//         if (req.body.companyProfile) company.companyProfile = req.body.companyProfile;
//         if (req.body.description) company.description = req.body.description;

//         await company.save();
//         return res.status(200).json({ message: "Company updated successfully", success: true });
//     } catch (error) {
//         return res.status(500).json({ error: "Server error", success: false });
//     }
// });

// // Delete a company by companyId
// router.delete('/company/:companyId', async (req, res) => {
//     try {
//         const company = await Company.findOneAndDelete({ companyId: req.params.companyId });
//         if (!company) {
//             return res.status(404).json({ error: "Company not found", success: false });
//         }
//         return res.status(200).json({ message: "Company deleted successfully", success: true });
//     } catch (error) {
//         return res.status(500).json({ error: "Server error", success: false });
//     }
// });


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
            additionalData : addMap[student.prn]  || null
        }));

        return res.json(mergedStudents);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
    }
});


router.get('/allCompanies', async (req, res) => {
    try {
        const comapnies=await Company.find({});
        return res.json(comapnies);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
    }
});

module.exports = router;
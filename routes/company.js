const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { upload } = require('../config/cloudinary');
const Job = require('../models/Job');
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
    const { jobTitle,jobDescription,skills,education,workLocation,workDays,workTime,workMode,workModel,CTC,department,bond,lastDateForApplication } = req.body;

    await Job.create({
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
        lastDateForApplication
    });

    return res.status(200).json({message:"Job created successfully!",suceess:true});
})

module.exports = router;                                                              
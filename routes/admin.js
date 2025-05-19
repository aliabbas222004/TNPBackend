const express = require('express');
const Company = require('../models/Company');
const router = express.Router();
const bcrypt=require('bcryptjs');

router.post('/addCompany', async (req, res) => {
    const company = await Company.findOne({ companyId: req.body.companyId });
    if (company) {
        return res.status(400).json({ error: "Company Id already taken", success: false });
    }
    const salt = await bcrypt.genSalt(10);
    const safePass = await bcrypt.hash(req.body.password, salt);
    await Company.create({
        companyId: req.body.companyId,
        password: safePass
    })

    return res.status(200).json({ message: "Company created successfully", success: true });
});

module.exports = router;
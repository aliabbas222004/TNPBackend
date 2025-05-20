const express = require('express');
const Company = require('../models/Company');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt=require('jsonwebtoken');
const JWT_SECRET=process.env.JWT_SECRET;

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
    return res.status(200).json({adminToken, message: "Login successfull", sucess: true });

});

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
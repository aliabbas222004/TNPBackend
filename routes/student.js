const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const signUpValidation = require('../middleware/signUpValidation');
const { upload } = require('../config/cloudinary');
const { validationResult }=require('express-validator');
const JWT_SECRET = process.env.JWT_SECRET;

router.post('/signUp',upload.array('profilePhoto', 1),signUpValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: "Invalid inputs", success: false });
    }

    try {
        let stud2 = await Student.findOne({ prn: req.body.prn });
        let stud1 = await Student.findOne({ email: req.body.email });
        if(stud2){
            return res.status(400).json({ error: "PRN already exists" ,success:false});
        }
        else if (stud1) {
            return res.status(400).json({ error: "Email already taken" });
        }

        const salt = await bcrypt.genSalt(10);
        const safePass = await bcrypt.hash(req.body.password, salt);
        const imageLink = req.files[0].path || '';
        const student = await Student.create({
            prn:req.body.prn,
            name: req.body.name,
            email: req.body.email,
            password: safePass,
            profilePhoto:imageLink,
            phone: req.body.phone,
            address: req.body.address,
        });

        const data = {
            student: {
                id: student.id
            }
        }
        const studentToken = jwt.sign(data, JWT_SECRET);
        res.json({ studentToken })

    } catch (err) {
        console.log(err);
        res.status(500).send("Something went wrong");
    }
})

router.post('/logIn', async (req, res) => {
    try {
        const stud = await Student.findOne({ prn: req.body.prn });
        if (!stud) {
            return res.status(400).json({ error: "Invalid credentials", success: false });
        }
        const passwordCompare = await bcrypt.compare(req.body.password, stud.password);
        if (!passwordCompare) {
            return res.status(400).json({ error: "Invalid credentials", success: false });
        }
        else {
            const data = {
                student: {
                    id: stud.id
                }
            }
            const studentToken = jwt.sign(data, JWT_SECRET);
            res.json({ studentToken })
        }
    }
    catch (e) {
        console.log(e);
        res.status(500).send("Something went wrong");
    }
});

module.exports = router;
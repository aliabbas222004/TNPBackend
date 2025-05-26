const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Student = require('../models/Student');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const signUpValidation = require('../middleware/signUpValidation');
const { upload } = require('../config/cloudinary');
const { validationResult } = require('express-validator');
const JWT_SECRET = process.env.JWT_SECRET;
const uploadDirect = multer({ storage: multer.memoryStorage() });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/signUp', upload.array('profilePhoto', 1), signUpValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: "Invalid inputs", success: false });
    }

    try {
        let stud2 = await Student.findOne({ prn: req.body.prn });
        let stud1 = await Student.findOne({ email: req.body.email });
        if (stud2) {
            return res.status(400).json({ error: "PRN already exists", success: false });
        }
        else if (stud1) {
            return res.status(400).json({ error: "Email already taken" });
        }

        const salt = await bcrypt.genSalt(10);
        const safePass = await bcrypt.hash(req.body.password, salt);
        const imageLink = req.files[0].path || '';
        const student = await Student.create({
            prn: req.body.prn,
            name: req.body.name,
            email: req.body.email,
            password: safePass,
            profilePhoto: imageLink,
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

router.post('/uploadDetails', uploadDirect.array('images', 3), async (req, res) => {
    try {
        const files = req.files;

        if (!files || files.length !== 3) {
            return res.status(400).json({ error: 'Please upload exactly 3 images (std10, std12, college)' });
        }

        const base64Images = files.map(file => ({
            inlineData: {
                data: file.buffer.toString('base64'),
                mimeType: file.mimetype
            }
        }));

        const prompt = `
You will be provided with three academic documents in order:
1. Class 10th marksheet
2. Class 12th marksheet
3. College marksheet

From these images, extract the following:
- Total percentage in Class 10
- Total percentage in Class 12
- CGPA in College

Provide the result in this JSON format:
{
  "std10_percentage": "XX.XX%",
  "std12_percentage": "YY.YY%",
  "college_cgpa": "Z.ZZ"
}
Only output the JSON. Do not include any explanation.
`;

        const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash' });

        const result = await model.generateContentStream({
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        ...base64Images
                    ]
                }
            ]
        });

        let text = '';
        for await (const chunk of result.stream) {
            const part = chunk.text();
            if (part) text += part;
        }

        try {
            const extracted = JSON.parse(text);
            return res.json(extracted);
        } catch (parseErr) {
            return res.json({ rawOutput: text }); // fallback if JSON format is imperfect
        }

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Something went wrong.', details: err.message });
    }
});


module.exports = router;
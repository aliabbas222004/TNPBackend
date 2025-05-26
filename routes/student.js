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
const { cloudinary } = require('../config/cloudinary');
const StudentData = require('../models/StudentData');

function uploadBufferToCloudinary(buffer, publicId) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: 'tnp_profile_images',
                public_id: publicId,
                resource_type: 'image',
                overwrite: true,
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );

        stream.end(buffer);
    });
}


function parsePercentage(str) {
    if (!str) return 0;
    return parseFloat(str.replace('%', '').trim());
}

function parseNumber(str) {
    if (!str) return 0;
    return parseFloat(str.trim());
}


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
            return res.status(400).json({ error: 'Please upload exactly 3 images: Class 10, Class 12 OR Diploma, and College marksheet.' });
        }

        const base64Images = files.map(file => ({
            inlineData: {
                data: file.buffer.toString('base64'),
                mimeType: file.mimetype
            }
        }));

        const prompt = `
You will be provided with three academic documents in the following order:
1. Class 10th marksheet
2. Class 12th OR Diploma marksheet
3. College marksheet

Extract the following:

1. For Class 10th marksheet:
   - Total marks might not be present; assume total marks = 600.
   - Extract obtained marks and calculate percentage.

2. For Class 12th marksheet:
   - Ignore the "theory total" field which is used only for grading.
   - Use the fields named "total marks" and "obtained marks".
   - Calculate the percentage as (obtained marks / total marks) * 100.

3. For Diploma marksheet (if provided instead of Class 12th):
   - Extract SGPA or CGPA.

4. For College marksheet:
   - Extract CGPA.

Return the results strictly in this JSON format:
{
  "std10_percentage": "XX.XX%",
  "std12_or_diploma": "YY.YY%",
  "college_cgpa": "Z.ZZ"
}

Only respond with clean JSON. Do not include any explanation or markdown.
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
            const cleanText = text
                .replace(/```json\s*([\s\S]*?)\s*```/, '$1')
                .replace(/```\s*([\s\S]*?)\s*```/, '$1')
                .trim();

            const extracted = JSON.parse(cleanText);
            const uploadResults = await Promise.all(
                files.map((file, idx) =>
                    uploadBufferToCloudinary(file.buffer, `tnp_profile_images/upload_${Date.now()}_${idx}`)
                )
            );

            await StudentData.create({
                education: {
                    college: {
                        cmks: parseNumber(extracted.college_cgpa),  // e.g. "9.23" -> 9.23
                        cimage: uploadResults[2].secure_url          // college image
                    },
                    std12_or_diploma: {
                        mks12: parsePercentage(extracted.std12_or_diploma), // e.g. "98.33%" -> 98.33
                        image12: uploadResults[1].secure_url,               // std12/diploma image
                    },
                    std10: {
                        mks10: parsePercentage(extracted.std10_percentage), // e.g. "52.29%" -> 52.29
                        image10: uploadResults[0].secure_url,               // std10 image
                    }
                }
            });


            return res.json({
                message: "Data saved successfully",
                success: true
            });
        } catch (parseErr) {
            console.error('Failed to parse JSON:', parseErr);
            return res.json({ rawOutput: text });
        }

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Something went wrong.', details: err.message });
    }
});


module.exports = router;
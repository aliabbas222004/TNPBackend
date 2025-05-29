const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Student = require('../models/Student');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const signUpValidation = require('../middleware/signUpValidation');
const { upload } = require('../config/cloudinary');
const { validationResult } = require('express-validator');
const JWT_SECRET = process.env.JWT_SECRET;
const uploadDirect = multer({ storage: multer.memoryStorage() });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const { cloudinary } = require('../config/cloudinary');
const StudentData = require('../models/StudentData');
const Job = require('../models/Job');
require('dotenv').config();
const AppliedStudentDetails = require('../models/AppliedStudentDetails');


const verificationCodes = {};
const pendingRegistrations = {};

// Configure nodemailer
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}


function uploadBufferToCloudinary(buffer, publicId, resourceType = 'image') {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: resourceType === 'image' ? 'tnp_profile_images' : 'tnp_resumes',
                public_id: publicId,
                resource_type: resourceType,
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


//SignUp for student

// router.post('/signUp', upload.array('profilePhoto', 1), signUpValidation, async (req, res) => {
//     console.log("Body:", req.body);
//      console.log("Files:", req.files);

//     const errors = validationResult(req);

//     console.log("Errors:", errors.array());
    
//     if (!errors.isEmpty()) {
//         return res.status(400).json({ error: "Invalid inputs", success: false });
//     }

//     try {
//         let stud2 = await Student.findOne({ prn: req.body.prn });
//         let stud1 = await Student.findOne({ email: req.body.email });
//         if (stud2) {
//             return res.status(400).json({ error: "PRN already exists", success: false });
//         }
//         else if (stud1) {
//             return res.status(400).json({ error: "Email already taken" });
//         }

//         console.log("started to save");

//         const salt = await bcrypt.genSalt(10);
//         const safePass = await bcrypt.hash(req.body.password, salt);
//         const imageLink = req.files[0].path || '';
//         console.log("Saving .......................");
//         const student = await Student.create({
//             prn: req.body.prn,
//             name: req.body.name,
//             email: req.body.email,
//             password: safePass,
//             profilePhoto: imageLink,
//             phone: req.body.phone,
//             address: req.body.address,
//         });

//         const data = {
//             student: {
//                 id: student.id
//             }
//         }
//         const studentToken = jwt.sign(data, JWT_SECRET);
//         res.json({ studentToken, message: "Student registered successfully", success: true });

//     } catch (err) {
//         console.log(err);
//         res.status(500).send("Something went wrong");
//     }
// })

router.post('/signUp', upload.array('profilePhoto', 1), signUpValidation, async (req, res) => {
  console.log("Body:", req.body);
  console.log("Files:", req.files);

  const errors = validationResult(req);
  console.log("Errors:", errors.array());

  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "Invalid inputs", success: false });
  }

  try {
    // Check for existing PRN or email
    const stud2 = await Student.findOne({ prn: req.body.prn });
    const stud1 = await Student.findOne({ email: req.body.email });
    if (stud2) {
      return res.status(400).json({ error: "PRN already exists", success: false });
    }
    if (stud1) {
      return res.status(400).json({ error: "Email already taken", success: false });
    }

    console.log("Started to save");

    // Upload profile photo to Cloudinary
    const imageLink = req.files[0].path || '';
    // if (imageLink) {
    //   const uploadedImage = await uploadBufferToCloudinary(
    //     req.files[0].buffer,
    //     `profile_${req.body.prn}_${Date.now()}`,
    //     'image'
    //   );
    //   imageLink = uploadedImage.secure_url;
    //   console.log("Image uploaded to Cloudinary:", imageLink);
    // }

    // Generate verification code
    const code = generateVerificationCode();
    console.log(`Generated verification code: ${code}`);
    const email = req.body.email;

    // Store user data and verification code temporarily
    pendingRegistrations[email] = {
      prn: req.body.prn,
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      phone: req.body.phone,
      address: req.body.address,
      profilePhoto: imageLink,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiration
    };
    verificationCodes[email] = {
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };

    // Send verification email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email Verification</h2>
          <p>Your verification code is: <strong>${code}</strong></p>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `,
    };

    console.log(`Verification code for ${email}: ${code}`);

    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${email}`);
      } else {
        console.log('Email not sent - no credentials provided. Using console for verification code.');
      }
      res.status(200).json({ message: 'Verification code sent to your email', success: true });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      res.status(200).json({
        message: 'Verification code generated but email delivery failed. Check console for code.',
        fallbackCode: code, // Remove in production
        success: true,
      });
    }
  } catch (err) {
    console.error('Error in sign-up process:', err);
    res.status(500).json({ error: 'Something went wrong', success: false });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Email and verification code are required', success: false });
    }

    const storedData = verificationCodes[email];
    const userData = pendingRegistrations[email];

    if (!storedData || !userData) {
      return res.status(400).json({ message: 'No verification code or user data found for this email', success: false });
    }

    if (new Date() > storedData.expiresAt) {
      delete verificationCodes[email];
      delete pendingRegistrations[email];
      return res.status(400).json({ message: 'Verification code has expired', success: false });
    }

    if (storedData.code !== code) {
      return res.status(400).json({ message: 'Invalid verification code', success: false });
    }

    // Proceed with saving user to database
    const salt = await bcrypt.genSalt(10);
    const safePass = await bcrypt.hash(userData.password, salt);
    const student = await Student.create({
      prn: userData.prn,
      name: userData.name,
      email: userData.email,
      password: safePass,
      profilePhoto: userData.profilePhoto,
      phone: userData.phone,
      address: userData.address,
    });

    const data = {
      student: {
        id: student.id,
      },
    };
    const studentToken = jwt.sign(data, JWT_SECRET);

    // Clean up
    delete verificationCodes[email];
    delete pendingRegistrations[email];

    res.status(200).json({ studentToken, message: 'Email verified and student registered successfully', success: true });
  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(500).json({ message: 'Failed to verify code', success: false });
  }
});


//Login for student

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


//Upload details only if the student hasn't uploaded yet

router.post('/uploadDetails', uploadDirect.fields([
    { name: 'images', maxCount: 3 },
    { name: 'resume', maxCount: 1 }
]), async (req, res) => {
    try {
        const files = req.files.images;
        const resumeFile = req.files.resume?.[0];
        let resumeUrl = null;

        if (resumeFile) {
            const uploadedResume = await uploadBufferToCloudinary(
                resumeFile.buffer,
                `resume_${Date.now()}`,
                'raw'
            );
            resumeUrl = uploadedResume.secure_url;
        }

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
   - Extract grand total of marks obtained, it might be present in words so convert it to number

2. For Class 12th marksheet:
- Look for the phrase "Total marks obtained in words" (or similar).
- Convert it to numeric form and extract it as "obtained_marks".
- Look for a phrase like "650 OBTAINED MARKS 524" or "TOTAL MARKS 650" to determine "total_marks". If not found, assume total_marks as 650.
- Ignore percentages like "PERCENTILE RANK-SCIENCE THEORY" and focus on overall obtained marks.
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
                    uploadBufferToCloudinary(
                        file.buffer,
                        `upload_${Date.now()}_${idx}`,
                        'image' // ✅ Explicitly uploading images
                    )
                )
            );

            await StudentData.create({
                prn: req.body.prn,
                education: {
                    college: {
                        cmks: parseNumber(extracted.college_cgpa),
                        cimage: uploadResults[2].secure_url
                    },
                    std12_or_diploma: {
                        mks12: parsePercentage(extracted.std12_or_diploma),
                        image12: uploadResults[1].secure_url,
                    },
                    std10: {
                        mks10: parsePercentage(extracted.std10_percentage),
                        image10: uploadResults[0].secure_url,
                    }
                },
                resume: resumeUrl
            });

            return res.json({
                message: "Data saved successfully",
                success: true,
                data: {
                    std10_percentage: extracted.std10_percentage,
                    std12_or_diploma: extracted.std12_or_diploma,
                    college_cgpa: extracted.college_cgpa,
                }
            });

        } catch (parseErr) {
            return res.json({ rawOutput: text });
        }

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Something went wrong.', details: err.message });
    }
});


//To get questions to prepare for interview

router.post('/getQuestionFromResume', async (req, res) => {
    const prompt = `
You will be provided with the resume link

Extract the data from the resume and give random 5 questions based on the resume data that can be asked in interview.

Return the results strictly in this JSON format:
{
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
})


//Apply for the job

router.post('/applyForJob', uploadDirect.single('resume'), async (req, res) => {
    try {
        const { prn, jobId } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "Resume file is required", success: false });
        }

        const uploadedResume = await uploadBufferToCloudinary(
            req.file.buffer,
            `resume_${prn}_${Date.now()}`,
            'raw'
        );

        const resumeUrl = uploadedResume.secure_url;

        await AppliedStudentDetails.create({
            prn,
            jobId,
            resume: resumeUrl
        });

        return res.status(200).json({
            message: "Applied successfully",
            success: true,
        });
    } catch (err) {
        return res.status(500).json({ message: "Server error", success: false });
    }
});



//Get all jobs that they have applied for for withdrawing purpose

router.get('/getAllAppliedJobs', async (req, res) => {
    try {
        const { prn } = req.body;
        const appliedJobs = await AppliedStudentDetails.find({ prn });
        const jobIds = appliedJobs.map(a => a.jobId);
        const currentDate = new Date();
        const jobDetails = await Job.find({
            _id: { $in: jobIds },
            lastDateForApplication: { $gt: currentDate }
        });
        const jobDetailsMap = jobDetails.reduce((acc, job) => {
            acc[job._id.toString()] = job;
            return acc;
        }, {});

        const mergedData = appliedJobs.map(application => ({
            ...application.toObject(),
            job: jobDetailsMap[application.jobId.toString()] || null
        }));

        return res.json(mergedData);
    }
    catch(e){
        return res.json({error:"Failed to retrive data",success:false});
    }

});


//Withdraw the application

router.post('/retrieveForm', async (req, res) => {
    try {
        await AppliedStudentDetails.deleteOne({ prn: req.body.prn, jobId: req.body.jobId });
        return res.json({ message: "Form withdrawn successfully", success: true });
    }
    catch (e) {
        return res.json({ error: "Error withdrawing the form", success: false })
    }
});



//Get all jobs that the student has applied for the main dashboard

router.get('/allApplications', async (req, res) => {
    try {
        const { prn } = req.body;
        const appliedJobs = await AppliedStudentDetails.find({ prn });
        if(!appliedJobs){
            return res.json({message:"You haven't applied for any jobs yet!"})
        }
        const jobIds = appliedJobs.map(a => a.jobId);
        const jobDetails = await Job.find({ _id: { $in: jobIds } });
        const jobDetailsMap = jobDetails.reduce((acc, job) => {
            acc[job._id.toString()] = job;
            return acc;
        }, {});

        const mergedData = appliedJobs.map(application => ({
            ...application.toObject(),
            job: jobDetailsMap[application.jobId.toString()] || null
        }));

        res.json(mergedData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});


module.exports = router;
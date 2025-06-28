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
const genAI2 = new GoogleGenerativeAI(process.env.GEMINI_API_KEY2);

const { cloudinary } = require('../config/cloudinary');
const StudentData = require('../models/StudentData');
const Job = require('../models/Job');
require('dotenv').config();
const AppliedStudentDetails = require('../models/AppliedStudentDetails');
const Company = require('../models/Company');
const Interview = require('../models/InterviewSchedule');


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


router.post('/signUp', upload.array('profilePhoto', 1), signUpValidation, async (req, res) => {


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
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verify Your Email Address',
            html: `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f4f4; padding: 30px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
      <div style="background-color: #ffffff; padding: 25px 30px; border-radius: 8px;">
        <h2 style="color: #2c3e50; font-size: 24px; margin-bottom: 10px; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">
          🎓 T&P Cell Email Verification
        </h2>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Hello,<br><br>
          Please use the following verification code to complete your registration:
        </p>
        <p style="font-size: 24px; font-weight: bold; color: #27ae60; margin: 20px 0; text-align: center;">
          ${code}
        </p>
        <p style="color: #555; font-size: 14px; text-align: center;">
          This code will expire in <strong>10 minutes</strong>.
        </p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          If you did not request this code, you can safely ignore this email.
        </p>
      </div>
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
        console.log("Saving student data...");
        const student = await Student.create({
            prn: userData.prn,
            name: userData.name,
            email: userData.email,
            password: safePass,
            profilePhoto: userData.profilePhoto,
            phone: userData.phone,
            address: userData.address,
            hasAdded:true
        });


        await StudentData.create({
            prn:userData.prn,
            department:userData.department, // Save department to database
            education: {
                college: {
                    cmks: userData.education.college.cmks,
                    cimage: userData.education.college.cimage
                },
                std12_or_diploma: {
                    mks12:userData.education.std12_or_diploma.mks12,
                    image12:userData.education.std12_or_diploma.image12,
                },
                std10: {
                    mks10: userData.education.std10.mks10,
                    image10: userData.education.std10.image10
                }
            },
            resume: userData.resume,
        });

        console.log("Student data saved successfully");

        const data = {
            student: {
                id: student.id,
                prn: student.prn
            },
        };
        const studentToken = jwt.sign(data, JWT_SECRET);

        console.log("Student token generated:", studentToken);
        // Clean up
        delete verificationCodes[email];
        delete pendingRegistrations[email];

        console.log("Verification done registration data cleared");

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
                    id: stud.id,
                    prn: stud.prn
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

// 
router.post('/updateProfile', uploadDirect.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'resume', maxCount: 1 }
]), async (req, res) => {
    try {
        const { name, resumeUrl, prn } = req.body;
        const profilePhotoFile = req.files['profilePhoto']?.[0];
        const resumeFile = req.files['resume']?.[0];

        let profilePhotoUrl = null;
        let finalResumeUrl = resumeUrl || null;

        if (profilePhotoFile) {
            const uploadedImage = await uploadBufferToCloudinary(
                profilePhotoFile.buffer,
                `profile_${prn}_${Date.now()}`,
                'image'
            );
            profilePhotoUrl = uploadedImage.secure_url;
        }

        if (resumeFile) {
            const uploadedResume = await uploadBufferToCloudinary(
                resumeFile.buffer,
                `resume_${prn}_${Date.now()}`,
                'raw'
            );
            finalResumeUrl = uploadedResume.secure_url;
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (profilePhotoUrl) updateData.profilePhoto = profilePhotoUrl;

        await Student.findOneAndUpdate({ prn }, updateData);
        if (finalResumeUrl) {
            await StudentData.findOneAndUpdate(
                { prn },
                { resume: finalResumeUrl },
                { upsert: true }
            );
        }

        res.status(200).json({ message: 'Profile updated successfully', success: true });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Server error', success: false });
    }
});



// Get student details

router.get('/studentData', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader  // "Bearer <token>"

        console.log("Token:", token);

        if (!token) {
            return res.status(401).json({ error: 'Token missing' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const prn = decoded.student?.prn;

        if (!prn) {
            return res.status(400).json({ error: 'Invalid token payload', success: false });
        }

        const priDetails = await Student.findOne({ prn }).select('-password').lean();
        const addDetails = await StudentData.findOne({ prn }).select('resume department education').lean();
        const appliedjobdetails = await AppliedStudentDetails.find({ prn }).select('jobId status').lean();
        const student = {
            ...priDetails,
            ...addDetails,
            appliedJobs: appliedjobdetails
        };
        if (!priDetails) {
            return res.status(404).json({ error: 'Student not found', success: false });
        }

        console.log("Student data:", student);

        res.status(200).json({ student, success: true });
    } catch (error) {
        console.error('Error fetching student data:', error);
        res.status(500).json({ error: 'Server error', success: false });
    }
});


//Upload details only if the student hasn't uploaded yet


router.post('/fetchMarks', uploadDirect.fields([
    { name: 'images', maxCount: 3 },
    { name: 'resume', maxCount: 1 }
]), async (req, res) => {
    try {
        const files = req.files.images;
        const resumeFile = req.files.resume?.[0];
        const { prn, department } = req.body; // Accept prn and department

        if (!files || files.length !== 3) {
            return res.status(400).json({
                error: 'Please upload exactly 3 images: Class 10, Class 12 OR Diploma, and College marksheet.'
            });
        }

        const base64Images = files.map(file => ({
            inlineData: {
                data: file.buffer.toString('base64'),
                mimeType: file.mimetype
            }
        }));

        const prompt = `
You will be provided with three academic documents in this order:
1. Class 10th marksheet
2. Class 12th OR Diploma marksheet
3. College marksheet

Extract the following details:

For Class 10th:
- Look for the phrase "GRAND TOTAL OF MARKS OBTAINED" (or similar, e.g., "Total Marks Obtained").
- Extract the number in words (e.g., "FOUR HUNDRED EIGHTY SIX") and convert it to numeric form as "obtained_marks".
- If total marks are explicitly mentioned (e.g., "486/600"), use that as "total_marks". Otherwise, assume total_marks as 600 (common for 6 subjects, 100 marks each).

For Class 12th:
- Look for the phrase "Total marks obtained in words" (or similar).
- Convert it to numeric form and extract it as "obtained_marks".
- Look for a phrase like "650 OBTAINED MARKS 524" or "TOTAL MARKS 650" to determine "total_marks". If not found, assume total_marks as 650.
- Ignore percentages like "PERCENTILE RANK-SCIENCE THEORY" and focus on overall obtained marks.

For Diploma (if instead of Class 12th):
- Extract SGPA or CGPA as "diploma_cgpa".

For College:
- Extract CGPA as "college_cgpa".

Return JSON ONLY in the following format:
{
  "std10_total_marks": 600,
  "std10_obtained_marks": 486,
  "std12_total_marks": 650,
  "std12_obtained_marks": 524,
  "diploma_cgpa": "8.4",
  "college_cgpa": "7.91"
}

If diploma is present, std12 fields can be null or omitted.
Do not add any explanation, markdown, or extra text.
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

        const cleanText = text
            .replace(/```json\s*([\s\S]*?)\s*```/, '$1')
            .replace(/```\s*([\s\S]*?)\s*```/, '$1')
            .replace(/\s*([\s\S]*?)\s*/, '$1')
            .trim();

        const extracted = JSON.parse(cleanText);

        // Backend logging for Class 10
        const std10_total = extracted.std10_total_marks || 600;
        const std10_obtained = extracted.std10_obtained_marks || 0;
        console.log('Class 10 Extraction:');
        console.log(`- Total Marks: ${std10_total}`);
        console.log(`- Obtained Marks: ${std10_obtained}`);
        const std10_percentage = ((std10_obtained / std10_total) * 100).toFixed(2);
        console.log(`- Percentage Calculation: (${std10_obtained} / ${std10_total}) * 100 = ${std10_percentage}%`);

        // Backend logging for Class 12
        const std12_total = extracted.std12_total_marks || 650;
        const std12_obtained = extracted.std12_obtained_marks || 0;
        console.log('Class 12 Extraction:');
        console.log(`- Total Marks: ${std12_total}`);
        console.log(`- Obtained Marks: ${std12_obtained}`);
        const std12_percentage = ((std12_obtained / std12_total) * 100).toFixed(2);
        console.log(`- Percentage Calculation: (${std12_obtained} / ${std12_total}) * 100 = ${std12_percentage}%`);

        const diploma_cgpa = extracted.diploma_cgpa || null;
        const college_cgpa = extracted.college_cgpa || null;

        // Prepare calculation steps for frontend
        const std10_calculation_steps = [
            `Total Marks: ${std10_total}`,
            `Obtained Marks: ${std10_obtained}`,
            `Percentage: (${std10_obtained} / ${std10_total}) * 100 = ${std10_percentage}%`
        ];

        const std12_calculation_steps = diploma_cgpa ? null : [
            `Total Marks: ${std12_total}`,
            `Obtained Marks: ${std12_obtained}`,
            `Percentage: (${std12_obtained} / ${std12_total}) * 100 = ${std12_percentage}%`
        ];

        console.log("Data extracted successfully:", extracted);

        return res.json({
            message: "Marks extracted successfully",
            success: true,
            data: {
                std10_percentage: `${std10_percentage}%`,
                std12_or_diploma: diploma_cgpa ? diploma_cgpa : `${std12_percentage}%`,
                college_cgpa: college_cgpa,
                std10_calculation_steps,
                std12_calculation_steps,
                department // Include department in response
            }
        });

    } catch (err) {
        console.error('Error:', err);
        return res.status(500).json({ error: 'Something went wrong.', details: err.message });
    }
});

// Route to upload files and save to database
router.post('/uploadDetails', uploadDirect.fields([
    { name: 'images', maxCount: 3 },
    { name: 'resume', maxCount: 1 }
]), async (req, res) => {
    try {
        const files = req.files.images;
        const resumeFile = req.files.resume?.[0];
        let resumeUrl = null;

        console.log("Files received:", files);
        console.log("Resume file received:", resumeFile);

        if (!files || files.length !== 3) {
            return res.status(400).json({
                error: 'Please upload exactly 3 images: Class 10, Class 12 OR Diploma, and College marksheet.'
            });
        }

        // Extract marks, PRN, and department from request body
        const {
            std10_percentage,
            std12_percentage,
            diploma_cgpa,
            college_cgpa,
            isManual = false,
            prn,
            department,
            email
        } = req.body;


        if (!std10_percentage || (!std12_percentage && !diploma_cgpa) || !college_cgpa || !prn) {
            return res.status(400).json({
                error: 'Missing required fields: marks data or PRN.'
            });
        }

        // Upload resume to Cloudinary if provided
        if (resumeFile) {
            const uploadedResume = await uploadBufferToCloudinary(
                resumeFile.buffer,
                `resume_${Date.now()}`,
                'raw'
            );
            resumeUrl = uploadedResume.secure_url;
        }

        // Upload images to Cloudinary
        const uploadResults = await Promise.all(
            files.map((file, idx) =>
                uploadBufferToCloudinary(
                    file.buffer,
                    `upload_${Date.now()}_${idx}`,
                    'image'
                )
            )
        );
        console.log("Hi there");

        let mks12 = null;

        if (diploma_cgpa && !isNaN(parseFloat(diploma_cgpa))) {
            mks12 = parseFloat(diploma_cgpa);
        } else if (std12_percentage && !isNaN(parseFloat(std12_percentage))) {
            mks12 = parseFloat(std12_percentage);
        } else {
            console.log( "Please provide either valid Diploma CGPA or 12th percentage." );
        }


        pendingRegistrations[email]={
            ...pendingRegistrations[email],
            department,
            education: {
                college: {
                    cmks: parseFloat(college_cgpa),
                    cimage: uploadResults[2].secure_url
                },
                std12_or_diploma: {
                    mks12,
                    image12: uploadResults[1].secure_url
                },
                std10: {
                    mks10: parseFloat(std10_percentage),
                    image10: uploadResults[0].secure_url
                }
            },
            resume: resumeUrl


        }

        console.log(pendingRegistrations[email]);

        // Save data to database
        // await StudentData.create({
        //     prn,
        //     department, // Save department to database
        //     education: {
        //         college: {
        //             cmks: parseFloat(college_cgpa),
        //             cimage: uploadResults[2].secure_url
        //         },
        //         std12_or_diploma: {
        //             mks12,
        //             image12: uploadResults[1].secure_url
        //         },
        //         std10: {
        //             mks10: parseFloat(std10_percentage),
        //             image10: uploadResults[0].secure_url
        //         }
        //     },
        //     resume: resumeUrl,
        //     status: isManual === 'true' || isManual === true ? 'To Be Verified' : 'Verified'
        // });


        console.log("Data uploaded and saved successfully");
        res.json({
            message: isManual ? "Data uploaded, pending verification" : "Data uploaded successfully",
            success: true,
            data: {
                std10_percentage: `${std10_percentage}%`,
                std12_or_diploma: diploma_cgpa || `${std12_percentage}%`,
                college_cgpa,
                resume_url: resumeUrl,
                isManual,
                prn,
                status: isManual ? 'To Be Verified' : 'Verified',
                department // Include department in response
            }
        });
    } catch (err) {
        console.error('Error:', err);
        return res.status(500).json({ error: 'Something went wrong.', details: err.message });
    }
});


router.get('/availableJobs', async (req, res) => {
    try {
        const { department } = req.query; // Get department from query parameters

        // Validate department parameter
        if (!department) {
            return res.status(400).json({
                message: 'Department is required',
                success: false,
            });
        }

        // Fetch jobs matching the department
        const jobs = await Job.find({ department: department }).lean();

        const companyIds = [...new Set(jobs.map(job => job.companyId))];
        const companies = await Company.find({ companyId: { $in: companyIds } })
            .select('companyId companyName companyProfile description')
            .lean();

        const companyMap = {};
        companies.forEach(company => {
            companyMap[company.companyId] = company;
        });

        const jobsWithCompanyDetails = jobs.map(job => ({
            ...job,
            companyDetails: companyMap[job.companyId] || null,
        }));

        console.log(jobsWithCompanyDetails);
        return res.status(200).json(jobsWithCompanyDetails);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        return res.status(500).json({
            message: 'Server error while fetching jobs',
            success: false,
        });
    }
});

//To get questions to prepare for interview

router.post('/getQuestionFromResume', async (req, res) => {
    try {
        const { resumeUrl, numQuestions } = req.body;

        if (!resumeUrl || !numQuestions || isNaN(numQuestions) || numQuestions < 1 || numQuestions > 10) {
            return res.status(400).json({
                error: 'Invalid input: resumeUrl is required, and numQuestions must be a number between 1 and 10.'
            });
        }

        const prompt = `
You are provided with a resume accessible via the following URL: ${resumeUrl}

Your task is to:
1. Extract key details from the resume, including:
   - Name
   - Education (degrees, institutions, years, and CGPA/percentage if available)
   - Work experience (job titles, companies, duration, and key responsibilities)
   - Skills (technical, soft, or domain-specific)
   - Projects (titles, descriptions, technologies used)
   - Certifications (names, issuing organizations, dates)
2. Based on the extracted data, generate ${numQuestions} relevant interview questions tailored to the candidate's background.
3. For each question, provide:
   - A concise, targeted question suitable for a technical or behavioral interview.
   - A brief sample answer (1–2 sentences) based on the resume data, reflecting what the candidate might say.

Return the results strictly in this JSON format:
{
  "questions": [
    {
      "question": "Question text here",
      "answer": "Sample answer based on resume data"
    },
    ...
  ]
}

Only respond with clean JSON. Do not include any explanation, markdown, or extra text.
`;

        const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash' });

        const result = await model.generateContentStream({
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt }
                    ]
                }
            ]
        });

        let text = '';
        for await (const chunk of result.stream) {
            const part = chunk.text();
            if (part) text += part;
        }

        const cleanText = text
            .replace(/```json\s*([\s\S]*?)\s*```/, '$1')
            .replace(/```\s*([\s\S]*?)\s*```/, '$1')
            .replace(/\s*([\s\S]*?)\s*/, '$1')
            .trim();

        const extracted = JSON.parse(cleanText);

        console.log("Generated questions:", extracted);

        return res.json({
            message: "Questions generated successfully",
            success: true,
            data: extracted
        });

    } catch (err) {
        console.error('Error:', err);
        return res.status(500).json({ error: 'Something went wrong.', details: err.message });
    }
});


//Apply for the job


router.post('/applyForJob', uploadDirect.fields([
    { name: 'resume', maxCount: 1 }
]), async (req, res) => {
    try {
        const { prn, email, jobId, resumeUrl } = req.body;
        const resumeFile = req.files?.resume?.[0];
        let finalResumeUrl = resumeUrl || '';

        if (!prn || !email || !jobId) {
            return res.status(400).json({ message: "PRN, Email, and Job ID are required", success: false });
        }

        if (resumeFile) {
            if (resumeFile.mimetype !== 'application/pdf' && resumeFile.mimetype !== 'image/jpeg') {
                return res.status(400).json({ message: "Resume must be a PDF or JPG file", success: false });
            }
            const resourceType = resumeFile.mimetype === 'image/jpeg' ? 'image' : 'raw';
            const uploadedResume = await uploadBufferToCloudinary(
                resumeFile.buffer,
                `resume_${prn}_${Date.now()}`,
                resourceType
            );
            finalResumeUrl = uploadedResume.secure_url;
        }

        const application = await AppliedStudentDetails.create({
            prn,
            email,
            jobId,
            resume: finalResumeUrl,
            status: "Processing"
        });

        return res.status(200).json({
            message: "Applied successfully",
            success: true,
            applicationId: application._id
        });
    } catch (err) {
        console.error('Error in /applyForJob:', err);
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
    catch (e) {
        return res.json({ error: "Failed to retrive data", success: false });
    }

});


//Withdraw the application

router.post('/retrieveApplication', async (req, res) => {
    try {
        const { prn, jobId } = req.body;

        // Validate required fields
        if (!prn || !jobId) {
            return res.status(400).json({ error: "PRN and Job ID are required", success: false });
        }

        // Delete the application
        const result = await AppliedStudentDetails.deleteOne({ prn, jobId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Application not found", success: false });
        }

        return res.status(200).json({ message: "Form withdrawn successfully", success: true });
    } catch (e) {
        console.error('Error withdrawing the form:', e);
        return res.status(500).json({ error: "Error withdrawing the form", success: false });
    }
});



//Get all jobs that the student has applied for the main dashboard

router.post('/allApplications', async (req, res) => {
    try {
        const { prn } = req.body;

        const appliedJobs = await AppliedStudentDetails.find({ prn });
        if (!appliedJobs || appliedJobs.length === 0) {
            return res.json({ message: "You haven't applied for any jobs yet!" });
        }

        const jobIds = appliedJobs.map(a => a.jobId);

        const jobDetails = await Job.find({ _id: { $in: jobIds } });

        const companyIds = [...new Set(jobDetails.map(job => job.companyId.toString()))];
        const companies = await Company.find({ companyId: { $in: companyIds } });

        const jobMap = new Map(jobDetails.map(job => [job._id.toString(), job]));
        const companyMap = new Map(companies.map(company => [company.companyId.toString(), company]));

        const mergedData = appliedJobs.map(application => {
            const job = jobMap.get(application.jobId.toString());
            const company = job ? companyMap.get(job.companyId.toString()) : null;

            return {
                ...application.toObject(),
                job: job || null,
                company: company || null,
            };
        });

        res.json(mergedData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});


router.get('/getJobs', async (req, res) => {
    try {
        const prn = req.query.prn;
        const appliedJobs = await AppliedStudentDetails.find({ prn });

        const detailedJobs = await Promise.all(
            appliedJobs.map(async (app) => {
                const job = await Job.findById(app.jobId);
                if (!job) return null;

                const company = await Company.findOne({ companyId: job.companyId });
                if (!company) return null;

                return {
                    ...app._doc,              // data from AppliedStudentDetails
                    jobDetails: job,          // entire Job doc
                    companyDetails: company,  // entire Company doc
                };
            })
        );
        res.json({ success: true, jobs: detailedJobs });
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


router.get('/getApplicationDetails', async (req, res) => {
    try {
        const prn = req.query.prn;
        const jobId = req.query.jobId;
        const appliedJob = await AppliedStudentDetails.findOne({ prn, jobId });
        const studentPersonalDetails = await Student.findOne({ prn });
        const studentEducationalDetails = await StudentData.findOne({ prn });

        const mergedStudentDetails = {
            prn,
            ...studentPersonalDetails.toObject(),
            ...studentEducationalDetails.toObject(),
            ...appliedJob.toObject(),
            resume: appliedJob.resume
        };

        delete mergedStudentDetails.prn;
        delete mergedStudentDetails.resume;
        mergedStudentDetails.prn = prn;
        mergedStudentDetails.resume = appliedJob.resume;

        res.json({ success: true, details: mergedStudentDetails });
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/scheduledJobs', async (req, res) => {
    try {
        const prn = req.query.prn;
        if (!prn) return res.status(400).json({ message: 'PRN is required' });

        const now = new Date();


        // 1 day before now
        const oneDayAgo = new Date(now);
        oneDayAgo.setDate(now.getDate() - 1);

        const interviews = await Interview.find({
            prn,
            scheduledAt: { $gte: oneDayAgo }
        });


        const jobIds = interviews.map(i => i.jobId);

        const jobs = await Job.find({ _id: { $in: jobIds } });
        const companies = await Company.find({ companyId: { $in: jobs.map(j => j.companyId) } });
        const results = interviews.map(interview => {
            const job = jobs.find(j => j._id.toString() === interview.jobId.toString());
            const company = companies.find(c => c.companyId.toString() === job.companyId.toString());

            return {
                jobId: interview.jobId.toString(),
                prn: interview.prn,
                resume: interview.resume,
                status: interview.status,
                scheduledAt: interview.scheduledAt,
                code: interview.code,
                jobDetails: job?.toObject() || {},
                companyDetails: company?.toObject() || {},
            };
        });

        return res.json(results);
    } catch (error) {
        console.error('Error in /scheduledJobs:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});


router.get('/pastScheduledJobs', async (req, res) => {
    try {

        const prn = req.query.prn;
        if (!prn) return res.status(400).json({ message: 'PRN is required' });

        const now = new Date();

        const oneDayAgo = new Date(now);
        oneDayAgo.setDate(now.getDate() - 1);

        const interviews = await Interview.find({
            prn,
            scheduledAt: { $lte: oneDayAgo }
        });

        const jobIds = interviews.map(i => i.jobId);

        const jobs = await Job.find({ _id: { $in: jobIds } });
        const companies = await Company.find({ companyId: { $in: jobs.map(j => j.companyId) } });
        const results = interviews.map(interview => {
            const job = jobs.find(j => j._id.toString() === interview.jobId.toString());
            const company = companies.find(c => c.companyId.toString() === job.companyId.toString());

            return {
                jobId: interview.jobId.toString(),
                prn: interview.prn,
                resume: interview.resume,
                status: interview.status,
                scheduledAt: interview.scheduledAt,
                code: interview.code,
                jobDetails: job?.toObject() || {},
                companyDetails: company?.toObject() || {},
            };
        });

        return res.json(results);
    } catch (error) {
        console.error('Error in /scheduledJobs:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});



module.exports = router;

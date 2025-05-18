const { body } = require('express-validator');

const signUpValidation = [
  body('prn', 'Invalid prn')
    .trim()
    .isLength({ min: 10, max: 10 }),

  body('name', 'Name should be at least 3 characters long')
    .trim()
    .isLength({ min: 3 }),

  body('email', 'Enter a valid email')
    .isEmail()
    .normalizeEmail(),

  body('password', 'Password must be at least 5 characters')
    .isLength({ min: 5 }),

  body('phone', 'Phone must be exactly 10 digits')
    .optional() 
    .isNumeric()
    .isLength({ min: 10, max: 10 }),

  body('address', 'Address must be at least 5 characters')
    .optional()
    .trim()
    .isLength({ min: 5 }),
];

module.exports = signUpValidation;
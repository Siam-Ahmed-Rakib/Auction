const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3, max: 30 }).trim().escape(),
  body('password').isLength({ min: 6 }),
  body('name').isLength({ min: 1, max: 100 }).trim().escape()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, username, password, name } = req.body;

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      return res.status(409).json({
        error: existingUser.email === email ? 'Email already registered' : 'Username taken'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, username, password: hashedPassword, name },
      select: { id: true, email: true, username: true, name: true, createdAt: true }
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    res.status(201).json({ user, token });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        rating: user.rating,
        totalRatings: user.totalRatings,
        positiveRate: user.positiveRate,
        avatarUrl: user.avatarUrl
      },
      token
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, username: true, name: true,
        address: true, city: true, state: true, zipCode: true,
        country: true, phone: true, avatarUrl: true,
        rating: true, totalRatings: true, positiveRate: true,
        createdAt: true
      }
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update profile
router.put('/me', auth, [
  body('name').optional().trim().escape(),
  body('address').optional().trim(),
  body('city').optional().trim().escape(),
  body('state').optional().trim().escape(),
  body('zipCode').optional().trim().escape(),
  body('country').optional().trim().escape(),
  body('phone').optional().trim().escape()
], async (req, res, next) => {
  try {
    const { name, address, city, state, zipCode, country, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, address, city, state, zipCode, country, phone },
      select: {
        id: true, email: true, username: true, name: true,
        address: true, city: true, state: true, zipCode: true,
        country: true, phone: true, avatarUrl: true
      }
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

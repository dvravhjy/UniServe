const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { User, Student } = require('../models');
const { jwtSecret, jwtExpiresIn, maxFailedLogins, lockMinutes } = require('../config/env');
const { wrap, validate } = require('../middleware/common');
const { authenticate } = require('../middleware/auth');
const { audit } = require('../utils/helpers');

const router = express.Router();

const sign = (user) => jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });
const publicUser = (u) => ({ id: u.id, email: u.email, fullName: u.fullName, role: u.role, department: u.department });

// Online sign-up is disabled: student accounts are created by the Registrar at the counter
router.post('/register', (req, res) => {
  res.status(403).json({ error: 'Online sign-up is disabled. Please visit the Registrar to get your student account.' });
});

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').isString().notEmpty()],
  validate,
  wrap(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    // Same error for unknown user / wrong password to avoid user enumeration
    const bad = () => res.status(401).json({ error: 'Invalid email or password' });
    if (!user || !user.active) return bad();
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(423).json({ error: 'Account temporarily locked due to repeated failed logins. Try again later.' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      user.failedAttempts += 1;
      if (user.failedAttempts >= maxFailedLogins) {
        user.lockedUntil = new Date(Date.now() + lockMinutes * 60000);
        user.failedAttempts = 0;
      }
      await user.save();
      req.user = user;
      await audit(req, 'LOGIN_FAILED', 'User', user.id);
      return bad();
    }
    user.failedAttempts = 0;
    user.lockedUntil = null;
    await user.save();
    req.user = user;
    await audit(req, 'LOGIN', 'User', user.id);
    res.json({ token: sign(user), user: publicUser(user) });
  })
);

router.get('/me', authenticate, wrap(async (req, res) => {
  const student = req.user.role === 'student' ? await Student.findOne({ where: { userId: req.user.id } }) : null;
  res.json({ user: publicUser(req.user), student });
}));

module.exports = router;

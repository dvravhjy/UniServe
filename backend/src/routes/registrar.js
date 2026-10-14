const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { body, param } = require('express-validator');
const {
  Student, User, Subject, Section, Enrollment, EnrollmentItem, Grade, sequelize,
} = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const { wrap, validate } = require('../middleware/common');
const { audit, notify, getSettings } = require('../utils/helpers');
const { submitEnrollment } = require('../utils/enroll');

const router = express.Router();
router.use(authenticate);

// ---------- Enrollment validation (registrar) ----------
router.get('/enrollments', requireRole('registrar', 'admin'), wrap(async (req, res) => {
  const where = req.query.status ? { status: req.query.status } : {};
  const list = await Enrollment.findAll({
    where,
    include: [
      { model: Student, include: [{ model: User, attributes: ['fullName', 'email'] }] },
      { model: EnrollmentItem, as: 'items', include: [{ model: Section, include: Subject }] },
    ],
    order: [['createdAt', 'ASC']],
  });
  res.json(list);
}));

router.patch(
  '/enrollments/:id',
  requireRole('registrar'),
  [param('id').isInt(), body('approve').isBoolean(), body('remarks').optional().trim().isLength({ max: 200 }).escape()],
  validate,
  wrap(async (req, res) => {
    const enr = await Enrollment.findByPk(req.params.id, { include: Student });
    if (!enr) return res.status(404).json({ error: 'Enrollment not found' });
    if (enr.status !== 'Submitted') return res.status(409).json({ error: `Enrollment is already ${enr.status}` });
    const approve = req.body.approve === true || req.body.approve === 'true';
    await enr.update({ status: approve ? 'Validated' : 'Rejected', remarks: req.body.remarks });
    await notify(enr.Student.userId, `Your enrollment was ${enr.status.toLowerCase()}.${req.body.remarks ? ' Remarks: ' + req.body.remarks : ''}`);
    await audit(req, approve ? 'VALIDATE_ENROLLMENT' : 'REJECT_ENROLLMENT', 'Enrollment', enr.id);
    res.json(enr);
  })
);

// ---------- Students ----------
router.get('/students', requireRole('registrar', 'admin', 'cashier'), wrap(async (req, res) => {
  const students = await Student.findAll({ include: [{ model: User, attributes: ['fullName', 'email', 'active'] }], order: [['studentNo', 'ASC']] });
  res.json(students);
}));

// Create a student account at the counter (online sign-up is disabled). The temporary
// password is shown once so the registrar can hand it to the student.
const tempPassword = () => `${crypto.randomBytes(4).toString('hex')}A${crypto.randomInt(10, 99)}`;

router.post(
  '/students',
  requireRole('registrar', 'admin'),
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('fullName').trim().isLength({ min: 2, max: 100 }).escape().withMessage('Full name required'),
    body('program').trim().isLength({ min: 2, max: 100 }).escape().withMessage('Program required'),
    body('yearLevel').optional().isInt({ min: 1, max: 6 }),
  ],
  validate,
  wrap(async (req, res) => {
    const { email, fullName, program, yearLevel } = req.body;
    const password = tempPassword();
    const result = await sequelize.transaction(async (t) => {
      const user = await User.create(
        { email, fullName, role: 'student', passwordHash: await bcrypt.hash(password, 10) },
        { transaction: t }
      );
      const student = await Student.create({ userId: user.id, program, yearLevel: yearLevel || 1 }, { transaction: t });
      student.studentNo = `${new Date().getFullYear()}-${String(student.id).padStart(5, '0')}`;
      await student.save({ transaction: t });
      return { user, student };
    });
    await audit(req, 'CREATE_STUDENT', 'Student', result.student.id, { studentNo: result.student.studentNo });
    res.status(201).json({ studentId: result.student.id, studentNo: result.student.studentNo, email, tempPassword: password });
  })
);

// Enroll a student face to face: the registrar picks the sections for the student at the window
router.post(
  '/students/:id/enrollment',
  requireRole('registrar'),
  [param('id').isInt(), body('sectionIds').isArray({ min: 1, max: 12 }), body('sectionIds.*').isInt()],
  validate,
  wrap(async (req, res) => {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    const enrollment = await submitEnrollment(student, req.body.sectionIds);
    await audit(req, 'COUNTER_ENROLLMENT', 'Enrollment', enrollment.id, { studentId: student.id });
    await notify(student.userId, 'You were enrolled at the Registrar window. Please proceed to the Cashier to pay your fees.');
    res.status(201).json(enrollment);
  })
);

// ---------- Subjects ----------
router.get('/subjects', requireRole('registrar', 'admin'), wrap(async (req, res) => res.json(await Subject.findAll({ order: [['code', 'ASC']] }))));

router.post(
  '/subjects',
  requireRole('registrar'),
  [
    body('code').trim().isLength({ min: 2, max: 20 }).escape(),
    body('title').trim().isLength({ min: 2, max: 120 }).escape(),
    body('units').isInt({ min: 1, max: 6 }),
  ],
  validate,
  wrap(async (req, res) => {
    const subject = await Subject.create({ code: req.body.code, title: req.body.title, units: req.body.units });
    await audit(req, 'CREATE_SUBJECT', 'Subject', subject.id);
    res.status(201).json(subject);
  })
);

router.delete('/subjects/:id', requireRole('registrar'), [param('id').isInt()], validate, wrap(async (req, res) => {
  const used = await Section.count({ where: { subjectId: req.params.id } });
  if (used) return res.status(409).json({ error: 'Subject has sections and cannot be deleted' });
  await Subject.destroy({ where: { id: req.params.id } });
  await audit(req, 'DELETE_SUBJECT', 'Subject', req.params.id);
  res.status(204).end();
}));

// ---------- Sections / schedules ----------
router.get('/sections', requireRole('registrar', 'admin'), wrap(async (req, res) => {
  res.json(await Section.findAll({ include: [Subject, { model: User, as: 'instructor', attributes: ['id', 'fullName'] }], order: [['id', 'ASC']] }));
}));

router.post(
  '/sections',
  requireRole('registrar'),
  [
    body('subjectId').isInt(),
    body('name').trim().isLength({ min: 1, max: 30 }).escape(),
    body('schedule').trim().isLength({ min: 3, max: 60 }).escape(),
    body('room').optional().trim().isLength({ max: 30 }).escape(),
    body('capacity').optional().isInt({ min: 1, max: 200 }),
    body('instructorId').optional({ nullable: true }).isInt(),
  ],
  validate,
  wrap(async (req, res) => {
    const s = await getSettings();
    const section = await Section.create({
      subjectId: req.body.subjectId, name: req.body.name, schedule: req.body.schedule,
      room: req.body.room, capacity: req.body.capacity || 40, instructorId: req.body.instructorId || null,
      schoolYear: s.schoolYear, semester: s.semester,
    });
    await audit(req, 'CREATE_SECTION', 'Section', section.id);
    res.status(201).json(section);
  })
);

router.delete('/sections/:id', requireRole('registrar'), [param('id').isInt()], validate, wrap(async (req, res) => {
  const used = await EnrollmentItem.count({ where: { sectionId: req.params.id } });
  if (used) return res.status(409).json({ error: 'Section has enrolled students and cannot be deleted' });
  await Section.destroy({ where: { id: req.params.id } });
  await audit(req, 'DELETE_SECTION', 'Section', req.params.id);
  res.status(204).end();
}));

// ---------- Grades (instructor encodes, registrar releases) ----------
router.get('/grades/my-sections', requireRole('instructor', 'registrar'), wrap(async (req, res) => {
  const where = req.user.role === 'instructor' ? { instructorId: req.user.id } : {};
  res.json(await Section.findAll({ where, include: Subject }));
}));

async function loadSectionFor(req, res) {
  const section = await Section.findByPk(req.params.sectionId, { include: Subject });
  if (!section) { res.status(404).json({ error: 'Section not found' }); return null; }
  if (req.user.role === 'instructor' && section.instructorId !== req.user.id) {
    res.status(403).json({ error: 'You can only manage grades for your own sections' });
    return null;
  }
  return section;
}

router.get('/grades/sections/:sectionId', requireRole('instructor', 'registrar'), [param('sectionId').isInt()], validate, wrap(async (req, res) => {
  const section = await loadSectionFor(req, res);
  if (!section) return;
  const items = await EnrollmentItem.findAll({
    where: { sectionId: section.id },
    include: [
      { model: Enrollment, where: { status: 'Validated' }, include: [{ model: Student, include: [{ model: User, attributes: ['fullName'] }] }] },
      Grade,
    ],
  });
  res.json(items.map((i) => ({
    enrollmentItemId: i.id, studentNo: i.Enrollment.Student.studentNo, fullName: i.Enrollment.Student.User.fullName,
    grade: i.Grade ? i.Grade.value : null, remarks: i.Grade ? i.Grade.remarks : null, released: i.Grade ? i.Grade.released : false,
  })));
}));

router.put(
  '/grades/sections/:sectionId',
  requireRole('instructor', 'registrar'),
  [
    param('sectionId').isInt(),
    body('grades').isArray({ min: 1 }),
    body('grades.*.enrollmentItemId').isInt(),
    // Philippine scale 1.0 (highest) to 5.0 (failed)
    body('grades.*.value').isFloat({ min: 1, max: 5 }).withMessage('Grade must be between 1.0 and 5.0'),
    body('grades.*.remarks').optional().trim().isLength({ max: 100 }).escape(),
  ],
  validate,
  wrap(async (req, res) => {
    const section = await loadSectionFor(req, res);
    if (!section) return;
    let saved = 0;
    for (const g of req.body.grades) {
      const item = await EnrollmentItem.findOne({ where: { id: g.enrollmentItemId, sectionId: section.id } });
      if (!item) continue;
      const existing = await Grade.findOne({ where: { enrollmentItemId: item.id } });
      if (existing && existing.released) continue; // released grades are locked
      if (existing) await existing.update({ value: g.value, remarks: g.remarks });
      else await Grade.create({ enrollmentItemId: item.id, value: g.value, remarks: g.remarks });
      saved += 1;
    }
    await audit(req, 'ENCODE_GRADES', 'Section', section.id, { saved });
    res.json({ saved });
  })
);

router.post('/grades/sections/:sectionId/release', requireRole('registrar'), [param('sectionId').isInt()], validate, wrap(async (req, res) => {
  const section = await Section.findByPk(req.params.sectionId);
  if (!section) return res.status(404).json({ error: 'Section not found' });
  const items = await EnrollmentItem.findAll({
    where: { sectionId: section.id },
    include: [{ model: Enrollment, include: Student }, { model: Grade, required: true }],
  });
  let released = 0;
  for (const i of items) {
    if (!i.Grade.released) {
      await i.Grade.update({ released: true });
      await notify(i.Enrollment.Student.userId, 'A new grade has been released. Check your Grades page.');
      released += 1;
    }
  }
  await audit(req, 'RELEASE_GRADES', 'Section', section.id, { released });
  res.json({ released });
}));

module.exports = router;

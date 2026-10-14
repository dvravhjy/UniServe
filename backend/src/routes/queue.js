const express = require('express');
const { body, param } = require('express-validator');
const { Op } = require('sequelize');
const { QueueTicket, Student, User, QUEUE_SERVICES, sequelize } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const { wrap, validate } = require('../middleware/common');
const { audit, notify } = require('../utils/helpers');

const router = express.Router();

const PREFIX = { Registrar: 'R', Cashier: 'C', Library: 'L', Laboratory: 'B', Guidance: 'G', Dean: 'D' };
const MINUTES_PER_PERSON = Number(process.env.QUEUE_MINUTES_PER_PERSON || 5);
// Queue numbers restart each day, by local (Philippine) date rather than UTC
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: process.env.QUEUE_TZ || 'Asia/Manila' });
const httpError = (status, message) => Object.assign(new Error(message), { status });

// The window a staff member operates. Admins pass ?service=
function staffService(req) {
  const { role, department } = req.user;
  if (role === 'registrar') return 'Registrar';
  if (role === 'cashier') return 'Cashier';
  if (role === 'dept_staff') return department;
  return req.query.service || req.body.service;
}

async function snapshot(service) {
  const date = today();
  const waiting = await QueueTicket.count({ where: { service, queueDate: date, status: 'Waiting' } });
  const serving = await QueueTicket.findAll({ where: { service, queueDate: date, status: 'Serving' }, order: [['calledAt', 'ASC']] });
  return { service, waiting, nowServing: serving.map((t) => t.code), estimatedWaitMinutes: waiting * MINUTES_PER_PERSON };
}

// Public "Now Serving" board for the waiting-area screen: ticket codes only, no personal data
router.get('/board', wrap(async (req, res) => {
  res.json(await Promise.all(QUEUE_SERVICES.map(snapshot)));
}));

router.use(authenticate);

// How busy is each window? (any signed-in user)
router.get('/services', wrap(async (req, res) => {
  res.json(await Promise.all(QUEUE_SERVICES.map(snapshot)));
}));

// ---------- Student ----------
router.post(
  '/tickets',
  requireRole('student'),
  [body('service').isIn(QUEUE_SERVICES), body('purpose').optional().trim().isLength({ max: 120 }).escape()],
  validate,
  wrap(async (req, res) => {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) throw httpError(404, 'Student profile not found');
    const { service } = req.body;
    const date = today();
    const ticket = await sequelize.transaction(async (t) => {
      const active = await QueueTicket.findOne({
        where: { studentId: student.id, service, queueDate: date, status: { [Op.in]: ['Waiting', 'Serving'] } },
        transaction: t,
      });
      if (active) throw httpError(409, `You already have ticket ${active.code} for ${service}`);
      const last = await QueueTicket.max('number', { where: { service, queueDate: date }, transaction: t });
      const number = (last || 0) + 1;
      return QueueTicket.create(
        { service, queueDate: date, number, code: `${PREFIX[service]}-${String(number).padStart(3, '0')}`, purpose: req.body.purpose, studentId: student.id },
        { transaction: t }
      );
    });
    await audit(req, 'QUEUE_TAKE', 'QueueTicket', ticket.id, { service, code: ticket.code });
    res.status(201).json(ticket);
  })
);

// My tickets today, with live position and estimated wait
router.get('/my', requireRole('student'), wrap(async (req, res) => {
  const student = await Student.findOne({ where: { userId: req.user.id } });
  if (!student) return res.json([]);
  const date = today();
  const mine = await QueueTicket.findAll({ where: { studentId: student.id, queueDate: date }, order: [['createdAt', 'DESC']] });
  const out = [];
  for (const t of mine) {
    const row = t.toJSON();
    if (t.status === 'Waiting') {
      const ahead = await QueueTicket.count({ where: { service: t.service, queueDate: date, status: 'Waiting', number: { [Op.lt]: t.number } } });
      row.position = ahead + 1;
      row.estimatedWaitMinutes = ahead * MINUTES_PER_PERSON;
    }
    row.nowServing = (await snapshot(t.service)).nowServing;
    out.push(row);
  }
  res.json(out);
}));

router.delete('/tickets/:id', requireRole('student'), [param('id').isInt()], validate, wrap(async (req, res) => {
  const student = await Student.findOne({ where: { userId: req.user.id } });
  const ticket = student && (await QueueTicket.findOne({ where: { id: req.params.id, studentId: student.id } }));
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.status !== 'Waiting') return res.status(409).json({ error: 'Only a waiting ticket can be cancelled' });
  await ticket.update({ status: 'Cancelled', finishedAt: new Date() });
  await audit(req, 'QUEUE_CANCEL', 'QueueTicket', ticket.id, { code: ticket.code });
  res.json(ticket);
}));

// ---------- Staff window ----------
const staff = requireRole('registrar', 'cashier', 'dept_staff', 'admin');

// Front desk: staff issue a ticket to a walk-in student, who needs no account.
// If a student number is given the ticket is linked to that student.
router.post(
  '/walk-in',
  staff,
  [
    body('service').isIn(QUEUE_SERVICES),
    body('name').trim().isLength({ min: 2, max: 100 }).escape().withMessage('Name required'),
    body('studentNo').optional({ checkFalsy: true }).trim().isLength({ max: 20 }).escape(),
    body('purpose').optional().trim().isLength({ max: 120 }).escape(),
  ],
  validate,
  wrap(async (req, res) => {
    const { service, name, studentNo, purpose } = req.body;
    const date = today();
    const student = studentNo ? await Student.findOne({ where: { studentNo } }) : null;
    if (studentNo && !student) throw httpError(404, 'No student with that number');
    const ticket = await sequelize.transaction(async (t) => {
      const last = await QueueTicket.max('number', { where: { service, queueDate: date }, transaction: t });
      const number = (last || 0) + 1;
      return QueueTicket.create(
        { service, queueDate: date, number, code: `${PREFIX[service]}-${String(number).padStart(3, '0')}`, purpose, walkInName: name, studentId: student ? student.id : null },
        { transaction: t }
      );
    });
    await audit(req, 'QUEUE_WALKIN', 'QueueTicket', ticket.id, { service, code: ticket.code });
    res.status(201).json(ticket);
  })
);

async function board(service) {
  const date = today();
  const include = [{ model: Student, include: [{ model: User, attributes: ['fullName'] }] }];
  return {
    ...(await snapshot(service)),
    serving: await QueueTicket.findAll({ where: { service, queueDate: date, status: 'Serving' }, include, order: [['calledAt', 'ASC']] }),
    waitingList: await QueueTicket.findAll({ where: { service, queueDate: date, status: 'Waiting' }, include, order: [['number', 'ASC']] }),
  };
}

function needService(req) {
  const service = staffService(req);
  if (!QUEUE_SERVICES.includes(service)) throw httpError(400, 'Unknown service window');
  return service;
}

router.get('/window', staff, wrap(async (req, res) => res.json(await board(needService(req)))));

// Call the next waiting ticket; any ticket still being served by this window is marked Done first
router.post('/window/next', staff, wrap(async (req, res) => {
  const service = needService(req);
  const date = today();
  const called = await sequelize.transaction(async (t) => {
    await QueueTicket.update(
      { status: 'Done', finishedAt: new Date() },
      { where: { service, queueDate: date, status: 'Serving', servedById: req.user.id }, transaction: t }
    );
    const next = await QueueTicket.findOne({ where: { service, queueDate: date, status: 'Waiting' }, order: [['number', 'ASC']], include: [Student], transaction: t });
    if (!next) return null;
    await next.update({ status: 'Serving', calledAt: new Date(), servedById: req.user.id }, { transaction: t });
    return next;
  });
  if (!called) return res.json({ called: null, message: 'No one is waiting' });
  if (called.Student) await notify(called.Student.userId, `Ticket ${called.code}: please proceed to the ${service} window now.`);
  const after = await QueueTicket.findOne({ where: { service, queueDate: date, status: 'Waiting' }, order: [['number', 'ASC']], include: [Student] });
  if (after && after.Student) await notify(after.Student.userId, `Ticket ${after.code}: you are next at the ${service} window.`);
  await audit(req, 'QUEUE_CALL', 'QueueTicket', called.id, { service, code: called.code });
  res.json({ called });
}));

async function finish(req, res, status) {
  const service = needService(req);
  const ticket = await QueueTicket.findOne({ where: { id: req.params.id, service, queueDate: today() } });
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (!['Waiting', 'Serving'].includes(ticket.status)) return res.status(409).json({ error: `Ticket is already ${ticket.status}` });
  await ticket.update({ status, finishedAt: new Date(), servedById: req.user.id });
  await audit(req, `QUEUE_${status.toUpperCase()}`, 'QueueTicket', ticket.id, { code: ticket.code });
  res.json(ticket);
}
router.post('/window/:id/complete', staff, [param('id').isInt()], validate, wrap((req, res) => finish(req, res, 'Done')));
router.post('/window/:id/skip', staff, [param('id').isInt()], validate, wrap((req, res) => finish(req, res, 'Skipped')));

module.exports = router;

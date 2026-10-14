const request = require('supertest');
const app = require('../src/app');
const seed = require('../seeders/seed');
const { sequelize } = require('../src/models');

const PW = 'Password123';
const login = async (email, password = PW) => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res;
};
const tokenOf = async (email) => (await login(email)).body.token;
const auth = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => { await seed(); });
afterAll(async () => { await sequelize.close(); });

describe('Authentication & security', () => {
  test('health check works', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  test('public sign-up is disabled', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'new.student@uniserve.edu', password: 'Secret123', fullName: 'New Student', program: 'BS IT',
    });
    expect(res.status).toBe(403);
  });

  test('registrar creates a student account at the counter', async () => {
    const reg = await tokenOf('registrar@uniserve.edu');
    const bad = await request(app).post('/api/registrar/students').set(auth(reg)).send({ email: 'nope', fullName: 'X', program: 'Y' });
    expect(bad.status).toBe(400);
    const res = await request(app).post('/api/registrar/students').set(auth(reg)).send({
      email: 'walkin.student@uniserve.edu', fullName: 'Walk In Student', program: 'BS IT', yearLevel: 1,
    });
    expect(res.status).toBe(201);
    expect(res.body.studentNo).toMatch(/^\d{4}-\d{5}$/);
    const first = await login('walkin.student@uniserve.edu', res.body.tempPassword);
    expect(first.status).toBe(200);
    const st = first.body.token;
    expect((await request(app).post('/api/registrar/students').set(auth(st)).send({})).status).toBe(403);
  });

  test('wrong password gives generic error; unknown user gives same error', async () => {
    const a = await login('student@uniserve.edu', 'WrongPass1');
    const b = await login('ghost@uniserve.edu', 'WrongPass1');
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });

  test('account locks after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) await login('guidance@uniserve.edu', 'bad-password1');
    const res = await login('guidance@uniserve.edu', PW);
    expect(res.status).toBe(423);
  });

  test('SQL injection in login is treated as plain text', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: "' OR 1=1 --", password: "' OR '1'='1" });
    expect(res.status).toBe(400);
  });

  test('protected routes require a token and the right role', async () => {
    expect((await request(app).get('/api/student/profile')).status).toBe(401);
    const st = await tokenOf('student@uniserve.edu');
    expect((await request(app).get('/api/admin/users').set(auth(st))).status).toBe(403);
    expect((await request(app).get('/api/cashier/payments').set(auth(st))).status).toBe(403);
  });

  test('tampered token is rejected', async () => {
    const st = await tokenOf('student@uniserve.edu');
    const res = await request(app).get('/api/student/profile').set(auth(st.slice(0, -3) + 'abc'));
    expect(res.status).toBe(401);
  });

  test('security headers are set by helmet', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Enrollment -> validation -> grades (end to end)', () => {
  let student, registrar, cashier, instructor, enrollmentId;

  beforeAll(async () => {
    student = await tokenOf('student@uniserve.edu');
    registrar = await tokenOf('registrar@uniserve.edu');
    cashier = await tokenOf('cashier@uniserve.edu');
    instructor = await tokenOf('instructor1@uniserve.edu');
  });

  test('student sees sections and enrolls online', async () => {
    const secs = await request(app).get('/api/student/sections').set(auth(student));
    expect(secs.status).toBe(200);
    expect(secs.body.length).toBeGreaterThan(0);
    const ids = secs.body.slice(0, 2).map((s) => s.id);
    const res = await request(app).post('/api/student/enrollment').set(auth(student)).send({ sectionIds: ids });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Submitted');
    enrollmentId = res.body.id;
  });

  test('duplicate enrollment in same term is blocked', async () => {
    const secs = await request(app).get('/api/student/sections').set(auth(student));
    const res = await request(app).post('/api/student/enrollment').set(auth(student)).send({ sectionIds: [secs.body[0].id] });
    expect(res.status).toBe(409);
  });

  test('schedule is empty until the registrar validates', async () => {
    const res = await request(app).get('/api/student/schedule').set(auth(student));
    expect(res.body).toEqual([]);
  });

  test('student cannot validate enrollments', async () => {
    const res = await request(app).patch(`/api/registrar/enrollments/${enrollmentId}`).set(auth(student)).send({ approve: true });
    expect(res.status).toBe(403);
  });

  test('registrar validates enrollment; schedule appears', async () => {
    const res = await request(app).patch(`/api/registrar/enrollments/${enrollmentId}`).set(auth(registrar)).send({ approve: true });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Validated');
    const sch = await request(app).get('/api/student/schedule').set(auth(student));
    expect(sch.body.length).toBe(2);
  });

  test('charges were assessed and cashier records a payment with receipt', async () => {
    const bal = await request(app).get('/api/student/balance').set(auth(student));
    expect(bal.body.balance).toBeGreaterThan(0);
    const charge = bal.body.charges[0];
    const pay = await request(app).post('/api/cashier/payments').set(auth(cashier)).send({ chargeId: charge.id, amount: Number(charge.amount), method: 'Cash' });
    expect(pay.status).toBe(201);
    expect(pay.body.receiptNo).toMatch(/^OR-/);
    const over = await request(app).post('/api/cashier/payments').set(auth(cashier)).send({ chargeId: charge.id, amount: 1 });
    expect(over.status).toBe(400); // already fully paid
  });

  test('instructor encodes grades; student sees them only after release', async () => {
    const mine = await request(app).get('/api/registrar/grades/my-sections').set(auth(instructor));
    const sectionId = mine.body[0].id;
    const roster = await request(app).get(`/api/registrar/grades/sections/${sectionId}`).set(auth(instructor));
    expect(roster.status).toBe(200);
    expect(roster.body.length).toBe(1);
    const put = await request(app).put(`/api/registrar/grades/sections/${sectionId}`).set(auth(instructor))
      .send({ grades: [{ enrollmentItemId: roster.body[0].enrollmentItemId, value: 1.5, remarks: 'Passed' }] });
    expect(put.body.saved).toBe(1);

    let grades = await request(app).get('/api/student/grades').set(auth(student));
    expect(grades.body).toEqual([]);

    const rel = await request(app).post(`/api/registrar/grades/sections/${sectionId}/release`).set(auth(registrar));
    expect(rel.body.released).toBe(1);
    grades = await request(app).get('/api/student/grades').set(auth(student));
    expect(grades.body[0].grade).toBe(1.5);
  });

  test('invalid grade values are rejected', async () => {
    const mine = await request(app).get('/api/registrar/grades/my-sections').set(auth(instructor));
    const res = await request(app).put(`/api/registrar/grades/sections/${mine.body[0].id}`).set(auth(instructor))
      .send({ grades: [{ enrollmentItemId: 1, value: 9 }] });
    expect(res.status).toBe(400);
  });
});

describe('Clearance', () => {
  test('department can hold only its own items; student sees status', async () => {
    const student = await tokenOf('student@uniserve.edu');
    const lib = await tokenOf('library@uniserve.edu');
    const lab = await tokenOf('laboratory@uniserve.edu');

    const mine = await request(app).get('/api/student/clearance').set(auth(student));
    expect(mine.body.items.length).toBe(4);
    expect(mine.body.fullyCleared).toBe(false);

    const queue = await request(app).get('/api/department/clearance').set(auth(lib));
    expect(queue.body.every((i) => i.department === 'Library')).toBe(true);
    const item = queue.body[0];

    const noRemarks = await request(app).patch(`/api/department/clearance/${item.id}`).set(auth(lib)).send({ status: 'Hold' });
    expect(noRemarks.status).toBe(400);

    const wrongDept = await request(app).patch(`/api/department/clearance/${item.id}`).set(auth(lab)).send({ status: 'Cleared' });
    expect(wrongDept.status).toBe(403);

    const hold = await request(app).patch(`/api/department/clearance/${item.id}`).set(auth(lib)).send({ status: 'Hold', remarks: 'Unreturned book' });
    expect(hold.body.status).toBe('Hold');
  });
});

describe('Document requests workflow', () => {
  let student, registrar, cashier, docId;
  beforeAll(async () => {
    student = await tokenOf('student@uniserve.edu');
    registrar = await tokenOf('registrar@uniserve.edu');
    cashier = await tokenOf('cashier@uniserve.edu');
  });

  test('Submitted -> Payment Pending -> Paid -> Processing -> Ready -> Released', async () => {
    const create = await request(app).post('/api/documents').set(auth(student)).send({ type: 'Certificate of Enrollment', purpose: 'Scholarship application', copies: 2 });
    expect(create.status).toBe(201);
    expect(create.body.status).toBe('Submitted');
    docId = create.body.id;

    // cannot skip steps
    const skip = await request(app).patch(`/api/documents/${docId}/status`).set(auth(registrar)).send({ status: 'Ready' });
    expect(skip.status).toBe(409);

    const assess = await request(app).post(`/api/documents/${docId}/assess`).set(auth(registrar));
    expect(assess.body.status).toBe('Payment Pending');

    const bal = await request(app).get('/api/student/balance').set(auth(student));
    const charge = bal.body.charges.find((c) => c.description.includes(`request #${docId}`));
    expect(Number(charge.amount)).toBe(100);

    const pay = await request(app).post('/api/cashier/payments').set(auth(cashier)).send({ chargeId: charge.id, amount: 100 });
    expect(pay.status).toBe(201);

    const list = await request(app).get('/api/documents').set(auth(student));
    expect(list.body.find((d) => d.id === docId).status).toBe('Paid');

    for (const status of ['Processing', 'Ready', 'Released']) {
      const r = await request(app).patch(`/api/documents/${docId}/status`).set(auth(registrar)).send({ status });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe(status);
    }
  });

  test('released document can be downloaded by its owner only', async () => {
    const ok = await request(app).get(`/api/documents/${docId}/download`).set(auth(student));
    expect(ok.status).toBe(200);
    expect(ok.text).toContain('CERTIFICATE OF ENROLLMENT');
    const cashierTry = await request(app).get(`/api/documents/${docId}/download`).set(auth(cashier));
    expect(cashierTry.status).toBe(403);
    const anon = await request(app).get(`/api/documents/${docId}/download`);
    expect(anon.status).toBe(401);
  });

  test('student receives notifications for each step', async () => {
    const res = await request(app).get('/api/notifications').set(auth(student));
    expect(res.body.length).toBeGreaterThan(3);
  });

  test('unknown document type is rejected', async () => {
    const res = await request(app).post('/api/documents').set(auth(student)).send({ type: 'Fake Doc', purpose: 'test purpose' });
    expect(res.status).toBe(400);
  });
});

describe('Admin', () => {
  let admin;
  beforeAll(async () => { admin = await tokenOf('admin@uniserve.edu'); });

  test('admin creates staff user and updates settings; actions are audit-logged', async () => {
    const u = await request(app).post('/api/admin/users').set(auth(admin)).send({
      email: 'cashier2@uniserve.edu', password: 'Password123', fullName: 'Second Cashier', role: 'cashier',
    });
    expect(u.status).toBe(201);
    const s = await request(app).put('/api/admin/settings').set(auth(admin)).send({ semester: '2nd' });
    expect(s.body.semester).toBe('2nd');
    const logs = await request(app).get('/api/admin/audit-logs').set(auth(admin));
    expect(logs.body.some((l) => l.action === 'CREATE_USER')).toBe(true);
    expect(logs.body.some((l) => l.action === 'UPDATE_SETTINGS')).toBe(true);
  });

  test('admin cannot demote self; summary report works', async () => {
    const me = await request(app).get('/api/auth/me').set(auth(admin));
    const res = await request(app).patch(`/api/admin/users/${me.body.user.id}`).set(auth(admin)).send({ role: 'student' });
    expect(res.status).toBe(400);
    const rep = await request(app).get('/api/admin/reports/summary').set(auth(admin));
    expect(rep.status).toBe(200);
    expect(rep.body.students).toBeGreaterThan(0);
  });
});

describe('Virtual queue', () => {
  test('student takes a ticket; duplicates and bad services are rejected', async () => {
    const s = await tokenOf('student@uniserve.edu');
    const bad = await request(app).post('/api/queue/tickets').set(auth(s)).send({ service: 'Cafeteria' });
    expect(bad.status).toBe(400);
    const a = await request(app).post('/api/queue/tickets').set(auth(s)).send({ service: 'Cashier', purpose: 'Pay tuition' });
    expect(a.status).toBe(201);
    expect(a.body.code).toMatch(/^C-\d{3}$/);
    const dup = await request(app).post('/api/queue/tickets').set(auth(s)).send({ service: 'Cashier' });
    expect(dup.status).toBe(409);
    const mine = await request(app).get('/api/queue/my').set(auth(s));
    expect(mine.body[0].status).toBe('Waiting');
    expect(mine.body[0].position).toBe(1);
  });

  test('cashier calls next, student is notified, ticket completes', async () => {
    const s = await tokenOf('student@uniserve.edu');
    const c = await tokenOf('cashier@uniserve.edu');
    const board = await request(app).get('/api/queue/window').set(auth(c));
    expect(board.status).toBe(200);
    expect(board.body.waitingList.length).toBe(1);
    const next = await request(app).post('/api/queue/window/next').set(auth(c));
    expect(next.body.called.status).toBe('Serving');
    const notes = await request(app).get('/api/notifications').set(auth(s));
    expect(notes.body.some((n) => /proceed to the Cashier window/.test(n.message))).toBe(true);
    const done = await request(app).post(`/api/queue/window/${next.body.called.id}/complete`).set(auth(c));
    expect(done.body.status).toBe('Done');
    const again = await request(app).post(`/api/queue/window/${next.body.called.id}/complete`).set(auth(c));
    expect(again.status).toBe(409);
  });

  test('students cannot run a window; staff only see their own window', async () => {
    const s = await tokenOf('student@uniserve.edu');
    expect((await request(app).get('/api/queue/window').set(auth(s))).status).toBe(403);
    const lib = await tokenOf('library@uniserve.edu');
    const b = await request(app).get('/api/queue/window').set(auth(lib));
    expect(b.body.service).toBe('Library');
  });

  test('waiting ticket can be cancelled by its owner', async () => {
    const s = await tokenOf('student@uniserve.edu');
    const t = await request(app).post('/api/queue/tickets').set(auth(s)).send({ service: 'Registrar' });
    const del = await request(app).delete(`/api/queue/tickets/${t.body.id}`).set(auth(s));
    expect(del.body.status).toBe('Cancelled');
  });
});

describe('Walk-in counter (no online sign-up)', () => {
  test('registrar enrolls a walk-in student at the window; duplicates are blocked', async () => {
    const reg = await tokenOf('registrar@uniserve.edu');
    const made = await request(app).post('/api/registrar/students').set(auth(reg)).send({
      email: 'counter.student@uniserve.edu', fullName: 'Counter Student', program: 'BS CS',
    });
    const stTok = await tokenOf('student@uniserve.edu');
    const sub = await request(app).post('/api/registrar/subjects').set(auth(reg)).send({ code: 'WALK101', title: 'Counter Test Subject', units: 3 });
    const sec = await request(app).post('/api/registrar/sections').set(auth(reg)).send({ subjectId: sub.body.id, name: 'W1', schedule: 'MWF 08:00-09:00', capacity: 5 });
    expect(sec.status).toBe(201);
    const first = sec.body.id;
    const ok = await request(app).post(`/api/registrar/students/${made.body.studentId}/enrollment`).set(auth(reg)).send({ sectionIds: [first] });
    expect(ok.body).toEqual(expect.anything()); expect([ok.status, ok.body.error]).toEqual([201, undefined]);
    const dup = await request(app).post(`/api/registrar/students/${made.body.studentId}/enrollment`).set(auth(reg)).send({ sectionIds: [first] });
    expect(dup.status).toBe(409);
    expect((await request(app).post(`/api/registrar/students/${made.body.studentId}/enrollment`).set(auth(stTok)).send({ sectionIds: [first] })).status).toBe(403);
    const ghost = await request(app).post('/api/registrar/students/99999/enrollment').set(auth(reg)).send({ sectionIds: [first] });
    expect(ghost.status).toBe(404);
  });

  test('front desk issues tickets to walk-ins; public board shows only codes', async () => {
    const reg = await tokenOf('registrar@uniserve.edu');
    const stTok = await tokenOf('student@uniserve.edu');
    expect((await request(app).post('/api/queue/walk-in').set(auth(stTok)).send({ service: 'Registrar', name: 'Juan' })).status).toBe(403);
    expect((await request(app).post('/api/queue/walk-in').set(auth(reg)).send({ service: 'Cafeteria', name: 'Juan' })).status).toBe(400);
    const a = await request(app).post('/api/queue/walk-in').set(auth(reg)).send({ service: 'Registrar', name: 'Juan Dela Cruz', purpose: 'Enrollment' });
    const b = await request(app).post('/api/queue/walk-in').set(auth(reg)).send({ service: 'Registrar', name: 'Maria Clara' });
    expect(a.status).toBe(201);
    expect(b.body.number).toBe(a.body.number + 1);
    expect(a.body.code).toMatch(/^R-\d{3}$/);
    const nope = await request(app).post('/api/queue/walk-in').set(auth(reg)).send({ service: 'Registrar', name: 'Pedro', studentNo: '0000-00000' });
    expect(nope.status).toBe(404);

    const next = await request(app).post('/api/queue/window/next').set(auth(reg));
    expect(next.status).toBe(200);
    expect(next.body.called.walkInName).toBeTruthy();

    const board = await request(app).get('/api/queue/board'); // no token needed
    expect(board.status).toBe(200);
    const row = board.body.find((r) => r.service === 'Registrar');
    expect(row.nowServing).toContain(next.body.called.code);
    expect(JSON.stringify(board.body)).not.toContain('Juan');
  });
});

const {
  Section, Subject, Enrollment, EnrollmentItem, Charge, sequelize,
} = require('../models');
const { getSettings } = require('./helpers');

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Shared by the student self-service route and the registrar counter (walk-in enrollment).
// Throws errors carrying an HTTP status so routes can pass them to the error handler.
async function submitEnrollment(student, sectionIds) {
  const s = await getSettings();
  if (s.enrollmentOpen !== 'true') throw httpError(403, 'Enrollment is currently closed');

  const existing = await Enrollment.findOne({
    where: { studentId: student.id, schoolYear: s.schoolYear, semester: s.semester },
  });
  if (existing && existing.status !== 'Rejected') {
    throw httpError(409, 'An enrollment already exists for this term');
  }

  const ids = [...new Set(sectionIds.map(Number))];
  const sections = await Section.findAll({
    where: { id: ids, schoolYear: s.schoolYear, semester: s.semester },
    include: Subject,
  });
  if (sections.length !== ids.length) throw httpError(400, 'One or more sections are invalid for this term');

  const subjectIds = sections.map((x) => x.subjectId);
  if (new Set(subjectIds).size !== subjectIds.length) throw httpError(400, 'The same subject was selected twice');

  return sequelize.transaction(async (t) => {
    for (const sec of sections) {
      const taken = await EnrollmentItem.count({ where: { sectionId: sec.id }, transaction: t });
      if (taken >= sec.capacity) throw httpError(409, `Section ${sec.name} is full`);
    }
    const enrollment = existing
      ? await existing.update({ status: 'Submitted', remarks: null }, { transaction: t })
      : await Enrollment.create(
          { studentId: student.id, schoolYear: s.schoolYear, semester: s.semester },
          { transaction: t }
        );
    if (existing) await EnrollmentItem.destroy({ where: { enrollmentId: enrollment.id }, transaction: t });
    for (const sec of sections) {
      await EnrollmentItem.create({ enrollmentId: enrollment.id, sectionId: sec.id }, { transaction: t });
    }
    const units = sections.reduce((n, x) => n + x.Subject.units, 0);
    await Charge.create(
      { studentId: student.id, description: `Tuition ${s.schoolYear} ${s.semester} sem (${units} units)`, amount: units * Number(s.feePerUnit) },
      { transaction: t }
    );
    await Charge.create(
      { studentId: student.id, description: `Miscellaneous fees ${s.schoolYear} ${s.semester} sem`, amount: Number(s.miscFee) },
      { transaction: t }
    );
    return enrollment;
  });
}

module.exports = { submitEnrollment, httpError };

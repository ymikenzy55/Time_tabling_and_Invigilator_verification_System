const FIRST_SEMESTER_NAME = 'First Semester';
const SECOND_SEMESTER_NAME = 'Second Semester';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const addMonths = (date, months) => {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
};

const addDays = (date, days) => new Date(date.getTime() + (days * MS_PER_DAY));

const clampDate = (candidate, min, max) => {
  if (candidate.getTime() < min.getTime()) return new Date(min.getTime());
  if (candidate.getTime() > max.getTime()) return new Date(max.getTime());
  return candidate;
};

const normalizeName = (value) => value.trim().toLowerCase();

const ensureDefaultAcademicYear = async (tx) => {
  const now = new Date();
  const augustIndex = 7; // zero-based
  const cutoffMonth = 8; // September starts a new academic year
  const startYear = now.getUTCMonth() >= cutoffMonth ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const name = `${startYear}/${startYear + 1}`;

  const existing = await tx.academicYear.findUnique({ where: { name } });
  if (existing) {
    if (!existing.isActive) {
      return tx.academicYear.update({ where: { id: existing.id }, data: { isActive: true } });
    }
    return existing;
  }

  const startDate = new Date(Date.UTC(startYear, augustIndex, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(startYear + 1, augustIndex, 0, 23, 59, 59, 999));

  return tx.academicYear.create({
    data: {
      name,
      startDate,
      endDate,
      isActive: true,
    },
  });
};

const resolveAcademicYear = async (tx, academicYearId) => {
  if (academicYearId) {
    const explicit = await tx.academicYear.findUnique({ where: { id: academicYearId } });
    return explicit || null;
  }

  const active = await tx.academicYear.findFirst({
    where: { isActive: true },
    orderBy: { startDate: 'desc' },
  });
  if (active) return active;

  const mostRecent = await tx.academicYear.findFirst({
    orderBy: { startDate: 'desc' },
  });
  if (mostRecent) {
    if (!mostRecent.isActive) {
      return tx.academicYear.update({ where: { id: mostRecent.id }, data: { isActive: true } });
    }
    return mostRecent;
  }

  return ensureDefaultAcademicYear(tx);
};

const computeSemesterRanges = (academicYear) => {
  const start = new Date(academicYear.startDate);
  const end = new Date(academicYear.endDate);
  if (!(start.getTime()) || !(end.getTime()) || start.getTime() >= end.getTime()) {
    const fallbackEnd = addMonths(start, 4);
    return {
      first: { start, end: fallbackEnd },
      second: { start: addDays(fallbackEnd, 1), end: addMonths(fallbackEnd, 4) },
    };
  }

  const firstEndRaw = addMonths(start, 4);
  const firstEnd = clampDate(firstEndRaw, start, end);
  const secondStartRaw = addDays(firstEnd, 1);
  const secondStart = clampDate(secondStartRaw, start, end);

  return {
    first: { start, end: firstEnd },
    second: { start: secondStart, end },
  };
};

export const ensureDefaultSemesters = async (tx, { academicYearId } = {}) => {
  const academicYear = await resolveAcademicYear(tx, academicYearId);
  if (!academicYear) return null;

  const ranges = computeSemesterRanges(academicYear);
  const existing = await tx.semester.findMany({ where: { academicYearId: academicYear.id } });
  const nameSet = new Set(existing.map((s) => normalizeName(s.name)));
  const hasActive = existing.some((s) => s.isActive);

  const creations = [];

  if (!nameSet.has(normalizeName(FIRST_SEMESTER_NAME))) {
    creations.push(tx.semester.create({
      data: {
        name: FIRST_SEMESTER_NAME,
        academicYearId: academicYear.id,
        startDate: ranges.first.start,
        endDate: ranges.first.end,
        isActive: !hasActive,
      },
    }));
  }

  if (!nameSet.has(normalizeName(SECOND_SEMESTER_NAME))) {
    creations.push(tx.semester.create({
      data: {
        name: SECOND_SEMESTER_NAME,
        academicYearId: academicYear.id,
        startDate: ranges.second.start,
        endDate: ranges.second.end,
        isActive: !hasActive && creations.length === 0,
      },
    }));
  }

  if (creations.length > 0) {
    await Promise.all(creations);
  } else if (!hasActive) {
    const earliest = existing
      .slice()
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
    if (earliest) {
      await tx.semester.update({ where: { id: earliest.id }, data: { isActive: true } });
    }
  }

  return academicYear;
};

import * as XLSX from 'xlsx';

/**
 * Parses a CSV or Excel file and returns an array of row objects.
 * Each row is a plain object keyed by the header row's column names.
 * @param {File} file
 * @returns {Promise<Record<string, string>[]>}
 */
export const parseSpreadsheet = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        resolve(rows);
      } catch (err) {
        reject(new Error('Failed to parse file. Ensure it is a valid CSV or Excel file.'));
      }
    };
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Normalises header keys: trims, lowercases, removes non-alphanumeric chars.
 * Maps common variations to canonical field names.
 */
const HEADER_MAP = {
  // Venues
  name: 'name', venuename: 'name', venue: 'name',
  capacity: 'capacity', seats: 'capacity', seatingcapacity: 'capacity',
  location: 'location', venueLocation: 'location', block: 'location',
  isactive: 'isActive', active: 'isActive', status: 'isActive',
  // Courses
  code: 'code', coursecode: 'code', course_code: 'code',
  title: 'title', coursetitle: 'title', course_title: 'title', name: 'title',
  department: 'departmentName', dept: 'departmentName', departmentname: 'departmentName',
  level: 'level', year: 'level', yearlevel: 'level',
  credithours: 'creditHours', credits: 'creditHours', hours: 'creditHours',
  studentcount: 'studentCount', students: 'studentCount', numberofstudents: 'studentCount', count: 'studentCount',
  examdurationminutes: 'examDurationMinutes', duration: 'examDurationMinutes', examduration: 'examDurationMinutes',
  instructorname: 'instructorName', instructor: 'instructorName', examiner: 'instructorName', lecturer: 'instructorName',
  ispractical: 'isPractical', practical: 'isPractical', ispracticalcourse: 'isPractical',
};

const normaliseKey = (key) => {
  const cleaned = String(key).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return HEADER_MAP[cleaned] || cleaned;
};

/**
 * Maps parsed spreadsheet rows to venue objects.
 * Required columns: name, capacity. Optional: location, isActive.
 */
export const rowsToVenues = (rows) => {
  return rows.map((row) => {
    const mapped = {};
    for (const [k, v] of Object.entries(row)) {
      const nk = normaliseKey(k);
      if (nk) mapped[nk] = v;
    }
    return {
      name: String(mapped.name || '').trim(),
      capacity: parseInt(mapped.capacity, 10) || 0,
      location: mapped.location ? String(mapped.location).trim() : undefined,
      isActive: mapped.isActive !== undefined
        ? String(mapped.isActive).toLowerCase() === 'true' || mapped.isActive === '1' || String(mapped.isActive).toLowerCase() === 'yes'
        : true,
    };
  }).filter((v) => v.name && v.capacity > 0);
};

/**
 * Maps parsed spreadsheet rows to course objects.
 * Required columns: code, title, department, level. Optional: creditHours, studentCount, examDurationMinutes, instructorName.
 */
export const rowsToCourses = (rows) => {
  return rows.map((row) => {
    const mapped = {};
    for (const [k, v] of Object.entries(row)) {
      const nk = normaliseKey(k);
      if (nk) mapped[nk] = v;
    }
    return {
      code: String(mapped.code || '').trim(),
      title: String(mapped.title || '').trim(),
      departmentName: String(mapped.departmentName || '').trim(),
      level: parseInt(mapped.level, 10) || 100,
      creditHours: mapped.creditHours ? parseInt(mapped.creditHours, 10) : undefined,
      studentCount: mapped.studentCount !== undefined ? parseInt(mapped.studentCount, 10) : undefined,
      examDurationMinutes: mapped.examDurationMinutes ? parseInt(mapped.examDurationMinutes, 10) : undefined,
      instructorName: mapped.instructorName ? String(mapped.instructorName).trim() : undefined,
      isPractical: mapped.isPractical !== undefined
        ? String(mapped.isPractical).toLowerCase() === 'true' || mapped.isPractical === '1' || String(mapped.isPractical).toLowerCase() === 'yes'
        : false,
    };
  }).filter((c) => c.code && c.title && c.departmentName);
};

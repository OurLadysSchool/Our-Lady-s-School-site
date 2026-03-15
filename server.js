require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false } });

app.use(cors({ origin: FRONTEND_URL === '*' ? true : FRONTEND_URL.split(',').map(s => s.trim()) }));
app.use(express.json());

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      student_id TEXT,
      linked_student_id TEXT
    );
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      class_name TEXT NOT NULL,
      gender TEXT,
      parent_name TEXT,
      teacher_remark TEXT DEFAULT '',
      principal_remark TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS results (
      student_id TEXT PRIMARY KEY,
      session TEXT NOT NULL,
      term TEXT NOT NULL,
      subjects_json JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cbt_exams (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      class_name TEXT NOT NULL,
      questions_json JSONB NOT NULL
    );
  `);

  const userCount = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (userCount.rows[0].count === 0) {
    const users = [
      ['Super Admin', 'admin@ourladys.local', bcrypt.hashSync('admin123', 10), 'admin', null, null],
      ['Demo Teacher', 'teacher@ourladys.local', bcrypt.hashSync('teacher123', 10), 'teacher', null, null],
      ['Mary A. Joseph', 'student@ourladys.local', bcrypt.hashSync('student123', 10), 'student', 'OLCSS/2026/001', null],
      ['Mrs. Joseph', 'parent@ourladys.local', bcrypt.hashSync('parent123', 10), 'parent', null, 'OLCSS/2026/001']
    ];
    for (const u of users) {
      await pool.query('INSERT INTO users (full_name, email, password_hash, role, student_id, linked_student_id) VALUES ($1,$2,$3,$4,$5,$6)', u);
    }
  }

  const studentCount = await pool.query('SELECT COUNT(*)::int AS count FROM students');
  if (studentCount.rows[0].count === 0) {
    await pool.query('INSERT INTO students (id, full_name, class_name, gender, parent_name, teacher_remark, principal_remark) VALUES ($1,$2,$3,$4,$5,$6,$7)', [
      'OLCSS/2026/001', 'Mary A. Joseph', 'JSS 2 Gold', 'Female', 'Mrs. Joseph', 'A very promising and disciplined student.', 'Keep up the excellent performance.'
    ]);
  }

  const resultCount = await pool.query('SELECT COUNT(*)::int AS count FROM results');
  if (resultCount.rows[0].count === 0) {
    await pool.query('INSERT INTO results (student_id, session, term, subjects_json) VALUES ($1,$2,$3,$4)', [
      'OLCSS/2026/001', '2025/2026', 'Second Term', JSON.stringify([
        { subject: 'English Language', ca: 18, exam: 62, total: 80, grade: 'A', remark: 'Excellent' },
        { subject: 'Mathematics', ca: 16, exam: 58, total: 74, grade: 'A', remark: 'Very Good' }
      ])
    ]);
  }

  const examCount = await pool.query('SELECT COUNT(*)::int AS count FROM cbt_exams');
  if (examCount.rows[0].count === 0) {
    await pool.query('INSERT INTO cbt_exams (title, subject, duration_minutes, class_name, questions_json) VALUES ($1,$2,$3,$4,$5)', [
      'General Practice CBT', 'General Practice', 20, 'JSS 2 Gold', JSON.stringify([
        { id: 1, question: 'Which of the following is a chemical change?', options: ['Melting of ice','Dissolving salt in water','Rusting of iron','Boiling water'], answer: 2 }
      ])
    ]);
  }
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, studentId: user.student_id, linkedStudentId: user.linked_student_id }, JWT_SECRET, { expiresIn: '7d' });
}

function auth(requiredRoles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ message: 'Authorization token required.' });
    try {
      const decoded = jwt.verify(header.slice(7), JWT_SECRET);
      req.user = decoded;
      if (requiredRoles.length && !requiredRoles.includes(decoded.role)) return res.status(403).json({ message: 'Access denied.' });
      next();
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
  };
}

function gradeFromScore(total) {
  if (total >= 75) return { grade: 'A', remark: 'Excellent' };
  if (total >= 65) return { grade: 'B', remark: 'Very Good' };
  if (total >= 50) return { grade: 'C', remark: 'Good' };
  if (total >= 40) return { grade: 'D', remark: 'Pass' };
  return { grade: 'F', remark: 'Fail' };
}

app.get('/', (_req, res) => res.json({ message: 'Our Lady\'s backend is live-ready' }));

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ message: 'Invalid email or password.' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: 'Invalid email or password.' });
  res.json({ token: signToken(user), user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role, studentId: user.student_id, linkedStudentId: user.linked_student_id } });
});

app.get('/api/students', auth(['admin','teacher']), async (_req, res) => {
  const result = await pool.query('SELECT id, full_name AS "fullName", class_name AS "className", gender, parent_name AS "parentName" FROM students ORDER BY full_name');
  res.json(result.rows);
});

app.post('/api/students', auth(['admin']), async (req, res) => {
  const { id, fullName, className, gender, parentName } = req.body;
  if (!id || !fullName || !className) return res.status(400).json({ message: 'id, fullName, and className are required.' });
  const result = await pool.query('INSERT INTO students (id, full_name, class_name, gender, parent_name) VALUES ($1,$2,$3,$4,$5) RETURNING id, full_name AS "fullName", class_name AS "className", gender, parent_name AS "parentName"', [id, fullName, className, gender || null, parentName || null]);
  res.status(201).json(result.rows[0]);
});

app.post('/api/results/:studentId', auth(['admin','teacher']), async (req, res) => {
  const { studentId } = req.params;
  const { session, term, subjects } = req.body;
  if (!session || !term || !Array.isArray(subjects)) return res.status(400).json({ message: 'session, term, and subjects are required.' });
  const computed = subjects.map(s => {
    const ca = Number(s.ca || 0), exam = Number(s.exam || 0), total = ca + exam;
    return { subject: s.subject, ca, exam, total, ...gradeFromScore(total) };
  });
  await pool.query(`INSERT INTO results (student_id, session, term, subjects_json)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (student_id) DO UPDATE SET session = EXCLUDED.session, term = EXCLUDED.term, subjects_json = EXCLUDED.subjects_json`,
    [studentId, session, term, JSON.stringify(computed)]);
  res.json({ studentId, session, term, subjects: computed });
});

app.get('/api/cbt/exams', auth(['admin','teacher','student']), async (_req, res) => {
  const result = await pool.query('SELECT id, title, subject, duration_minutes AS "durationMinutes", class_name AS "className", jsonb_array_length(questions_json) AS "questionCount" FROM cbt_exams ORDER BY id DESC');
  res.json(result.rows);
});

app.post('/api/cbt/exams', auth(['admin','teacher']), async (req, res) => {
  const { title, subject, durationMinutes, className, questions } = req.body;
  if (!title || !subject || !className) return res.status(400).json({ message: 'title, subject, and className are required.' });
  const result = await pool.query('INSERT INTO cbt_exams (title, subject, duration_minutes, class_name, questions_json) VALUES ($1,$2,$3,$4,$5) RETURNING id, title, subject, duration_minutes AS "durationMinutes", class_name AS "className", jsonb_array_length(questions_json) AS "questionCount"', [title, subject, Number(durationMinutes || 20), className, JSON.stringify(Array.isArray(questions) ? questions : [])]);
  res.status(201).json(result.rows[0]);
});

initDb().then(() => app.listen(PORT, () => console.log(`Server running on ${PORT}`))).catch(err => {
  console.error(err);
  process.exit(1);
});

// ═══════════════════════════════════════════════════
// PORTFOLIO SERVER — Express + SQLite + Nodemailer
// ═══════════════════════════════════════════════════
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { db, seedDefaults } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS Middleware ──
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Middleware ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// ── Multer for image uploads ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fs = require('fs');
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// ── Email transporter ──
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ── Auth middleware ──
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ═══════════════════════════════════════════════════
// PUBLIC API — Data for the frontend
// ═══════════════════════════════════════════════════

// Get all portfolio data (used by the frontend to render dynamically)
app.get('/api/portfolio', (req, res) => {
  try {
    const projects = db.prepare('SELECT * FROM projects ORDER BY sort_order ASC').all().map(p => ({
      ...p,
      features: JSON.parse(p.features || '[]'),
      tags: JSON.parse(p.tags || '[]')
    }));

    const skills = db.prepare('SELECT * FROM skills ORDER BY sort_order ASC').all().map(s => ({
      ...s,
      items: JSON.parse(s.items || '[]')
    }));

    const education = db.prepare('SELECT * FROM education ORDER BY sort_order ASC').all();
    const certifications = db.prepare('SELECT * FROM certifications ORDER BY sort_order ASC').all();

    const settingsRows = db.prepare('SELECT key, value FROM site_settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    res.json({ projects, skills, education, certifications, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// CONTACT FORM
// ═══════════════════════════════════════════════════
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    // Save to database
    db.prepare('INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)')
      .run(name, email, subject || '', message);

    // Send email notification in background if valid credentials configured
    if (process.env.SMTP_PASS && process.env.SMTP_PASS !== 'your-gmail-app-password') {
      transporter.sendMail({
        from: `"Portfolio Contact" <${process.env.SMTP_USER}>`,
        to: process.env.EMAIL_TO || process.env.SMTP_USER,
        replyTo: email,
        subject: `Portfolio Contact: ${subject || 'New Message'} from ${name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #a855f7, #06b6d4); padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 20px; color: #fff;">New Portfolio Message</h1>
            </div>
            <div style="padding: 24px;">
              <p><strong style="color: #a855f7;">Name:</strong> ${name}</p>
              <p><strong style="color: #a855f7;">Email:</strong> ${email}</p>
              <p><strong style="color: #a855f7;">Subject:</strong> ${subject || 'N/A'}</p>
              <hr style="border: 1px solid #333; margin: 16px 0;" />
              <p><strong style="color: #a855f7;">Message:</strong></p>
              <p style="background: #0d0d1a; padding: 16px; border-radius: 8px; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
            </div>
          </div>
        `
      }).catch(mailErr => {
        console.warn('Email sending failed (message still saved):', mailErr.message);
      });
    }

    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// ADMIN AUTH
// ═══════════════════════════════════════════════════
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admin WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  req.session.isAdmin = true;
  req.session.adminId = admin.id;
  res.json({ success: true });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/admin/check', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.isAdmin) });
});

// ═══════════════════════════════════════════════════
// ADMIN — PROJECTS CRUD
// ═══════════════════════════════════════════════════
app.get('/api/admin/projects', requireAuth, (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY sort_order ASC').all().map(p => ({
    ...p, features: JSON.parse(p.features || '[]'), tags: JSON.parse(p.tags || '[]')
  }));
  res.json(projects);
});

app.post('/api/admin/projects', requireAuth, upload.single('image'), (req, res) => {
  try {
    const { title, type, year, description, features, tags, sort_order } = req.body;
    const image = req.file ? `uploads/${req.file.filename}` : '';
    const result = db.prepare(
      'INSERT INTO projects (title, type, year, description, features, tags, image, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(title, type || 'Individual Project', year || 2025, description || '', features || '[]', tags || '[]', image, sort_order || 0);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/projects/:id', requireAuth, upload.single('image'), (req, res) => {
  try {
    const { title, type, year, description, features, tags, sort_order } = req.body;
    let query = 'UPDATE projects SET title=?, type=?, year=?, description=?, features=?, tags=?, sort_order=?, updated_at=datetime("now")';
    const params = [title, type, year, description, features || '[]', tags || '[]', sort_order || 0];
    if (req.file) {
      query += ', image=?';
      params.push(`uploads/${req.file.filename}`);
    }
    query += ' WHERE id=?';
    params.push(req.params.id);
    db.prepare(query).run(...params);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/projects/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════
// ADMIN — SKILLS CRUD
// ═══════════════════════════════════════════════════
app.get('/api/admin/skills', requireAuth, (req, res) => {
  const skills = db.prepare('SELECT * FROM skills ORDER BY sort_order ASC').all().map(s => ({
    ...s, items: JSON.parse(s.items || '[]')
  }));
  res.json(skills);
});

app.post('/api/admin/skills', requireAuth, (req, res) => {
  try {
    const { category, icon, items, sort_order } = req.body;
    const result = db.prepare('INSERT INTO skills (category, icon, items, sort_order) VALUES (?, ?, ?, ?)')
      .run(category, icon || '🎮', JSON.stringify(items || []), sort_order || 0);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/skills/:id', requireAuth, (req, res) => {
  try {
    const { category, icon, items, sort_order } = req.body;
    db.prepare('UPDATE skills SET category=?, icon=?, items=?, sort_order=? WHERE id=?')
      .run(category, icon, JSON.stringify(items || []), sort_order || 0, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/skills/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM skills WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════
// ADMIN — EDUCATION CRUD
// ═══════════════════════════════════════════════════
app.get('/api/admin/education', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM education ORDER BY sort_order ASC').all());
});

app.post('/api/admin/education', requireAuth, (req, res) => {
  const { institution, degree, date_range, detail, sort_order } = req.body;
  const result = db.prepare('INSERT INTO education (institution, degree, date_range, detail, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(institution, degree, date_range, detail, sort_order || 0);
  res.json({ success: true, id: result.lastInsertRowid });
});

app.put('/api/admin/education/:id', requireAuth, (req, res) => {
  const { institution, degree, date_range, detail, sort_order } = req.body;
  db.prepare('UPDATE education SET institution=?, degree=?, date_range=?, detail=?, sort_order=? WHERE id=?')
    .run(institution, degree, date_range, detail, sort_order || 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/education/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM education WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════
// ADMIN — CERTIFICATIONS CRUD
// ═══════════════════════════════════════════════════
app.get('/api/admin/certifications', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM certifications ORDER BY sort_order ASC').all());
});

app.post('/api/admin/certifications', requireAuth, (req, res) => {
  const { title, issuer, sort_order } = req.body;
  const result = db.prepare('INSERT INTO certifications (title, issuer, sort_order) VALUES (?, ?, ?)')
    .run(title, issuer, sort_order || 0);
  res.json({ success: true, id: result.lastInsertRowid });
});

app.put('/api/admin/certifications/:id', requireAuth, (req, res) => {
  const { title, issuer, sort_order } = req.body;
  db.prepare('UPDATE certifications SET title=?, issuer=?, sort_order=? WHERE id=?')
    .run(title, issuer, sort_order || 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/certifications/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM certifications WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════
// ADMIN — MESSAGES
// ═══════════════════════════════════════════════════
app.get('/api/admin/messages', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all());
});

app.put('/api/admin/messages/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE messages SET is_read=1 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/messages/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM messages WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════
// ADMIN — SITE SETTINGS
// ═══════════════════════════════════════════════════
app.get('/api/admin/settings', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

app.put('/api/admin/settings', requireAuth, (req, res) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
  const transaction = db.transaction((settings) => {
    for (const [key, value] of Object.entries(settings)) {
      stmt.run(key, value);
    }
  });
  transaction(req.body);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════
// ADMIN — CHANGE PASSWORD
// ═══════════════════════════════════════════════════
app.put('/api/admin/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = db.prepare('SELECT * FROM admin WHERE id=?').get(req.session.adminId);
  if (!bcrypt.compareSync(currentPassword, admin.password)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admin SET password=? WHERE id=?').run(hash, admin.id);
  res.json({ success: true });
});

// ── Serve admin panel ──
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ── Fallback to index.html ──
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start server ──
seedDefaults();

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════╗
    ║   🎮 Yash Pathak Portfolio Server       ║
    ║                                          ║
    ║   Portfolio:  http://localhost:${PORT}       ║
    ║   Admin:      http://localhost:${PORT}/admin ║
    ║                                          ║
    ║   Admin Login: yash / admin123           ║
    ╚══════════════════════════════════════════╝
    `);
  });
}

module.exports = app;

// ═══════════════════════════════════════════════════
// DATABASE SETUP — SQLite with better-sqlite3
// ═══════════════════════════════════════════════════
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'portfolio.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// ── Create Tables ──
db.exec(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'Individual Project',
    year INTEGER DEFAULT 2025,
    description TEXT,
    features TEXT DEFAULT '[]',
    tags TEXT DEFAULT '[]',
    image TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    icon TEXT DEFAULT '🎮',
    items TEXT DEFAULT '[]',
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS education (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution TEXT NOT NULL,
    degree TEXT,
    date_range TEXT,
    detail TEXT,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS certifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    issuer TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT DEFAULT '',
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// ── Seed default data if empty ──
function seedDefaults() {
  const adminCount = db.prepare('SELECT COUNT(*) as c FROM admin').get().c;
  if (adminCount === 0) {
    const username = process.env.ADMIN_USERNAME || 'yash';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO admin (username, password) VALUES (?, ?)').run(username, hash);
    console.log(`✓ Admin user created: ${username}`);
  }

  const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
  if (projectCount === 0) {
    const stmt = db.prepare(`INSERT INTO projects (title, type, year, description, features, tags, image, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(
      '3D Console/PC Open World Game',
      'Team Project',
      2026,
      'A 3D open world game where players must complete objectives and destroy a parody world to save it. Built collaboratively with a team, featuring complex gameplay systems.',
      JSON.stringify(['Open world exploration with dynamic environments', 'Car driving mechanics with realistic physics', 'Gun mechanics and combat system', 'Full story mode with branching objectives']),
      JSON.stringify(['Unity 3D', 'C#', 'Open World']),
      'assets/project-3d.png',
      1
    );
    stmt.run(
      '2D Mobile Color Match Game',
      'Individual Project',
      2025,
      'A mobile game where players must match the color of a ball with upcoming blocks to pass. Built as a solo project with polished mechanics and addictive gameplay loop.',
      JSON.stringify(['Color matching puzzle mechanics', 'Real-time scoring system', 'High score tracking & leaderboards', 'In-game coin economy system']),
      JSON.stringify(['Unity 3D', 'C#', 'Mobile']),
      'assets/project-2d.png',
      2
    );
    console.log('✓ Default projects seeded');
  }

  const skillCount = db.prepare('SELECT COUNT(*) as c FROM skills').get().c;
  if (skillCount === 0) {
    const stmt = db.prepare('INSERT INTO skills (category, icon, items, sort_order) VALUES (?, ?, ?, ?)');
    stmt.run('Game Development', '🎮', JSON.stringify(['Unity 3D', 'Unreal Engine', 'Blender']), 1);
    stmt.run('Programming', '💻', JSON.stringify(['C#', 'C++', 'Game Scripting']), 2);
    stmt.run('3D Design', '🎨', JSON.stringify(['3D Modelling', 'Texturing', 'Shading']), 3);
    stmt.run('Tools & Workflow', '🛠️', JSON.stringify(['GitHub', 'VS Code', 'Version Control']), 4);
    console.log('✓ Default skills seeded');
  }

  const eduCount = db.prepare('SELECT COUNT(*) as c FROM education').get().c;
  if (eduCount === 0) {
    const stmt = db.prepare('INSERT INTO education (institution, degree, date_range, detail, sort_order) VALUES (?, ?, ?, ?, ?)');
    stmt.run('Chandigarh University', 'B.E. Computer Science & Engineering (Graphics & Gaming)', 'AUG 2023 — JUL 2027', 'GPA: 6.15/10 · Currently Enrolled', 1);
    stmt.run('St. Dominic Savio College, Lucknow', 'Higher Secondary', 'APR 2022 — MAR 2023', 'Scored 66.8%', 2);
    stmt.run('St. Dominic Savio College, Lucknow', 'Secondary', 'APR 2020 — APR 2021', 'Scored 75.16%', 3);
    console.log('✓ Default education seeded');
  }

  const certCount = db.prepare('SELECT COUNT(*) as c FROM certifications').get().c;
  if (certCount === 0) {
    db.prepare('INSERT INTO certifications (title, issuer, sort_order) VALUES (?, ?, ?)').run('Unity Game Development Professional Certification', 'Unity Technologies', 1);
    console.log('✓ Default certifications seeded');
  }

  // Default site settings
  const settingsCount = db.prepare('SELECT COUNT(*) as c FROM site_settings').get().c;
  if (settingsCount === 0) {
    const stmt = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
    stmt.run('hero_badge', 'Available for Game Dev Projects');
    stmt.run('hero_title', "I'm Yash Pathak");
    stmt.run('hero_subtitle', 'Game Designer & Developer');
    stmt.run('hero_description', 'Crafting immersive worlds and interactive experiences with Unity, Unreal Engine & Blender. Currently pursuing B.E. in Computer Science (Graphics & Gaming) at Chandigarh University.');
    stmt.run('about_heading', 'Turning Imagination Into Interactive Reality');
    stmt.run('about_text_1', "I'm a motivated and detail-oriented Game Developer with a strong foundation in game programming, 3D graphics, and software development. Currently pursuing my B.E. in Computer Science Engineering (Graphics & Gaming) at Chandigarh University, I live and breathe game design.");
    stmt.run('about_text_2', "My journey spans from crafting open-world 3D environments to building polished mobile games. I'm passionate about creating immersive gaming experiences where creativity meets technical precision — whether it's building complex game mechanics, sculpting 3D models, or optimizing shaders for that perfect visual feel.");
    stmt.run('contact_text', "I'm always excited to collaborate on game development projects, discuss new ideas, or explore opportunities in the gaming industry. Let's create something extraordinary together.");
    stmt.run('phone', '+91 7392002211');
    stmt.run('email', 'yashpathak0322@gmail.com');
    stmt.run('linkedin', 'https://linkedin.com/in/yash-pathak-88144128b');
    stmt.run('github', 'https://github.com/');
    console.log('✓ Default site settings seeded');
  }
}

module.exports = { db, seedDefaults };

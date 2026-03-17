const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite Database
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Create Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error("Error creating users table:", err);
            else {
                // Ensure existing tables are updated to have 'is_admin' if this was an existing DB
                db.run(`ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0`, (err) => {
                    // Ignore error if column already exists
                });
            }
        });

        // Create Books Table
        db.run(`CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            cover_icon_color TEXT DEFAULT 'indigo',
            author_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error("Error creating books table:", err);
            else {
                // Seed initial books if table is empty
                db.get("SELECT count(*) as count FROM books", (err, row) => {
                    if (row && row.count === 0) {
                        const seedBooks = [
                            { title: 'The Hidden River', desc: 'A gripping tale of mystery and loss set in the heart of a small Indian village where secrets never stay buried.', color: 'indigo' },
                            { title: 'Echoes of Time', desc: 'A beautiful romance that stretches across decades, proving that true love can survive even the longest separations through hardship.', color: 'purple' },
                            { title: 'Midnight Shadows', desc: 'A thrilling suspense drama focusing on a young detective investigating her own family\'s dark past and uncovering dangerous secrets.', color: 'blue' }
                        ];
                        const stmt = db.prepare("INSERT INTO books (title, description, cover_icon_color) VALUES (?, ?, ?)");
                        seedBooks.forEach(b => stmt.run(b.title, b.desc, b.color));
                        stmt.finalize();
                        console.log("Seeded initial books.");
                    }
                });
            }
        });

        // Create Messages Table
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error("Error creating messages table:", err);
        });
    }
});

// --- API Endpoints ---

// 1. Register User
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const isAdmin = (email.toLowerCase() === 'rogerprakas@gmail.com' || email.toLowerCase() === 'nilaprakashadmin@gmail.com') ? 1 : 0;

        db.run(`INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, ?)`,
            [name, email, passwordHash, isAdmin], function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ error: 'Email already exists' });
                    }
                    return res.status(500).json({ error: 'Database error' });
                }
                res.status(201).json({ message: 'User registered successfully', user: { id: this.lastID, name, email, is_admin: isAdmin } });
            });
    } catch (error) {
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// 2. Login User
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
            // Check if user should be an admin but isn't marked as one in the DB yet
            const shouldBeAdmin = (user.email.toLowerCase() === 'rogerprakas@gmail.com' || user.email.toLowerCase() === 'admin@nilaprakashnovels.com');
            const isAdmin = shouldBeAdmin ? 1 : user.is_admin;

            if (shouldBeAdmin && user.is_admin !== 1) {
                // Background update user to admin if they meet the criteria
                db.run('UPDATE users SET is_admin = 1 WHERE id = ?', [user.id]);
            }

            res.status(200).json({
                message: 'Login successful',
                user: { id: user.id, name: user.name, email: user.email, is_admin: isAdmin }
            });
        } else {
            res.status(401).json({ error: 'Invalid email or password' });
        }
    });
});

// 3. Get Books
app.get('/api/books', (req, res) => {
    db.all(`SELECT * FROM books ORDER BY id ASC`, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: 'Database error' });
        } else {
            res.status(200).json(rows);
        }
    });
});

// 4. Submit Contact Form Message
app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    db.run(`INSERT INTO messages (name, email, message) VALUES (?, ?, ?)`, [name, email, message], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(201).json({ message: 'Issue submitted successfully' });
    });
});

// --- ADMIN API ENDPOINTS ---

// Admin Middleware: Verifies the user ID passed in X-User-Id header matches an admin user
const requireAdmin = (req, res, next) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized: No user ID provided' });

    db.get('SELECT is_admin FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error verifying admin' });
        if (!user || user.is_admin !== 1) return res.status(403).json({ error: 'Forbidden: Admin access required' });
        next();
    });
};

// Admin: Get Dashboard Stats
app.get('/api/admin/stats', requireAdmin, (req, res) => {
    const stats = {};
    db.get('SELECT count(*) as count FROM users', (err, row) => {
        stats.users = row.count;
        db.get('SELECT count(*) as count FROM books', (err, row) => {
            stats.books = row.count;
            db.get('SELECT count(*) as count FROM messages', (err, row) => {
                stats.messages = row.count;
                res.status(200).json(stats);
            });
        });
    });
});

// Admin: Get All Messages
app.get('/api/admin/messages', requireAdmin, (req, res) => {
    db.all('SELECT * FROM messages ORDER BY created_at DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error fetching messages' });
        res.status(200).json(rows);
    });
});

// Admin: Get All Users
app.get('/api/admin/users', requireAdmin, (req, res) => {
    db.all('SELECT id, name, email, is_admin, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error fetching users' });
        res.status(200).json(rows);
    });
});

// Admin: Add Book
app.post('/api/admin/books', requireAdmin, (req, res) => {
    const { title, description, cover_icon_color } = req.body;
    db.run('INSERT INTO books (title, description, cover_icon_color) VALUES (?, ?, ?)',
        [title, description, cover_icon_color || 'indigo'], function (err) {
            if (err) return res.status(500).json({ error: 'Database error inserting book' });
            res.status(201).json({ message: 'Book added', id: this.lastID });
        });
});

// Admin: Delete Book
app.delete('/api/admin/books/:id', requireAdmin, (req, res) => {
    db.run('DELETE FROM books WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error deleting book' });
        res.status(200).json({ message: 'Book deleted' });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

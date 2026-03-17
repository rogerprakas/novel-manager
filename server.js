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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error("Error creating users table:", err);
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
        
        db.run(`INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`, 
        [name, email, passwordHash], function(err) {
            if (err) {
                if(err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Email already exists' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            res.status(201).json({ message: 'User registered successfully', userId: this.lastID });
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
            res.status(200).json({ 
                message: 'Login successful', 
                user: { id: user.id, name: user.name, email: user.email } 
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

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

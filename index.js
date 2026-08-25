require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./openapi.json');
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const db = new Database('tasks.db');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')
    ? createClient(supabaseUrl, supabaseKey)
    : null;
const authErrors = {
    missingToken: 'Access token required',
    invalidToken: 'Invalid or expired token',
    invalidLogin: 'Invalid login credentials'
};
app.use(express.json());

db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        done BOOLEAN NOT NULL DEFAULT 0
    )
`);

const taskCount = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();
if (taskCount.count === 0) {
    const insertTask = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
    const seedTasks = db.transaction(() => {
        insertTask.run('Learn Node.js', 0);
        insertTask.run('Build CRUD API', 1);
        insertTask.run('Test with Swagger', 0);
    });
    seedTasks();
}

function toTask(row) {
    return { id: row.id, title: row.title, done: Boolean(row.done) };
}

function findTaskById(id) {
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

function hasValidCredentials(email, password) {
    return typeof email === 'string' && email.trim() !== ''
        && typeof password === 'string' && password.trim() !== '';
}

function requireSupabase(res) {
    if (!supabase) {
        res.status(503).json({ error: 'Supabase authentication is not configured' });
        return false;
    }

    return true;
}

function extractBearerToken(req) {
    const authorization = req.get('Authorization') || '';
    const tokenMatch = authorization.match(/^Bearer\s+(\S+)$/i);
    return tokenMatch ? tokenMatch[1] : null;
}

function safeUser(user) {
    return { id: user.id, email: user.email };
}

async function authenticate(req, res, next) {
    const token = extractBearerToken(req);

    if (!token) {
        return res.status(401).json({ error: authErrors.missingToken });
    }

    if (!requireSupabase(res)) return;

    try {
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data.user) {
            return res.status(401).json({ error: authErrors.invalidToken });
        }

        req.user = data.user;
        next();
    } catch (error) {
        res.status(401).json({ error: authErrors.invalidToken });
    }
}

app.get('/', (req, res) => {
    res.json({
        name: 'Task API',
        version: '1.0',
        endpoints: ['/tasks']
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/auth/signup', async (req, res) => {
    const { email, password } = req.body || {};

    if (!hasValidCredentials(email, password)) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!requireSupabase(res)) return;

    try {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.status(201).json(data.user);
    } catch (error) {
        res.status(400).json({ error: 'Unable to sign up' });
    }
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body || {};

    if (!hasValidCredentials(email, password)) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!requireSupabase(res)) return;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error || !data.session) {
            return res.status(401).json({ error: authErrors.invalidLogin });
        }

        res.json({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
        });
    } catch (error) {
        res.status(401).json({ error: authErrors.invalidLogin });
    }
});

app.get('/public/info', (req, res) => {
    res.json({ message: 'Welcome stranger! This info is public.' });
});

app.get('/protected/profile', authenticate, (req, res) => {
    res.json(safeUser(req.user));
});

app.post('/auth/logout', authenticate, async (req, res) => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            return res.status(401).json({ error: authErrors.invalidToken });
        }

        res.status(204).send();
    } catch (error) {
        res.status(401).json({ error: authErrors.invalidToken });
    }
});

app.get('/tasks', (req, res) => {
    const tasks = db.prepare('SELECT * FROM tasks').all().map(toTask);
    res.json(tasks);
});

app.get('/tasks/:id', (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const task = findTaskById(id);

    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    res.json(toTask(task));
});

app.post('/tasks', (req, res) => {
    const { title } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
    }

    const result = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)').run(title.trim(), 0);
    const task = findTaskById(result.lastInsertRowid);

    res.status(201).json(toTask(task));
});

app.put('/tasks/:id', (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const task = findTaskById(id);

    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    const { title, done } = req.body;
    const hasValidTitle = typeof title === 'string' && title.trim() !== '';
    const hasValidDone = typeof done === 'boolean';

    if ((title !== undefined && !hasValidTitle) || (done !== undefined && !hasValidDone) || (!hasValidTitle && !hasValidDone)) {
        return res.status(400).json({ error: 'At least one valid field (title or done) is required' });
    }

    const updatedTitle = hasValidTitle ? title.trim() : task.title;
    const updatedDone = hasValidDone ? done : Boolean(task.done);
    db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?').run(updatedTitle, updatedDone ? 1 : 0, id);

    res.json(toTask(findTaskById(id)));
});

app.delete('/tasks/:id', (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

    if (result.changes === 0) {
        return res.status(404).json({ error: 'Task not found' });
    }

    res.status(204).send();
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && error.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Malformed JSON request body' });
    }

    next(error);
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

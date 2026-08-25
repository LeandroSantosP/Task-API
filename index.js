const express = require('express');
const Database = require('better-sqlite3');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./openapi.json');
const app = express();
const PORT = 3000;
const db = new Database('tasks.db');
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

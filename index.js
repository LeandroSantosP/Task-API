const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./openapi.json');
const app = express();
const PORT = 3000;
app.use(express.json());
let tasks = [
    { id: 1, title: 'Learn Node.js', done: false },
    { id: 2, title: 'Build CRUD API', done: true },
    { id: 3, title: 'Test with Swagger', done: false }
];

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
    res.json(tasks);
});

app.get('/tasks/:id', (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const task = tasks.find((item) => item.id === id);

    if (!task) {
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }

    res.json(task);
});

app.post('/tasks', (req, res) => {
    const { title } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
    }

    const nextId = tasks.reduce((highestId, task) => Math.max(highestId, task.id), 0) + 1;
    const task = { id: nextId, title: title.trim(), done: false };
    tasks.push(task);

    res.status(201).json(task);
});

app.put('/tasks/:id', (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const task = tasks.find((item) => item.id === id);

    if (!task) {
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }

    const { title, done } = req.body;
    const hasValidTitle = typeof title === 'string' && title.trim() !== '';
    const hasValidDone = typeof done === 'boolean';

    if ((title !== undefined && !hasValidTitle) || (done !== undefined && !hasValidDone) || (!hasValidTitle && !hasValidDone)) {
        return res.status(400).json({ error: 'At least one valid field (title or done) is required' });
    }

    if (hasValidTitle) task.title = title.trim();
    if (hasValidDone) task.done = done;

    res.json(task);
});

app.delete('/tasks/:id', (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const taskIndex = tasks.findIndex((item) => item.id === id);

    if (taskIndex === -1) {
        return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }

    tasks.splice(taskIndex, 1);
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

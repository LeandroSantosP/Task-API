-- Manual checks for the SQLite database.
SELECT COUNT(*) AS task_count FROM tasks;
SELECT * FROM tasks ORDER BY id;
SELECT * FROM tasks WHERE done = 1;

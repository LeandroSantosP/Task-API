# Task API

A small in-memory to-do list CRUD API built with Node.js, Express, and Swagger UI. Tasks reset when the server restarts.

## Run

```bash
npm install
npm start
```

The API runs at `http://localhost:3000`.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | API metadata |
| GET | `/health` | Health check |
| GET | `/tasks` | List all tasks |
| GET | `/tasks/:id` | Get one task |
| POST | `/tasks` | Create a task |
| PUT | `/tasks/:id` | Update a task |
| DELETE | `/tasks/:id` | Delete a task |
| GET | `/docs` | Interactive Swagger UI |

## Examples

Create a task:

```bash
curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk"}'
```

```text
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{"id":4,"title":"Buy milk","done":false}
```

Update and delete it:

```bash
curl -i -X PUT http://localhost:3000/tasks/4 \
  -H "Content-Type: application/json" \
  -d '{"done":true}'

curl -i -X DELETE http://localhost:3000/tasks/4
```

Invalid input returns `400 Bad Request`:

```text
{"error":"Title is required and must be a non-empty string"}
```

Open `http://localhost:3000/docs` to explore and execute every operation through Swagger UI.

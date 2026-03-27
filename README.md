# Smart Interview Eval

## Run locally

Start the full app from the repo root:

```bash
cd /home/gajendra/smart-interview-eval
npm run dev
```

That starts:

- frontend on `http://localhost:3000`
- backend on `http://localhost:5000`

Useful checks:

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/scoring/health
```

If you prefer separate terminals:

```bash
cd /home/gajendra/smart-interview-eval/backend && node server.js
cd /home/gajendra/smart-interview-eval/frontend && npm start
```

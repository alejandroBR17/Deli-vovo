import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiApp from './api/index'; // Importa o app principal da API

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ limit: '4mb', extended: true }));

  // Request logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });

  // Serve static files from public directory explicitly (fixes manifest issues)
  app.use(express.static(path.join(__dirname, 'public')));

  // Mount API routes
  // apiApp já monta as rotas em /api, então usamos app.use(apiApp)
  app.use(apiApp);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*path}", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

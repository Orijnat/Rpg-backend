import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sequelize } from "./models/index.js";
import characterRoutes from "./routes/characterRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import campanhaRoutes from "./routes/campanhaRoutes.js";
import npcRoutes from "./routes/npcRoutes.js";
import mestreRecursosRoutes from "./routes/mestreRecursosRoutes.js";
import { errorHandler } from "./middlewares/validate.js";
import { generalRateLimiter, getAllowedOrigins } from "./middlewares/security.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3333;
const allowedOrigins = getAllowedOrigins();

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origem não permitida."));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
app.use(helmet());
app.use(generalRateLimiter);
app.use(express.json({ limit: "2mb" }));

// Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "RPG-Backend",
    timestamp: new Date().toISOString(),
  });
});
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "RPG-Backend", timestamp: new Date().toISOString() });
});

app.get("/health/live", (req, res) => {
  res.json({ status: "ok", service: "RPG-Backend" });
});

app.get("/health/ready", async (req, res) => {
  try {
    await sequelize.authenticate({ logging: false });
    return res.json({ status: "ok", service: "RPG-Backend", database: "ok" });
  } catch (error) {
    return res.status(503).json({
      status: "error",
      service: "RPG-Backend",
      database: "unavailable",
    });
  }
});

// Rotas Principais
app.use("/api/auth", authRoutes);
app.use("/api/characters", characterRoutes);
app.use("/api/campanhas", campanhaRoutes);
app.use("/api/campanha", campanhaRoutes); // Suporte retrocompatível
app.use("/api/npcs", npcRoutes);
app.use("/api", mestreRecursosRoutes);
app.use(errorHandler);

// Inicialização e sincronização com PostgreSQL
async function startServer() {
  try {
    console.log("Conectando ao PostgreSQL...");
    await sequelize.authenticate();
    console.log("✅ Conexão com o PostgreSQL autenticada.");

    // O schema é aplicado exclusivamente por migrations versionadas.
    // Não usar sequelize.sync() aqui: ele mascara drift entre ambientes.
    console.log("✅ Schema gerenciado por migrations Sequelize.");

    app.listen(PORT, () => {
      console.log(`⚔️  RPG-Backend rodando com sucesso em http://localhost:${PORT}`);
      console.log(`📡 Aceitando requisições de: ${allowedOrigins.join(", ")}`);
    });
  } catch (error) {
    console.warn("⚠️ Aviso de Conexão com o Banco:", error.message);
    console.log("Iniciando servidor HTTP mesmo sem banco ativo imediato para desenvolvimento...");
    app.listen(PORT, () => {
      console.log(`⚔️  RPG-Backend rodando em modo fallback em http://localhost:${PORT}`);
    });
  }
}

const isEntrypoint = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  startServer();
}

export { app, allowedOrigins };

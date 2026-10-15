import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { sequelize, Character, InventoryItem, Contract } from "./models/index.js";
import characterRoutes from "./routes/characterRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3333;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

// Middlewares
app.use(
  cors({
    origin: CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

// Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "RPG-Backend",
    timestamp: new Date().toISOString(),
  });
});

// Rotas Principais
app.use("/api/characters", characterRoutes);

// Inicialização e sincronização com PostgreSQL
async function startServer() {
  try {
    console.log("Conectando ao PostgreSQL...");
    await sequelize.authenticate();
    console.log("✅ Conexão com o PostgreSQL autenticada.");

    // Sincroniza modelos com o banco (cria tabelas se não existirem)
    await sequelize.sync({ alter: true });
    console.log("✅ Modelos Sequelize sincronizados com o banco de dados.");

    app.listen(PORT, () => {
      console.log(`⚔️  RPG-Backend rodando com sucesso em http://localhost:${PORT}`);
      console.log(`📡 Aceitando requisições de: ${CORS_ORIGIN}`);
    });
  } catch (error) {
    console.warn("⚠️ Aviso de Conexão com o Banco:", error.message);
    console.log("Iniciando servidor HTTP mesmo sem banco ativo imediato para desenvolvimento...");
    app.listen(PORT, () => {
      console.log(`⚔️  RPG-Backend rodando em modo fallback em http://localhost:${PORT}`);
    });
  }
}

startServer();

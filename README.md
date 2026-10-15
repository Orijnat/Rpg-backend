# 🏰 RPG-Backend

API REST independente para persistência de dados da **Ficha de RPG Web**, desenvolvida em **Node.js, Express, Sequelize ORM e PostgreSQL**.

---

## 🛠️ Stack
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **ORM**: Sequelize v6
- **Banco de Dados**: PostgreSQL (`pg` + `pg-hstore`)
- **Comunicação**: CORS habilitado para o frontend Next.js (`http://localhost:3000`)

---

## 📂 Estrutura de Pastas
```
Rpg-backend/
├── src/
│   ├── config/
│   │   └── database.js          # Conexão e pool do Sequelize
│   ├── controllers/
│   │   └── characterController.js # Lógica de endpoints (CRUD, sync, cofre)
│   ├── models/
│   │   ├── Character.js         # Entidade com os 7 atributos e módulos
│   │   ├── InventoryItem.js     # Itens do inventário
│   │   ├── Contract.js          # Missões e contratos
│   │   └── index.js             # Relacionamentos e exportações
│   ├── routes/
│   │   └── characterRoutes.js   # Definição das rotas /api/characters
│   └── server.js                # Inicialização do Express e auto-sync
├── .env                         # Variáveis de ambiente
├── package.json
└── README.md
```

---

## 🚀 Como Executar

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar o Banco de Dados no `.env`
Edite o arquivo `.env`:
```env
PORT=3333
DATABASE_URL=postgres://seu_usuario:sua_senha@localhost:5432/rpg_ficha
CORS_ORIGIN=http://localhost:3000
```

### 3. Iniciar o Servidor
Modo de desenvolvimento (com auto-reload via nodemon):
```bash
npm run dev
```

Modo de produção:
```bash
npm start
```

Ao iniciar, o Sequelize executa `sequelize.sync({ alter: true })`, criando ou atualizando automaticamente as tabelas `characters`, `inventory_items` e `contracts` no PostgreSQL!

---

## 📡 Endpoints da API

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `GET` | `/health` | Verificação de integridade da API |
| `GET` | `/api/characters` | Lista resumo dos personagens |
| `GET` | `/api/characters/:id` | Busca personagem completo (atributos, inventário, contratos) |
| `POST` | `/api/characters` | Criação de novo personagem |
| `PUT` | `/api/characters/:id` | Atualização parcial ou total |
| `POST` | `/api/characters/sync` | **Sincronização da Ficha** (Upsert de estado completo) |
| `POST` | `/api/characters/:id/bank/verify` | Validação de senha do cofre bancário |
| `DELETE` | `/api/characters/:id` | Remove o personagem e dados associados |

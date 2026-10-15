# 🏰 RPG-Backend

API REST independente para persistência de dados da **Ficha de RPG Web**, desenvolvida em **Node.js, Express, Sequelize ORM e PostgreSQL**.

---

## 🛠️ Stack
- **Runtime**: Node.js 18+ (ES Modules)
- **Framework**: Express.js
- **ORM**: Sequelize v6
- **Banco de Dados**: PostgreSQL 14+ (`pg` + `pg-hstore`)
- **Comunicação**: CORS habilitado para o frontend Next.js

---

## 📂 Estrutura de Pastas
```
Rpg-backend/
├── database/
│   ├── schema.sql          # Schema completo do banco (tabelas, índices, triggers)
│   └── setup.sql           # Script para criar o DB e usuário PostgreSQL
├── src/
│   ├── config/
│   │   └── database.js     # Conexão e pool do Sequelize
│   ├── controllers/
│   │   └── characterController.js  # Lógica dos endpoints (CRUD, sync, cofre)
│   ├── models/
│   │   ├── Character.js    # Entidade com os 7 atributos e todos os campos
│   │   ├── InventoryItem.js # Itens do inventário
│   │   ├── Contract.js     # Missões e contratos
│   │   └── index.js        # Relacionamentos e exportações
│   ├── routes/
│   │   └── characterRoutes.js  # Rotas /api/characters
│   └── server.js           # Inicialização do Express e auto-sync
├── docker-compose.yml      # PostgreSQL local via Docker (recomendado)
├── .env.example            # Variáveis de ambiente de referência
├── package.json
└── README.md
```

---

## 🚀 Como Executar em Outra Máquina

### Opção A — Com Docker (recomendado, zero configuração)

> Necessário: [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/install/)

```bash
# 1. Sobe o PostgreSQL (cria o banco e aplica o schema automaticamente)
docker compose up -d

# 2. Instala as dependências Node
npm install

# 3. Copia e configura o .env
cp .env.example .env
# Edite .env e defina DATABASE_URL:
# DATABASE_URL=postgres://rpg_user:rpg_senha_aqui@localhost:5432/rpg_ficha

# 4. Inicia o servidor
npm run dev
```

> ✅ O Docker Compose aplica `database/schema.sql` automaticamente na primeira inicialização.

---

### Opção B — PostgreSQL instalado diretamente

```bash
# 1. Cria o banco e o usuário (execute como superusuário)
psql -U postgres -f database/setup.sql

# 2. Aplica o schema (cria as tabelas, índices e triggers)
psql -U rpg_user -d rpg_ficha -f database/schema.sql

# 3. Instala dependências e configura o .env
npm install
cp .env.example .env
# Edite .env com as credenciais corretas

# 4. Inicia o servidor
npm run dev
```

---

## ⚙️ Variáveis de Ambiente (`.env`)

Copie `.env.example` para `.env` e preencha:

```env
PORT=3333
DATABASE_URL=postgres://rpg_user:rpg_senha_aqui@localhost:5432/rpg_ficha
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
# DB_SSL=true   ← Descomente apenas se usar SSL (ex: Render, Neon, Supabase)
```

> **Atenção:** O arquivo `.env` está no `.gitignore` e nunca deve ser commitado.

---

## 🗄️ Banco de Dados

### Tabelas

| Tabela | Descrição |
|:---|:---|
| `characters` | Personagens com HP, atributos d20, moedas, cofre bancário e montaria |
| `inventory_items` | Itens do inventário por personagem (FK + CASCADE DELETE) |
| `contracts` | Missões/contratos de aventura por personagem (FK + CASCADE DELETE) |

### Principais colunas JSONB

| Coluna | Formato |
|:---|:---|
| `attributes` | `{ "FOR": 14, "DES": 16, "CON": 14, "SAB": 12, "ESP": 14, "CAR": 10, "INT": 10 }` |
| `skills` | `[{ "name": "Atletismo", "attr": "FOR", "trained": false, "bonus": 0 }]` |
| `currencies` | `{ "latina": 0, "ouro": 0, "prata": 0, "cobre": 0 }` |
| `bankSlots` | Array de 80 objetos `{ "item": "" }` |

> O Sequelize também executa `sequelize.sync({ alter: true })` na inicialização, o que mantém as tabelas sincronizadas automaticamente com os modelos.

---

## 📡 Endpoints da API

| Método | Endpoint | Descrição |
|:---|:---|:---|
| `GET` | `/health` | Verificação de integridade da API |
| `GET` | `/api/characters` | Lista resumo dos personagens |
| `GET` | `/api/characters/:id` | Personagem completo com inventário e contratos |
| `POST` | `/api/characters` | Cria novo personagem |
| `PUT` | `/api/characters/:id` | Atualiza personagem |
| `POST` | `/api/characters/sync` | **Sincronização da Ficha** (Upsert de estado completo) |
| `POST` | `/api/characters/:id/bank/verify` | Validação de senha do cofre bancário |
| `DELETE` | `/api/characters/:id` | Remove personagem e todos os dados associados |

---

## 🐳 Comandos Docker úteis

```bash
# Ver logs do banco
docker compose logs -f postgres

# Parar sem apagar dados
docker compose stop

# Parar e remover containers (dados persistem no volume)
docker compose down

# Parar e APAGAR todos os dados do banco
docker compose down -v

# Acessar o banco pelo terminal
docker exec -it rpg_ficha_db psql -U rpg_user -d rpg_ficha
```

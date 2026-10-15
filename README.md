# 🏰 RPG-Backend

API REST independente para persistência de dados da **Ficha de RPG Web**, desenvolvida em **Node.js, Express, Sequelize ORM e PostgreSQL**.

---

## 🛠️ Stack

| Tecnologia | Versão | Papel |
|:---|:---|:---|
| Node.js | 18+ | Runtime (ES Modules) |
| Express.js | 4.x | Framework HTTP |
| Sequelize | 6.x | ORM e auto-sync de tabelas |
| PostgreSQL | 14+ | Banco de dados principal |
| pg / pg-hstore | 8.x | Driver nativo PostgreSQL |
| dotenv | 16.x | Variáveis de ambiente |
| nodemon | 3.x | Hot-reload em desenvolvimento |

---

## 📂 Estrutura de Pastas

```
Rpg-backend/
├── database/
│   ├── schema.sql             # ← Schema SQL completo (tabelas, índices, triggers)
│   └── setup.sql              # ← Script para criar banco e usuário (rodar 1x como postgres)
├── src/
│   ├── config/
│   │   └── database.js        # Conexão Sequelize + pool de conexões
│   ├── controllers/
│   │   └── characterController.js  # Lógica de todos os endpoints
│   ├── models/
│   │   ├── Character.js       # Tabela characters (atributos d20, moedas, cofre, montaria)
│   │   ├── InventoryItem.js   # Tabela inventory_items (FK → characters)
│   │   ├── Contract.js        # Tabela contracts (FK → characters)
│   │   └── index.js           # Relacionamentos e exportações
│   ├── routes/
│   │   └── characterRoutes.js # Definição das rotas /api/characters
│   └── server.js              # Bootstrap do Express + sequelize.sync()
├── docker-compose.yml         # PostgreSQL local via Docker (recomendado)
├── .env.example               # Modelo das variáveis de ambiente
├── .env                       # Suas credenciais locais (NÃO commitado)
├── .gitignore
├── package.json
└── README.md
```

---

## ⚙️ Variáveis de Ambiente

Copie o arquivo de exemplo e edite com suas credenciais:

```bash
cp .env.example .env
```

Conteúdo do `.env`:

```env
# Porta HTTP do servidor Express
PORT=3333

# String de conexão PostgreSQL
# Formato: postgres://USUARIO:SENHA@HOST:PORTA/BANCO
DATABASE_URL=postgres://rpg_user:rpg_senha_aqui@localhost:5432/rpg_ficha

# Origem permitida pelo CORS (endereço do frontend Next.js)
CORS_ORIGIN=http://localhost:3000

# Ambiente: development | production
NODE_ENV=development

# Descomente para conexões SSL (ex: Render, Neon, Supabase, Railway)
# DB_SSL=true
```

> ⚠️ O `.env` está no `.gitignore` e **nunca deve ser commitado**. Use `.env.example` como referência.

---

## 🚀 Como Executar em Outra Máquina

Escolha a opção que melhor se encaixa no seu ambiente:

---

### ✅ Opção A — Docker (recomendado)

> **Pré-requisitos:** [Docker Desktop](https://docs.docker.com/get-docker/) ou Docker Engine + Docker Compose v2

Vantagem: o PostgreSQL é criado e o schema é aplicado **automaticamente**, sem instalação manual.

```bash
# 1. Clone o repositório
git clone git@github.com:Orijnat/Rpg-backend.git
cd Rpg-backend

# 2. Sobe o PostgreSQL em background
#    → Cria o banco rpg_ficha, o usuário rpg_user
#    → Aplica database/schema.sql automaticamente
docker compose up -d

# 3. Aguarde o banco ficar saudável (≈10–20s)
docker compose ps
# O status deve mostrar "healthy" para o serviço postgres

# 4. Instale as dependências Node
npm install

# 5. Configure o .env
cp .env.example .env
# Abra .env e confirme que DATABASE_URL está assim:
# DATABASE_URL=postgres://rpg_user:rpg_senha_aqui@localhost:5432/rpg_ficha

# 6. Inicie o servidor (com hot-reload)
npm run dev
```

**Saída esperada:**
```
Conectando ao PostgreSQL...
✅ Conexão com o PostgreSQL autenticada.
✅ Modelos Sequelize sincronizados com o banco de dados.
⚔️  RPG-Backend rodando com sucesso em http://localhost:3333
📡 Aceitando requisições de: http://localhost:3000
```

**Verificação:**
```bash
curl http://localhost:3333/health
# Resposta: {"status":"ok","service":"RPG-Backend","timestamp":"..."}
```

---

### ✅ Opção B — PostgreSQL Instalado Diretamente

> **Pré-requisitos:** PostgreSQL 14+ instalado ([guia oficial](https://www.postgresql.org/download/)) + Node.js 18+

```bash
# 1. Clone o repositório
git clone git@github.com:Orijnat/Rpg-backend.git
cd Rpg-backend

# 2. Crie o banco de dados e o usuário dedicado
#    (execute como superusuário do Postgres)
psql -U postgres -f database/setup.sql

# 3. Aplique o schema (tabelas, índices, triggers)
psql -U rpg_user -d rpg_ficha -f database/schema.sql

# 4. Confirme que as tabelas foram criadas
psql -U rpg_user -d rpg_ficha -c "\dt"
#  Deve listar: characters | contracts | inventory_items

# 5. Instale as dependências Node
npm install

# 6. Configure o .env
cp .env.example .env
# Edite DATABASE_URL com o seu usuário e senha:
# DATABASE_URL=postgres://rpg_user:SUA_SENHA@localhost:5432/rpg_ficha

# 7. Inicie o servidor
npm run dev
```

---

### ✅ Opção C — PostgreSQL como serviço em nuvem (Render, Neon, Supabase…)

Caso você tenha um banco PostgreSQL hospedado:

```bash
# 1. Clone e instale as dependências
git clone git@github.com:Orijnat/Rpg-backend.git
cd Rpg-backend
npm install

# 2. Configure o .env com a connection string do serviço
cp .env.example .env
# Exemplo para Neon / Render (sempre usa SSL):
# DATABASE_URL=postgres://user:pass@ep-xyz.us-east-1.aws.neon.tech/rpg_ficha?sslmode=require
# DB_SSL=true

# 3. Aplique o schema no banco remoto
psql "$DATABASE_URL" -f database/schema.sql

# 4. Inicie o servidor
npm run dev
```

---

## 🗄️ Banco de Dados

### Tabelas

| Tabela | Colunas principais | Relacionamento |
|:---|:---|:---|
| `characters` | `id (UUID PK)`, `name`, `hp`, `hpMax`, `level`, `attributes (JSONB)`, `skills (JSONB)`, `currencies (JSONB)`, `bankSlots (JSONB)`, `bankPassword` | — |
| `inventory_items` | `id (UUID PK)`, `characterId (FK)`, `name`, `quantity`, `notes` | `→ characters` (CASCADE DELETE) |
| `contracts` | `id (UUID PK)`, `characterId (FK)`, `title`, `reward`, `done (BOOLEAN)` | `→ characters` (CASCADE DELETE) |

### Estrutura das colunas JSONB

```jsonc
// attributes
{ "FOR": 14, "DES": 16, "CON": 14, "SAB": 12, "ESP": 14, "CAR": 10, "INT": 10 }

// skills (array de 19 perícias)
[
  { "name": "Atletismo", "attr": "FOR", "trained": false, "bonus": 0 },
  { "name": "Percepção",  "attr": "ESP", "trained": true,  "bonus": 2 }
]

// currencies
{ "latina": 0, "ouro": 150, "prata": 30, "cobre": 0 }

// bankSlots (80 posições)
[{ "item": "" }, { "item": "Poção de Cura" }, ...]
```

> O Sequelize executa `sequelize.sync({ alter: true })` a cada inicialização, mantendo as tabelas atualizadas automaticamente caso o modelo mude.

---

## 📡 Endpoints da API

### `GET /health`
Verificação de integridade — não requer autenticação.
```bash
curl http://localhost:3333/health
# → { "status": "ok", "service": "RPG-Backend", "timestamp": "..." }
```

### `GET /api/characters`
Lista resumo de todos os personagens.
```bash
curl http://localhost:3333/api/characters
# → [{ "id": "uuid", "name": "Herói", "level": 1, "hp": 70, "hpMax": 70, ... }]
```

### `GET /api/characters/:id`
Retorna um personagem completo com inventário e contratos.
```bash
curl http://localhost:3333/api/characters/SEU-UUID
```

### `POST /api/characters`
Cria um novo personagem.
```bash
curl -X POST http://localhost:3333/api/characters \
  -H "Content-Type: application/json" \
  -d '{ "name": "Gandalf", "job": "Mago", "hp": 60, "hpMax": 60 }'
```

### `PUT /api/characters/:id`
Atualiza campos de um personagem existente.
```bash
curl -X PUT http://localhost:3333/api/characters/SEU-UUID \
  -H "Content-Type: application/json" \
  -d '{ "hp": 45, "level": 2 }'
```

### `POST /api/characters/sync`
**Endpoint principal usado pelo frontend.** Faz upsert completo da ficha (cria se não existe, atualiza se já existe pelo `id`).
```bash
curl -X POST http://localhost:3333/api/characters/sync \
  -H "Content-Type: application/json" \
  -d '{ "id": "uuid-ou-vazio", "name": "Herói", "hp": 70, ... }'
# → { "success": true, "message": "Ficha sincronizada com sucesso.", "character": {...} }
```

### `POST /api/characters/:id/bank/verify`
Valida a senha do cofre bancário.
```bash
curl -X POST http://localhost:3333/api/characters/SEU-UUID/bank/verify \
  -H "Content-Type: application/json" \
  -d '{ "password": "133313" }'
# → { "valid": true }  ou  { "valid": false }
```

### `DELETE /api/characters/:id`
Remove o personagem e todos os dados associados (inventário + contratos em CASCADE).
```bash
curl -X DELETE http://localhost:3333/api/characters/SEU-UUID
```

---

## 🐳 Comandos Docker Úteis

```bash
# Ver status dos containers
docker compose ps

# Acompanhar logs do banco em tempo real
docker compose logs -f postgres

# Parar os containers (dados persistem no volume)
docker compose stop

# Parar e remover containers (dados ainda persistem no volume)
docker compose down

# ⚠️  Parar e APAGAR todos os dados do banco (volume removido)
docker compose down -v

# Acessar o banco pelo terminal interativo
docker exec -it rpg_ficha_db psql -U rpg_user -d rpg_ficha

# Comandos úteis dentro do psql:
#   \dt              → lista as tabelas
#   \d characters    → descreve a tabela characters
#   SELECT * FROM characters;
#   \q               → sair
```

---

## 🔧 Scripts npm

| Comando | Descrição |
|:---|:---|
| `npm run dev` | Inicia em modo desenvolvimento com hot-reload (nodemon) |
| `npm start` | Inicia em modo produção (node puro) |

---

## ❗ Solução de Problemas

**`FATAL: role "rpg_user" does not exist`**
→ Execute `psql -U postgres -f database/setup.sql` para criar o usuário.

**`ECONNREFUSED` ou `connection refused`**
→ O PostgreSQL não está rodando. Com Docker: `docker compose up -d`. Nativo: `sudo systemctl start postgresql`.

**`password authentication failed`**
→ Verifique `DATABASE_URL` no `.env`. A senha deve coincidir com a definida no `setup.sql` ou no `docker-compose.yml`.

**`SSL connection required`**
→ Adicione `DB_SSL=true` no `.env`. Usado em bancos de nuvem como Render, Neon e Supabase.

**Porta 5432 já em uso**
→ Algum PostgreSQL local pode estar rodando. Altere a porta no `docker-compose.yml`:
```yaml
ports:
  - "5433:5432"   # usa porta 5433 no host
```
E atualize o `.env`: `DATABASE_URL=postgres://...@localhost:5433/rpg_ficha`

-- =============================================================================
-- RPG-Ficha: Schema SQL para PostgreSQL
-- =============================================================================
-- Gerado manualmente a partir dos modelos Sequelize (Rpg-backend)
-- Versão: 1.0.0
-- Compatibilidade: PostgreSQL 14+
-- Uso: psql -U <usuario> -d rpg_ficha -f database/schema.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Cria o banco de dados (execute separadamente como superusuário, se necessário)
-- -----------------------------------------------------------------------------
-- CREATE DATABASE rpg_ficha
--   WITH ENCODING = 'UTF8'
--        LC_COLLATE = 'pt_BR.UTF-8'
--        LC_CTYPE   = 'pt_BR.UTF-8'
--        TEMPLATE   = template0;

-- Habilita a extensão para geração de UUIDs (disponível por padrão no Postgres 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1.5. Tabela: users
-- Contas de usuários do sistema para autenticação
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "users" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "username"     VARCHAR(50)  NOT NULL UNIQUE,
  "email"        VARCHAR(120) NOT NULL UNIQUE,
  "password"     VARCHAR(255) NOT NULL,
  "role"         VARCHAR(20) NOT NULL DEFAULT 'player' CHECK ("role" IN ('player', 'master')),
  "perfil"       VARCHAR(20) NOT NULL DEFAULT 'jogador' CHECK ("perfil" IN ('jogador', 'mestre')),
  "dados_mestre" JSONB        NOT NULL DEFAULT '{"tituloSessao":"Próxima sessão","anotacoesSessao":"","npcs":[],"iniciativa":[],"imagensMapas":[]}',
  "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" VARCHAR(20) NOT NULL DEFAULT 'player';
UPDATE "users" SET "role" = 'player' WHERE "role" IS NULL;
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'player';
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE "users" ADD CONSTRAINT users_role_check CHECK ("role" IN ('player', 'master'));
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "perfil" VARCHAR(20) NOT NULL DEFAULT 'jogador';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dados_mestre" JSONB NOT NULL DEFAULT '{"tituloSessao":"Próxima sessão","anotacoesSessao":"","npcs":[],"iniciativa":[],"imagensMapas":[]}';
UPDATE "users" SET "perfil" = CASE WHEN "role" = 'master' THEN 'mestre' ELSE 'jogador' END WHERE "perfil" IS NULL OR "perfil" = 'jogador';
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS users_perfil_check;
ALTER TABLE "users" ADD CONSTRAINT users_perfil_check CHECK ("perfil" IN ('jogador', 'mestre'));

-- -----------------------------------------------------------------------------
-- 2. Tabela: characters
-- Personagens com atributos d20, moedas, cofre bancário, montaria e anotações.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "characters" (
  -- Identificação
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId"       UUID         REFERENCES "users"("id") ON DELETE CASCADE,
  "name"         VARCHAR(120) NOT NULL DEFAULT 'Novo Herói',
  "job"          VARCHAR(80)  NOT NULL DEFAULT '',
  "level"        INTEGER      NOT NULL DEFAULT 1,
  "forca"        INTEGER      NOT NULL DEFAULT 14,
  "destreza"     INTEGER      NOT NULL DEFAULT 16,
  "constituicao" INTEGER      NOT NULL DEFAULT 14,
  "sabedoria"    INTEGER      NOT NULL DEFAULT 12,
  "espirito"     INTEGER      NOT NULL DEFAULT 14,
  "carisma"      INTEGER      NOT NULL DEFAULT 10,
  "inteligencia" INTEGER      NOT NULL DEFAULT 10,

  -- Pontos de Vida
  "hp"           INTEGER      NOT NULL DEFAULT 70,
  "hpMax"        INTEGER      NOT NULL DEFAULT 70,

  -- Aparência
  "age"          VARCHAR(20)  NOT NULL DEFAULT '',
  "eyes"         VARCHAR(50)  NOT NULL DEFAULT '',
  "height"       VARCHAR(30)  NOT NULL DEFAULT '',
  "skin"         VARCHAR(50)  NOT NULL DEFAULT '',
  "weight"       VARCHAR(30)  NOT NULL DEFAULT '',
  "hair"         VARCHAR(50)  NOT NULL DEFAULT '',
  "appearance"   TEXT         NOT NULL DEFAULT '',

  -- Atributos d20 (JSONB: { FOR, DES, CON, SAB, ESP, CAR, INT })
  -- Exemplo: {"FOR": 14, "DES": 16, "CON": 14, "SAB": 12, "ESP": 14, "CAR": 10, "INT": 10}
  "attributes"   JSONB        NOT NULL DEFAULT '{"FOR":14,"DES":16,"CON":14,"SAB":12,"ESP":14,"CAR":10,"INT":10}',

  -- Perícias (JSONB: array de objetos { name, attr, trained, bonus })
  -- Exemplo: [{"name":"Atletismo","attr":"FOR","trained":false,"bonus":0}]
  "skills"       JSONB        NOT NULL DEFAULT '[]',
  "pericias"     JSONB        NOT NULL DEFAULT '[]',

  -- Moedas (JSONB: { latina, ouro, prata, cobre })
  "currencies"   JSONB        NOT NULL DEFAULT '{"latina":0,"ouro":0,"prata":0,"cobre":0}',
  "moedas"       JSONB        NOT NULL DEFAULT '{"latina":0,"ouro":0,"prata":0,"cobre":0}',
  "itens_inventario" JSONB    NOT NULL DEFAULT '[]',
  "contratos_dados" JSONB     NOT NULL DEFAULT '[]',
  "jogadores"    JSONB        NOT NULL DEFAULT '[]',
  "npcs"         JSONB        NOT NULL DEFAULT '[]',

  -- Cofre bancário (JSONB: array de 80 slots { item: "" })
  "bankSlots"    JSONB        NOT NULL DEFAULT '[]',
  "bankPassword" VARCHAR(50)  NOT NULL DEFAULT '133313',

  -- Anotações gerais e do quarto
  "notes"        TEXT         NOT NULL DEFAULT '',
  "imagens_anotacoes" JSONB   NOT NULL DEFAULT '[]',
  "roomNotes"    TEXT         NOT NULL DEFAULT '',

  -- Montaria
  "mountName"    VARCHAR(100) NOT NULL DEFAULT '',
  "mountHP"      INTEGER      NOT NULL DEFAULT 20,
  "mountHPMax"   INTEGER      NOT NULL DEFAULT 20,
  "mountNotes"   TEXT         NOT NULL DEFAULT '',

  -- Timestamps automáticos (Sequelize padrão)
  "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Garante existência da coluna userId caso a tabela já tenha sido criada anteriormente
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "userId" UUID REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "forca" INTEGER NOT NULL DEFAULT 14;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "destreza" INTEGER NOT NULL DEFAULT 16;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "constituicao" INTEGER NOT NULL DEFAULT 14;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "sabedoria" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "espirito" INTEGER NOT NULL DEFAULT 14;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "carisma" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "inteligencia" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "pericias" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "moedas" JSONB NOT NULL DEFAULT '{"latina":0,"ouro":0,"prata":0,"cobre":0}';
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "itens_inventario" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "contratos_dados" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "jogadores" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "npcs" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "imagens_anotacoes" JSONB NOT NULL DEFAULT '[]';

-- Índice para buscas frequentes por nome
CREATE INDEX IF NOT EXISTS idx_characters_name
  ON "characters" ("name");

-- Índice para ordenação por data de atualização (usado na listagem do painel admin)
CREATE INDEX IF NOT EXISTS idx_characters_updated_at
  ON "characters" ("updatedAt" DESC);

-- Comentários descritivos nas colunas
COMMENT ON TABLE  "characters"               IS 'Personagens jogáveis com todos os dados da ficha RPG';
COMMENT ON COLUMN "characters"."attributes"  IS 'JSON dos 7 atributos d20: FOR, DES, CON, SAB, ESP, CAR, INT (valores 1–30)';
COMMENT ON COLUMN "characters"."skills"      IS 'Array JSON das 19 perícias canônicas com treino, atributo base e bônus extra';
COMMENT ON COLUMN "characters"."currencies"  IS 'Moedas do personagem: latina, ouro, prata, cobre';
COMMENT ON COLUMN "characters"."bankSlots"   IS 'Array de 80 slots do cofre bancário protegidos por senha';
COMMENT ON COLUMN "characters"."bankPassword" IS 'Senha numérica do cofre bancário (padrão: 133313)';

-- -----------------------------------------------------------------------------
-- 3. Tabela: inventory_items
-- Itens do inventário, vinculados a um personagem (CASCADE DELETE)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "inventory_items" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "characterId" UUID         NOT NULL REFERENCES "characters"("id") ON DELETE CASCADE,
  "name"        VARCHAR(120) NOT NULL,
  "quantity"    INTEGER      NOT NULL DEFAULT 1,
  "notes"       TEXT         NOT NULL DEFAULT '',

  "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índice para busca de itens por personagem
CREATE INDEX IF NOT EXISTS idx_inventory_items_character
  ON "inventory_items" ("characterId");

COMMENT ON TABLE  "inventory_items"               IS 'Itens do inventário de cada personagem';
COMMENT ON COLUMN "inventory_items"."characterId" IS 'FK para characters — deletado em cascata com o personagem';

-- -----------------------------------------------------------------------------
-- 4. Tabela: contracts
-- Missões/contratos de aventura do personagem (CASCADE DELETE)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "contracts" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "characterId" UUID         NOT NULL REFERENCES "characters"("id") ON DELETE CASCADE,
  "title"       VARCHAR(200) NOT NULL,
  "reward"      VARCHAR(100) NOT NULL DEFAULT '???',
  "done"        BOOLEAN      NOT NULL DEFAULT FALSE,

  "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índice para listar contratos por personagem
CREATE INDEX IF NOT EXISTS idx_contracts_character
  ON "contracts" ("characterId");

-- Índice para filtrar por status (concluído / pendente)
CREATE INDEX IF NOT EXISTS idx_contracts_done
  ON "contracts" ("characterId", "done");

COMMENT ON TABLE  "contracts"               IS 'Missões e contratos de aventura por personagem';
COMMENT ON COLUMN "contracts"."characterId" IS 'FK para characters — deletado em cascata com o personagem';
COMMENT ON COLUMN "contracts"."done"        IS 'TRUE = contrato concluído; FALSE = pendente';

-- -----------------------------------------------------------------------------
-- 5. Função auxiliar: atualiza updatedAt automaticamente em updates
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger nas tabelas
CREATE OR REPLACE TRIGGER set_updated_at_users
  BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at_characters
  BEFORE UPDATE ON "characters"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at_inventory_items
  BEFORE UPDATE ON "inventory_items"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at_contracts
  BEFORE UPDATE ON "contracts"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Conceder permissões para o usuário da aplicação
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rpg_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rpg_user;

-- -----------------------------------------------------------------------------
-- 6. Dados iniciais de exemplo (seed opcional)
-- Remova ou comente este bloco em produção.
-- -----------------------------------------------------------------------------
-- INSERT INTO "characters" (
--   "name", "job", "level", "hp", "hpMax",
--   "attributes", "bankPassword"
-- ) VALUES (
--   'Personagem Inicial', 'Bruxeiro', 1, 70, 70,
--   '{"FOR":14,"DES":16,"CON":14,"SAB":12,"ESP":14,"CAR":10,"INT":10}',
--   '133313'
-- );

-- =============================================================================
-- Fim do Schema
-- =============================================================================

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
-- 2. Tabela: characters
-- Personagens com atributos d20, moedas, cofre bancário, montaria e anotações.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "characters" (
  -- Identificação
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "name"         VARCHAR(120) NOT NULL DEFAULT 'Novo Herói',
  "job"          VARCHAR(80)  NOT NULL DEFAULT '',
  "level"        INTEGER      NOT NULL DEFAULT 1,

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

  -- Moedas (JSONB: { latina, ouro, prata, cobre })
  "currencies"   JSONB        NOT NULL DEFAULT '{"latina":0,"ouro":0,"prata":0,"cobre":0}',

  -- Cofre bancário (JSONB: array de 80 slots { item: "" })
  "bankSlots"    JSONB        NOT NULL DEFAULT '[]',
  "bankPassword" VARCHAR(50)  NOT NULL DEFAULT '133313',

  -- Anotações gerais e do quarto
  "notes"        TEXT         NOT NULL DEFAULT '',
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

-- Aplicar trigger nas três tabelas
CREATE OR REPLACE TRIGGER set_updated_at_characters
  BEFORE UPDATE ON "characters"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at_inventory_items
  BEFORE UPDATE ON "inventory_items"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at_contracts
  BEFORE UPDATE ON "contracts"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

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

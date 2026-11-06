-- =============================================================================
-- RPG Ficha (Grimorium) | Schema Relacional Canônico Reformulado (PostgreSQL 14+)
-- Baseado na Skill: banco-de-dados-ops
-- =============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- 1. usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome varchar(120) NOT NULL CHECK (length(btrim(nome)) > 0),
  email varchar(320) NOT NULL UNIQUE CHECK (email = lower(email)),
  senha_hash varchar(255) NOT NULL,
  perfil varchar(20) NOT NULL DEFAULT 'jogador' CHECK (perfil IN ('jogador', 'mestre')),
  ativo boolean NOT NULL DEFAULT true,
  ultimo_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. sessoes_autenticacao
CREATE TABLE IF NOT EXISTS sessoes_autenticacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  ip inet,
  user_agent text,
  expira_at timestamptz NOT NULL,
  revogada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS sessoes_autenticacao_usuario_idx ON sessoes_autenticacao (usuario_id);
CREATE INDEX IF NOT EXISTS sessoes_autenticacao_validas_idx ON sessoes_autenticacao (usuario_id, token_hash) WHERE revogada_at IS NULL;

-- 3. campanhas
CREATE TABLE IF NOT EXISTS campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  nome varchar(160) NOT NULL CHECK (length(btrim(nome)) > 0),
  cenario varchar(120),
  descricao text,
  estado varchar(30) NOT NULL DEFAULT 'planejamento' CHECK (estado IN ('planejamento', 'ativa', 'pausada', 'encerrada')),
  codigo_convite varchar(32) UNIQUE,
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS campanhas_proprietario_idx ON campanhas (proprietario_id);
CREATE UNIQUE INDEX IF NOT EXISTS campanhas_codigo_convite_ativo_idx ON campanhas (codigo_convite) WHERE codigo_convite IS NOT NULL AND estado IN ('planejamento', 'ativa');

-- 4. membros_campanha
CREATE TABLE IF NOT EXISTS membros_campanha (
  campanha_id uuid NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  papel varchar(30) NOT NULL DEFAULT 'jogador' CHECK (papel IN ('mestre', 'co-mestre', 'jogador', 'observador')),
  bloqueado boolean NOT NULL DEFAULT false,
  entrou_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (campanha_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS membros_campanha_usuario_idx ON membros_campanha (usuario_id);

-- 5. personagens
CREATE TABLE IF NOT EXISTS personagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  campanha_id uuid REFERENCES campanhas(id) ON DELETE SET NULL,
  nome varchar(160) NOT NULL CHECK (length(btrim(nome)) > 0),
  classe varchar(100) NOT NULL DEFAULT 'Aventureiro',
  nivel smallint NOT NULL DEFAULT 1 CHECK (nivel BETWEEN 1 AND 30),
  experiencia integer NOT NULL DEFAULT 0 CHECK (experiencia >= 0),
  pontos_vida integer NOT NULL DEFAULT 70 CHECK (pontos_vida >= 0),
  pontos_vida_maximo integer NOT NULL DEFAULT 70 CHECK (pontos_vida_maximo > 0),
  pontos_esforco integer NOT NULL DEFAULT 0 CHECK (pontos_esforco >= 0),
  pontos_esforco_maximo integer NOT NULL DEFAULT 0 CHECK (pontos_esforco_maximo >= 0),
  insanidade integer NOT NULL DEFAULT 0 CHECK (insanidade >= 0),
  insanidade_maximo integer NOT NULL DEFAULT 0 CHECK (insanidade_maximo >= 0),
  bonus_pericia smallint NOT NULL DEFAULT 2 CHECK (bonus_pericia >= 0),
  classe_armadura smallint NOT NULL DEFAULT 10 CHECK (classe_armadura >= 0),
  dado_vida varchar(10) NOT NULL DEFAULT 'd8',
  iniciativa_bonus smallint NOT NULL DEFAULT 0,
  descricao text,
  aparencia text,
  idade varchar(40),
  olhos varchar(60),
  altura varchar(30),
  peso varchar(30),
  pele varchar(60),
  cabelo varchar(60),
  extensoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS personagens_usuario_idx ON personagens (usuario_id);
CREATE INDEX IF NOT EXISTS personagens_campanha_idx ON personagens (campanha_id);

-- 6. atributos_personagem
CREATE TABLE IF NOT EXISTS atributos_personagem (
  personagem_id uuid PRIMARY KEY REFERENCES personagens(id) ON DELETE CASCADE,
  forca smallint NOT NULL DEFAULT 10 CHECK (forca BETWEEN 1 AND 30),
  destreza smallint NOT NULL DEFAULT 10 CHECK (destreza BETWEEN 1 AND 30),
  constituicao smallint NOT NULL DEFAULT 10 CHECK (constituicao BETWEEN 1 AND 30),
  sabedoria smallint NOT NULL DEFAULT 10 CHECK (sabedoria BETWEEN 1 AND 30),
  espirito smallint NOT NULL DEFAULT 10 CHECK (espirito BETWEEN 1 AND 30),
  carisma smallint NOT NULL DEFAULT 10 CHECK (carisma BETWEEN 1 AND 30),
  inteligencia smallint NOT NULL DEFAULT 10 CHECK (inteligencia BETWEEN 1 AND 30),
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. pericias_personagem
CREATE TABLE IF NOT EXISTS pericias_personagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personagem_id uuid NOT NULL REFERENCES personagens(id) ON DELETE CASCADE,
  nome varchar(100) NOT NULL,
  atributo_base varchar(3) NOT NULL CHECK (atributo_base IN ('FOR','DES','CON','SAB','ESP','CAR','INT')),
  treinada boolean NOT NULL DEFAULT false,
  bonus_adicional smallint NOT NULL DEFAULT 0,
  CONSTRAINT pericias_personagem_nome_unico UNIQUE (personagem_id, nome)
);
CREATE INDEX IF NOT EXISTS pericias_personagem_personagem_idx ON pericias_personagem (personagem_id);

-- 8. itens_inventario
CREATE TABLE IF NOT EXISTS itens_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personagem_id uuid NOT NULL REFERENCES personagens(id) ON DELETE CASCADE,
  nome varchar(160) NOT NULL CHECK (length(btrim(nome)) > 0),
  quantidade decimal(10, 2) NOT NULL DEFAULT 1.00 CHECK (quantidade >= 0),
  peso_unitario decimal(10, 3) NOT NULL DEFAULT 0.000 CHECK (peso_unitario >= 0),
  equipado boolean NOT NULL DEFAULT false,
  tipo varchar(40) NOT NULL DEFAULT 'geral' CHECK (tipo IN ('arma', 'armadura', 'consumivel', 'ferramenta', 'geral')),
  descricao text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS itens_inventario_personagem_idx ON itens_inventario (personagem_id);

-- 9. cofres
CREATE TABLE IF NOT EXISTS cofres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personagem_id uuid NOT NULL UNIQUE REFERENCES personagens(id) ON DELETE CASCADE,
  platina decimal(12, 2) NOT NULL DEFAULT 0.00 CHECK (platina >= 0),
  ouro decimal(12, 2) NOT NULL DEFAULT 0.00 CHECK (ouro >= 0),
  prata decimal(12, 2) NOT NULL DEFAULT 0.00 CHECK (prata >= 0),
  cobre decimal(12, 2) NOT NULL DEFAULT 0.00 CHECK (cobre >= 0),
  senha_cofre_hash varchar(255),
  slots_banco jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. sessoes_jogo
CREATE TABLE IF NOT EXISTS sessoes_jogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  numero integer NOT NULL CHECK (numero > 0),
  titulo varchar(200) NOT NULL CHECK (length(btrim(titulo)) > 0),
  estado varchar(30) NOT NULL DEFAULT 'planejada' CHECK (estado IN ('planejada', 'em_andamento', 'concluida', 'cancelada')),
  data_agendada timestamptz,
  resumo_pos_jogo text NOT NULL DEFAULT '',
  cenas jsonb NOT NULL DEFAULT '[]'::jsonb,
  objetivos jsonb NOT NULL DEFAULT '[]'::jsonb,
  recompensas jsonb NOT NULL DEFAULT '{"xpTotal":0,"ouro":0,"itens":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sessoes_jogo_campanha_numero_unico UNIQUE (campanha_id, numero)
);
CREATE INDEX IF NOT EXISTS sessoes_jogo_campanha_idx ON sessoes_jogo (campanha_id, numero);

-- 11. npcs
CREATE TABLE IF NOT EXISTS npcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  criado_por_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  nome varchar(160) NOT NULL CHECK (length(btrim(nome)) > 0),
  papel varchar(120),
  pontos_vida integer NOT NULL DEFAULT 10 CHECK (pontos_vida >= 0),
  pontos_vida_maximo integer NOT NULL DEFAULT 10 CHECK (pontos_vida_maximo > 0),
  classe_armadura smallint NOT NULL DEFAULT 10,
  ataques jsonb NOT NULL DEFAULT '[]'::jsonb,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS npcs_campanha_idx ON npcs (campanha_id);

-- 12. encontros
CREATE TABLE IF NOT EXISTS encontros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  nome varchar(160) NOT NULL CHECK (length(btrim(nome)) > 0),
  tipo varchar(40) NOT NULL DEFAULT 'combate' CHECK (tipo IN ('combate', 'social', 'exploracao')),
  ativo boolean NOT NULL DEFAULT false,
  rodada integer NOT NULL DEFAULT 1 CHECK (rodada >= 1),
  turno_indice smallint NOT NULL DEFAULT 0 CHECK (turno_indice >= 0),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS encontros_campanha_idx ON encontros (campanha_id);

-- 13. iniciativas
CREATE TABLE IF NOT EXISTS iniciativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encontro_id uuid NOT NULL REFERENCES encontros(id) ON DELETE CASCADE,
  personagem_id uuid REFERENCES personagens(id) ON DELETE CASCADE,
  npc_id uuid REFERENCES npcs(id) ON DELETE CASCADE,
  nome varchar(160) NOT NULL,
  valor smallint NOT NULL DEFAULT 0,
  ordem smallint NOT NULL DEFAULT 0,
  condicoes text[] NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT iniciativas_combatente_exclusivo CHECK (
    (CASE WHEN personagem_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN npc_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);
CREATE INDEX IF NOT EXISTS iniciativas_encontro_idx ON iniciativas (encontro_id, valor DESC, ordem ASC);

-- 14. auditoria
CREATE TABLE IF NOT EXISTS auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  campanha_id uuid REFERENCES campanhas(id) ON DELETE SET NULL,
  acao varchar(80) NOT NULL,
  entidade varchar(80) NOT NULL,
  entidade_id uuid,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS auditoria_campanha_idx ON auditoria (campanha_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auditoria_usuario_idx ON auditoria (usuario_id, created_at DESC);

-- Triggers automáticas de updated_at
DO $$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY[
    'usuarios', 'campanhas', 'personagens', 'atributos_personagem',
    'itens_inventario', 'cofres', 'sessoes_jogo', 'npcs', 'encontros'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_%I_updated_at ON %I', tab, tab);
    EXECUTE format('CREATE TRIGGER trigger_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp()', tab, tab);
  END LOOP;
END;
$$;

COMMIT;

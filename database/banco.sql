-- =============================================================================
-- RPG Ficha | Modelo relacional alvo (PostgreSQL 14+)
-- =============================================================================
-- Este arquivo é uma evolução versionável do schema.sql. Ele NÃO apaga nem
-- renomeia as tabelas legadas users, characters, inventory_items e contracts.
-- Senhas são sempre armazenadas somente como senha_hash.
--
-- Aplicação: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/banco.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'perfil_usuario') THEN
    CREATE TYPE perfil_usuario AS ENUM ('jogador', 'mestre');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_campanha') THEN
    CREATE TYPE estado_campanha AS ENUM ('planejamento', 'ativa', 'pausada', 'encerrada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'papel_membro') THEN
    CREATE TYPE papel_membro AS ENUM ('jogador', 'mestre', 'observador');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_anotacao') THEN
    CREATE TYPE tipo_anotacao AS ENUM ('diario', 'anotacao', 'handout');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_imagem') THEN
    CREATE TYPE tipo_imagem AS ENUM ('avatar', 'personagem', 'mapa', 'handout', 'anexo');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_contrato') THEN
    CREATE TYPE estado_contrato AS ENUM ('rascunho', 'ativo', 'concluido', 'cancelado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_encontro') THEN
    CREATE TYPE tipo_encontro AS ENUM ('combate', 'social', 'exploracao', 'outro');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_recurso_mapa') THEN
    CREATE TYPE tipo_recurso_mapa AS ENUM ('mapa', 'handout');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_sessao') THEN
    CREATE TYPE tipo_sessao AS ENUM ('login', 'renovacao', 'logout');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION atualizar_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome varchar(120) NOT NULL,
  email varchar(320) NOT NULL,
  senha_hash text NOT NULL,
  perfil perfil_usuario NOT NULL DEFAULT 'jogador',
  ativo boolean NOT NULL DEFAULT true,
  ultimo_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_email_normalizado CHECK (email = lower(email)),
  CONSTRAINT usuarios_nome_nao_vazio CHECK (length(btrim(nome)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_unico ON usuarios (email);

CREATE TABLE IF NOT EXISTS campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  nome varchar(160) NOT NULL,
  descricao text,
  estado estado_campanha NOT NULL DEFAULT 'planejamento',
  codigo_convite varchar(32),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campanhas_nome_nao_vazio CHECK (length(btrim(nome)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS campanhas_codigo_convite_unico
  ON campanhas (codigo_convite) WHERE codigo_convite IS NOT NULL;
CREATE INDEX IF NOT EXISTS campanhas_proprietario_idx ON campanhas (proprietario_id);

CREATE TABLE IF NOT EXISTS membros_campanha (
  campanha_id uuid NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  papel papel_membro NOT NULL DEFAULT 'jogador',
  entrou_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campanha_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS membros_campanha_usuario_idx ON membros_campanha (usuario_id);

CREATE TABLE IF NOT EXISTS personagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  campanha_id uuid REFERENCES campanhas(id) ON DELETE SET NULL,
  nome varchar(160) NOT NULL,
  descricao text,
  idade varchar(80), olhos varchar(80), altura varchar(40), pele varchar(80),
  peso varchar(40), cabelo varchar(80), aparencia text,
  pontos_vida integer NOT NULL DEFAULT 0,
  pontos_vida_maximo integer NOT NULL DEFAULT 0,
  classe varchar(100), nivel integer NOT NULL DEFAULT 1,
  experiencia integer NOT NULL DEFAULT 0,
  dados_extras jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personagens_nome_nao_vazio CHECK (length(btrim(nome)) > 0),
  CONSTRAINT personagens_vida_valida CHECK (pontos_vida >= 0 AND pontos_vida_maximo >= 0 AND pontos_vida <= pontos_vida_maximo),
  CONSTRAINT personagens_nivel_valido CHECK (nivel > 0 AND experiencia >= 0)
);
CREATE INDEX IF NOT EXISTS personagens_usuario_idx ON personagens (usuario_id);
CREATE INDEX IF NOT EXISTS personagens_campanha_idx ON personagens (campanha_id);

CREATE TABLE IF NOT EXISTS atributos_personagem (
  personagem_id uuid PRIMARY KEY REFERENCES personagens(id) ON DELETE CASCADE,
  forca smallint NOT NULL DEFAULT 0, destreza smallint NOT NULL DEFAULT 0,
  constituicao smallint NOT NULL DEFAULT 0, sabedoria smallint NOT NULL DEFAULT 0,
  espirito smallint NOT NULL DEFAULT 0, carisma smallint NOT NULL DEFAULT 0,
  inteligencia smallint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atributos_faixa CHECK (
    forca BETWEEN -99 AND 999 AND destreza BETWEEN -99 AND 999 AND
    constituicao BETWEEN -99 AND 999 AND sabedoria BETWEEN -99 AND 999 AND
    espirito BETWEEN -99 AND 999 AND carisma BETWEEN -99 AND 999 AND inteligencia BETWEEN -99 AND 999)
);

CREATE TABLE IF NOT EXISTS pericias_personagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personagem_id uuid NOT NULL REFERENCES personagens(id) ON DELETE CASCADE,
  nome varchar(100) NOT NULL, valor smallint NOT NULL DEFAULT 0,
  descricao text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pericias_valor_valido CHECK (valor BETWEEN -999 AND 999),
  CONSTRAINT pericias_personagem_nome_unico UNIQUE (personagem_id, nome)
);

CREATE TABLE IF NOT EXISTS itens_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personagem_id uuid NOT NULL REFERENCES personagens(id) ON DELETE CASCADE,
  nome varchar(160) NOT NULL, descricao text, quantidade numeric(12,2) NOT NULL DEFAULT 1,
  peso numeric(12,3), equipado boolean NOT NULL DEFAULT false,
  propriedades jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT itens_nome_nao_vazio CHECK (length(btrim(nome)) > 0),
  CONSTRAINT itens_quantidade_valida CHECK (quantidade >= 0),
  CONSTRAINT itens_peso_valido CHECK (peso IS NULL OR peso >= 0)
);
CREATE INDEX IF NOT EXISTS itens_inventario_personagem_idx ON itens_inventario (personagem_id);

CREATE TABLE IF NOT EXISTS contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personagem_id uuid NOT NULL REFERENCES personagens(id) ON DELETE CASCADE,
  campanha_id uuid REFERENCES campanhas(id) ON DELETE SET NULL,
  titulo varchar(180) NOT NULL, descricao text, recompensa text,
  estado estado_contrato NOT NULL DEFAULT 'rascunho',
  prazo_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contratos_titulo_nao_vazio CHECK (length(btrim(titulo)) > 0)
);
CREATE INDEX IF NOT EXISTS contratos_personagem_idx ON contratos (personagem_id);

CREATE TABLE IF NOT EXISTS anotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  personagem_id uuid REFERENCES personagens(id) ON DELETE CASCADE,
  campanha_id uuid REFERENCES campanhas(id) ON DELETE CASCADE,
  tipo tipo_anotacao NOT NULL DEFAULT 'anotacao', titulo varchar(180), conteudo text NOT NULL,
  privada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT anotacoes_alvo CHECK (personagem_id IS NOT NULL OR campanha_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS anotacoes_campanha_idx ON anotacoes (campanha_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS anotacoes_autor_idx ON anotacoes (autor_id);

CREATE TABLE IF NOT EXISTS imagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  personagem_id uuid REFERENCES personagens(id) ON DELETE CASCADE,
  campanha_id uuid REFERENCES campanhas(id) ON DELETE CASCADE,
  tipo tipo_imagem NOT NULL, nome_arquivo varchar(255) NOT NULL,
  url text NOT NULL, mime_type varchar(100), tamanho_bytes bigint,
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT imagens_alvo CHECK (personagem_id IS NOT NULL OR campanha_id IS NOT NULL),
  CONSTRAINT imagens_tamanho_valido CHECK (tamanho_bytes IS NULL OR tamanho_bytes >= 0)
);
CREATE INDEX IF NOT EXISTS imagens_personagem_idx ON imagens (personagem_id);
CREATE INDEX IF NOT EXISTS imagens_campanha_idx ON imagens (campanha_id);

CREATE TABLE IF NOT EXISTS cofres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personagem_id uuid NOT NULL UNIQUE REFERENCES personagens(id) ON DELETE CASCADE,
  ouro numeric(18,2) NOT NULL DEFAULT 0, prata numeric(18,2) NOT NULL DEFAULT 0,
  cobre numeric(18,2) NOT NULL DEFAULT 0, outras_moedas jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cofres_valores_nao_negativos CHECK (ouro >= 0 AND prata >= 0 AND cobre >= 0)
);
CREATE TABLE IF NOT EXISTS montarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personagem_id uuid NOT NULL REFERENCES personagens(id) ON DELETE CASCADE,
  nome varchar(120) NOT NULL, especie varchar(100), descricao text,
  pontos_vida integer NOT NULL DEFAULT 0, pontos_vida_maximo integer NOT NULL DEFAULT 0,
  dados_extras jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT montarias_vida_valida CHECK (pontos_vida >= 0 AND pontos_vida_maximo >= pontos_vida)
);
CREATE INDEX IF NOT EXISTS montarias_personagem_idx ON montarias (personagem_id);

CREATE TABLE IF NOT EXISTS npcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  criado_por_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  nome varchar(160) NOT NULL, papel varchar(120), descricao text,
  pontos_vida integer NOT NULL DEFAULT 0, pontos_vida_maximo integer NOT NULL DEFAULT 0,
  dados_extras jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT npcs_vida_valida CHECK (pontos_vida >= 0 AND pontos_vida_maximo >= pontos_vida)
);
CREATE INDEX IF NOT EXISTS npcs_campanha_idx ON npcs (campanha_id);

CREATE TABLE IF NOT EXISTS encontros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  criado_por_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  nome varchar(160) NOT NULL, tipo tipo_encontro NOT NULL DEFAULT 'combate',
  ativo boolean NOT NULL DEFAULT false, dados_extras jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS iniciativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encontro_id uuid NOT NULL REFERENCES encontros(id) ON DELETE CASCADE,
  personagem_id uuid REFERENCES personagens(id) ON DELETE CASCADE,
  npc_id uuid REFERENCES npcs(id) ON DELETE CASCADE,
  nome varchar(160) NOT NULL, valor integer NOT NULL DEFAULT 0, ordem smallint NOT NULL DEFAULT 0,
  CONSTRAINT iniciativas_um_combatente CHECK (
    (CASE WHEN personagem_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN npc_id IS NOT NULL THEN 1 ELSE 0 END) = 1)
);
CREATE INDEX IF NOT EXISTS iniciativas_encontro_idx ON iniciativas (encontro_id, valor DESC, ordem);

CREATE TABLE IF NOT EXISTS recursos_campanha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  criado_por_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  tipo tipo_recurso_mapa NOT NULL, titulo varchar(180) NOT NULL, descricao text,
  url text NOT NULL, publica boolean NOT NULL DEFAULT false, metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recursos_campanha_tipo_idx ON recursos_campanha (campanha_id, tipo);

CREATE TABLE IF NOT EXISTS sessoes_autenticacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash text NOT NULL, tipo tipo_sessao NOT NULL DEFAULT 'login',
  ip inet, user_agent text, expira_at timestamptz NOT NULL, revogada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sessoes_token_hash_unico ON sessoes_autenticacao (token_hash);
CREATE INDEX IF NOT EXISTS sessoes_usuario_idx ON sessoes_autenticacao (usuario_id, expira_at);

CREATE TABLE IF NOT EXISTS auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  campanha_id uuid REFERENCES campanhas(id) ON DELETE SET NULL, acao varchar(80) NOT NULL,
  entidade varchar(80) NOT NULL, entidade_id uuid, dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip inet, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auditoria_campanha_data_idx ON auditoria (campanha_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auditoria_usuario_data_idx ON auditoria (usuario_id, created_at DESC);

-- Atualização automática, inclusive em futuras alterações manuais dos registros.
DO $$
DECLARE tabela text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'usuarios','campanhas','personagens','atributos_personagem','pericias_personagem',
    'itens_inventario','contratos','anotacoes','imagens','cofres','montarias','npcs',
    'encontros','recursos_campanha'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'tr_' || tabela || '_updated_at', tabela);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at()',
      'tr_' || tabela || '_updated_at', tabela);
  END LOOP;
END $$;

COMMENT ON TABLE usuarios IS 'Identidade e autenticação; senha_hash nunca deve ser serializada pela API.';
COMMENT ON TABLE campanhas IS 'Unidade de isolamento do mestre e dos jogadores.';
COMMENT ON TABLE membros_campanha IS 'Autoriza o acesso do usuário à campanha.';
COMMENT ON TABLE personagens IS 'Ficha do jogador, opcionalmente vinculada a uma campanha.';
COMMENT ON COLUMN personagens.dados_extras IS 'Extensões flexíveis; dados funcionais permanecem em colunas relacionais.';

-- =============================================================================
-- Compatibilidade e migração (executar após validar os dados legados)
-- =============================================================================
-- 1. Faça backup. 2. Crie este modelo. 3. Migre em transação, mapeando:
-- users.id -> usuarios.id; users.password/password_hash -> usuarios.senha_hash;
-- characters.userId/user_id -> personagens.usuario_id; inventory_items.characterId
-- -> itens_inventario.personagem_id; contracts.characterId -> contratos.personagem_id.
-- Os nomes exatos do legado variam entre versões; por isso o bloco abaixo apenas
-- copia quando as tabelas/colunas existem, sem sobrescrever registros atuais.
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE $q$
      INSERT INTO usuarios (id, nome, email, senha_hash, perfil)
      SELECT id, COALESCE(NULLIF(btrim(username), ''), 'Usuário'), lower(email), password,
             CASE WHEN COALESCE(role, '') IN ('master','mestre')
                  THEN 'mestre'::perfil_usuario ELSE 'jogador'::perfil_usuario END
      FROM users WHERE email IS NOT NULL AND password IS NOT NULL
      ON CONFLICT (id) DO NOTHING
    $q$;
  END IF;
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Migração de users ignorada: use o mapeamento de colunas documentado.';
END $$;

DO $$
BEGIN
  IF to_regclass('public.characters') IS NOT NULL THEN
    INSERT INTO personagens
      (id, usuario_id, nome, classe, nivel, forca, destreza, constituicao,
       sabedoria, espirito, carisma, inteligencia, pontos_vida, pontos_vida_maximo,
       idade, olhos, altura, pele, peso, cabelo, aparencia, dados_extras)
    SELECT c.id, c."userId", c.name, c.job, c.level,
      COALESCE((c.attributes ->> 'FOR')::integer, 0),
      COALESCE((c.attributes ->> 'DES')::integer, 0),
      COALESCE((c.attributes ->> 'CON')::integer, 0),
      COALESCE((c.attributes ->> 'SAB')::integer, 0),
      COALESCE((c.attributes ->> 'ESP')::integer, 0),
      COALESCE((c.attributes ->> 'CAR')::integer, 0),
      COALESCE((c.attributes ->> 'INT')::integer, 0),
      c.hp, c."hpMax", c.age, c.eyes, c.height, c.skin, c.weight, c.hair,
      c.appearance, jsonb_build_object('attributes', c.attributes, 'skills', c.skills,
        'notes', c.notes, 'roomNotes', c."roomNotes")
    FROM characters c JOIN usuarios u ON u.id = c."userId"
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Migração de characters ignorada: use o mapeamento de colunas documentado.';
END $$;

DO $$
BEGIN
  IF to_regclass('public.inventory_items') IS NOT NULL THEN
    INSERT INTO itens_inventario (id, personagem_id, nome, quantidade, descricao)
    SELECT i.id, i."characterId", i.name, i.quantity, i.notes
    FROM inventory_items i JOIN personagens p ON p.id = i."characterId"
    ON CONFLICT (id) DO NOTHING;
  END IF;
  IF to_regclass('public.contracts') IS NOT NULL THEN
    INSERT INTO contratos (id, personagem_id, titulo, recompensa, estado)
    SELECT c.id, c."characterId", c.title, c.reward,
      CASE WHEN c.done THEN 'concluido'::estado_contrato ELSE 'ativo'::estado_contrato END
    FROM contracts c JOIN personagens p ON p.id = c."characterId"
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Migração de itens/contratos ignorada: use o mapeamento de colunas documentado.';
END $$;

-- bankPassword não é migrada: é um segredo legado em texto puro e deve ser
-- invalidada/rotacionada fora desta migração. As coleções JSON são preservadas
-- em personagens.dados_extras para posterior normalização sem perda.
-- Rollback: remova somente os registros novos identificados pelo relatório de
-- migração; não execute DROP/DELETE nas tabelas legadas.

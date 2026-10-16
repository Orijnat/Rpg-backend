-- =============================================================================
-- RPG-Ficha: Script de Setup Inicial
-- =============================================================================
-- Execute este script UMA VEZ como superusuário do PostgreSQL para:
--   1. Criar o banco de dados rpg_ficha
--   2. Criar um usuário dedicado (opcional, recomendado para produção)
--   3. Conceder as permissões necessárias
--
-- Uso:
--   psql -U postgres -f database/setup.sql
--
-- Depois execute o schema:
--   psql -U rpg_user -d rpg_ficha -f database/schema.sql
-- =============================================================================

-- 1. Cria o usuário dedicado (altere a senha!)
-- Comente este bloco se já tiver um usuário configurado.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rpg_user') THEN
    CREATE ROLE rpg_user
      LOGIN
      PASSWORD 'rpg_senha_aqui'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE;
    RAISE NOTICE 'Usuário rpg_user criado com sucesso.';
  ELSE
    RAISE NOTICE 'Usuário rpg_user já existe — pulando criação.';
  END IF;
END
$$;

-- 2. Cria o banco de dados
SELECT 'CREATE DATABASE rpg_ficha
  WITH OWNER = rpg_user
       ENCODING = ''UTF8''
       TEMPLATE   = template0'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rpg_ficha')\gexec

-- 3. Concede privilégios ao usuário no banco e no schema public
GRANT ALL PRIVILEGES ON DATABASE rpg_ficha TO rpg_user;

\connect rpg_ficha
GRANT ALL ON SCHEMA public TO rpg_user;
ALTER SCHEMA public OWNER TO rpg_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rpg_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rpg_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO rpg_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO rpg_user;


-- =============================================================================
-- Próximo passo: conecte ao banco e aplique o schema:
--   \c rpg_ficha
--   \i database/schema.sql
--
-- Ou em linha de comando:
--   psql -U rpg_user -d rpg_ficha -f database/schema.sql
-- =============================================================================

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
       LC_COLLATE = ''pt_BR.UTF-8''
       LC_CTYPE   = ''pt_BR.UTF-8''
       TEMPLATE   = template0'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rpg_ficha')\gexec

-- 3. Concede privilégios ao usuário no banco
GRANT ALL PRIVILEGES ON DATABASE rpg_ficha TO rpg_user;

-- =============================================================================
-- Próximo passo: conecte ao banco e aplique o schema:
--   \c rpg_ficha
--   \i database/schema.sql
--
-- Ou em linha de comando:
--   psql -U rpg_user -d rpg_ficha -f database/schema.sql
-- =============================================================================

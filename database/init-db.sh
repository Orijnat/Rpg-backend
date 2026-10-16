#!/usr/bin/env bash
# =============================================================================
# RPG-Ficha: Script de Inicialização do Banco de Dados
# Executa setup.sql (criação do usuário rpg_user e banco rpg_ficha)
# e banco.sql (criação das tabelas, índices, triggers e migração legada).
# =============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🏰 Iniciando configuração do PostgreSQL para o RPG-Backend..."

# 1. Executa o setup como superusuário postgres
echo "➡️  Executando setup.sql (usuário rpg_user e banco rpg_ficha)..."
sudo -u postgres psql < "$DIR/setup.sql"

# 2. Executa o schema canônico com as tabelas, índices, triggers e migração
echo "➡️  Executando banco.sql (schema canônico e migração legada)..."
sudo -u postgres psql -v ON_ERROR_STOP=1 -d rpg_ficha < "$DIR/banco.sql"

# 3. Concede permissões e transfere ownership para o usuário da aplicação rpg_user
echo "➡️  Garantindo permissões e ownership para rpg_user..."
sudo -u postgres psql -d rpg_ficha -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rpg_user; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rpg_user; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO rpg_user; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO rpg_user; DO \$\$ DECLARE r RECORD; BEGIN FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP EXECUTE 'ALTER TABLE ' || quote_ident(r.tablename) || ' OWNER TO rpg_user;'; END LOOP; END \$\$;"

echo ""
echo "🎉 Banco de dados rpg_ficha configurado com sucesso!"
echo "Tabelas criadas:"
sudo -u postgres psql -d rpg_ficha -c "\dt"

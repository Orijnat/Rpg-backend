import { DataTypes } from "sequelize";

// Verificação de e-mail + redefinição de senha + revogação de tokens antigos:
// colunas novas em usuarios. Tudo idempotente e sem perda de dados.
export async function up(queryInterface) {
  const sequelize = queryInterface.sequelize;
  await sequelize.query(`
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS verification_token_hash varchar(128),
      ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz,
      ADD COLUMN IF NOT EXISTS reset_token_hash varchar(128),
      ADD COLUMN IF NOT EXISTS reset_token_expires_at timestamptz,
      ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
  `);
  // Contas legadas já existentes são consideradas verificadas (não perderam senha);
  // apenas contas novas passam pelo fluxo de verificação.
  await sequelize.query("UPDATE usuarios SET email_verified = true WHERE email_verified = false;");
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query(`
    ALTER TABLE usuarios
      DROP COLUMN IF EXISTS email_verified,
      DROP COLUMN IF EXISTS verification_token_hash,
      DROP COLUMN IF EXISTS verification_expires_at,
      DROP COLUMN IF EXISTS reset_token_hash,
      DROP COLUMN IF EXISTS reset_token_expires_at,
      DROP COLUMN IF EXISTS password_changed_at;
  `);
}

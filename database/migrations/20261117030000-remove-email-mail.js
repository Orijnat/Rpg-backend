// Remove o envio/verificação de e-mail por completo (2026-11-17):
// código de 6 dígitos, links de verificação, redefinição de senha por e-mail.
// password_changed_at É PRESERVADO (revoga JWTs antigos quando a senha muda).
export async function up(queryInterface) {
  await queryInterface.sequelize.query(`
    ALTER TABLE usuarios
      DROP COLUMN IF EXISTS email_verified,
      DROP COLUMN IF EXISTS verification_token_hash,
      DROP COLUMN IF EXISTS verification_expires_at,
      DROP COLUMN IF EXISTS verification_code_hash,
      DROP COLUMN IF EXISTS verification_code_expires_at,
      DROP COLUMN IF EXISTS verification_attempts,
      DROP COLUMN IF EXISTS reset_token_hash,
      DROP COLUMN IF EXISTS reset_token_expires_at;
  `);
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query(`
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS verification_token_hash varchar(128),
      ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz,
      ADD COLUMN IF NOT EXISTS verification_code_hash varchar(64),
      ADD COLUMN IF NOT EXISTS verification_code_expires_at timestamptz,
      ADD COLUMN IF NOT EXISTS verification_attempts smallint NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS reset_token_hash varchar(128),
      ADD COLUMN IF NOT EXISTS reset_token_expires_at timestamptz;
  `);
}

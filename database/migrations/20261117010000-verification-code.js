// Verificação de e-mail por CÓDIGO de 6 dígitos no primeiro acesso (além do link).
export async function up(queryInterface) {
  await queryInterface.sequelize.query(`
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS verification_code_hash varchar(64),
      ADD COLUMN IF NOT EXISTS verification_code_expires_at timestamptz;
  `);
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query(`
    ALTER TABLE usuarios
      DROP COLUMN IF EXISTS verification_code_hash,
      DROP COLUMN IF EXISTS verification_code_expires_at;
  `);
}

// Limite de tentativas do código de 6 dígitos: após N erros o código é invalidado
// e o usuário precisa pedir um novo (defesa contra força bruta online além do rate-limit por IP).
export async function up(queryInterface) {
  await queryInterface.sequelize.query(`
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS verification_attempts smallint NOT NULL DEFAULT 0;
  `);
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query(`
    ALTER TABLE usuarios
      DROP COLUMN IF EXISTS verification_attempts;
  `);
}

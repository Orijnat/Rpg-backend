// Fecha a lacuna banco.sql (sem `cenario`) × banco_v2.sql (com `cenario`):
// instalações incrementais nunca ganhavam a coluna e o modelo a descartava silenciosamente.
export async function up(queryInterface) {
  await queryInterface.sequelize.query(
    "ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS cenario varchar(120);",
  );
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query("ALTER TABLE campanhas DROP COLUMN IF EXISTS cenario;");
}

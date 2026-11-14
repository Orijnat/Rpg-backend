// Índices de reforço para consultas quentes (notas privadas, encontros ativos, iniciativa única).
export async function up(queryInterface) {
  const sequelize = queryInterface.sequelize;
  // Notas privadas por campanha e mais recentes
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS anotacoes_campanha_privada_idx
      ON anotacoes (campanha_id, updated_at DESC) WHERE privada = true;
  `);
  // Encontro ativo atual por campanha
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS encontros_campanha_ativo_idx
      ON encontros (campanha_id, updated_at DESC) WHERE ativo = true;
  `);
  // Uma iniciativa por combatente por encontro (personagem ou NPC)
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS iniciativas_encontro_personagem_unico
      ON iniciativas (encontro_id, personagem_id) WHERE personagem_id IS NOT NULL;
  `);
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS iniciativas_encontro_npc_unico
      ON iniciativas (encontro_id, npc_id) WHERE npc_id IS NOT NULL;
  `);
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query("DROP INDEX IF EXISTS anotacoes_campanha_privada_idx;");
  await queryInterface.sequelize.query("DROP INDEX IF EXISTS encontros_campanha_ativo_idx;");
  await queryInterface.sequelize.query("DROP INDEX IF EXISTS iniciativas_encontro_personagem_unico;");
  await queryInterface.sequelize.query("DROP INDEX IF EXISTS iniciativas_encontro_npc_unico;");
}

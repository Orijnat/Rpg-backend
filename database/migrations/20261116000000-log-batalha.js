// Log persistente de batalha (ações de jogadores e mestre durante encontros).
export async function up(queryInterface) {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS log_batalha (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      encontro_id uuid NOT NULL REFERENCES encontros(id) ON DELETE CASCADE,
      campanha_id uuid NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
      usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
      autor varchar(160) NOT NULL,
      papel varchar(20) NOT NULL DEFAULT 'jogador' CHECK (papel IN ('mestre', 'jogador', 'sistema')),
      tipo varchar(40) NOT NULL CHECK (tipo IN ('rolagem', 'dano', 'cura', 'iniciativa', 'condicao', 'turno', 'entrada', 'encontro', 'recursos', 'sistema')),
      mensagem varchar(500) NOT NULL,
      dados jsonb NOT NULL DEFAULT '{}'::jsonb,
      rodada integer CHECK (rodada IS NULL OR (rodada >= 1 AND rodada <= 9999)),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS log_batalha_encontro_idx ON log_batalha (encontro_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS log_batalha_campanha_idx ON log_batalha (campanha_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS log_batalha_usuario_idx ON log_batalha (usuario_id, created_at DESC);
  `);
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query("DROP TABLE IF EXISTS log_batalha;");
}

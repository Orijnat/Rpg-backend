// Mapa tático compartilhado por campanha (miniaturas de heróis/monstros + fundo personalizável).
export async function up(queryInterface) {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS mapa_tatico (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      campanha_id uuid NOT NULL UNIQUE REFERENCES campanhas(id) ON DELETE CASCADE,
      titulo varchar(120) NOT NULL DEFAULT 'Campo de Batalha',
      arquivo_fundo_id uuid REFERENCES arquivos(id) ON DELETE SET NULL,
      url_fundo text,
      grade_px smallint NOT NULL DEFAULT 40 CHECK (grade_px BETWEEN 10 AND 200),
      grade_visivel boolean NOT NULL DEFAULT true,
      tokens jsonb NOT NULL DEFAULT '[]'::jsonb,
      updated_por_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS mapa_tatico_campanha_idx ON mapa_tatico (campanha_id);
  `);
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query("DROP TABLE IF EXISTS mapa_tatico;");
}

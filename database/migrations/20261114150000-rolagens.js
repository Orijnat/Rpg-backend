// Histórico de rolagens persistidas (escopo por campanha/ficha, autor da sessão).
export async function up(queryInterface) {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS rolagens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      personagem_id uuid REFERENCES personagens(id) ON DELETE CASCADE,
      campanha_id uuid REFERENCES campanhas(id) ON DELETE CASCADE,
      encontro_id uuid REFERENCES encontros(id) ON DELETE SET NULL,
      formula varchar(60) NOT NULL,
      expressao varchar(255),
      resultados jsonb NOT NULL DEFAULT '[]'::jsonb,
      kept integer,
      modifier integer NOT NULL DEFAULT 0,
      total integer NOT NULL,
      modo varchar(15) NOT NULL DEFAULT 'normal' CHECK (modo IN ('normal', 'advantage', 'disadvantage')),
      critico boolean NOT NULL DEFAULT false,
      falha_critica boolean NOT NULL DEFAULT false,
      contexto varchar(80),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS rolagens_personagem_idx ON rolagens (personagem_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS rolagens_campanha_idx ON rolagens (campanha_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS rolagens_usuario_idx ON rolagens (usuario_id, created_at DESC);
  `);
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query("DROP TABLE IF EXISTS rolagens;");
}

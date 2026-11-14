// Arquivos enviados (uploads): metadados no banco, bytes fora do público,
// nomes internos aleatórios, vínculo com proprietário/campanha/personagem.
export async function up(queryInterface) {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS arquivos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      personagem_id uuid REFERENCES personagens(id) ON DELETE SET NULL,
      campanha_id uuid REFERENCES campanhas(id) ON DELETE CASCADE,
      encontro_id uuid REFERENCES encontros(id) ON DELETE SET NULL,
      nome_original varchar(255) NOT NULL,
      nome_interno varchar(64) NOT NULL UNIQUE,
      mime_type varchar(100) NOT NULL,
      tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes >= 0),
      hash_sha256 varchar(64) NOT NULL,
      contexto varchar(80) NOT NULL DEFAULT 'anotacao',
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS arquivos_usuario_idx ON arquivos (usuario_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS arquivos_campanha_idx ON arquivos (campanha_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS arquivos_personagem_idx ON arquivos (personagem_id, created_at DESC);
  `);
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query("DROP TABLE IF EXISTS arquivos;");
}

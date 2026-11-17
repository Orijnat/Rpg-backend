// Tabela de raças clássicas + vínculo da ficha com a raça via FK.
// `racas` é a fonte de verdade (8 raças D&D, status base e dado de vida).
// `personagens.raca_id` aponta para `racas.id`; `dados_extras->>race` guarda
// o slug por compatibilidade retroativa com fichas salvas antes da FK.
export async function up(queryInterface) {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS racas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug varchar(40) NOT NULL UNIQUE,
      nome varchar(80) NOT NULL,
      dado_de_vida varchar(10) NOT NULL,
      forca smallint NOT NULL DEFAULT 10 CHECK (forca BETWEEN 1 AND 30),
      destreza smallint NOT NULL DEFAULT 10 CHECK (destreza BETWEEN 1 AND 30),
      constituicao smallint NOT NULL DEFAULT 10 CHECK (constituicao BETWEEN 1 AND 30),
      sabedoria smallint NOT NULL DEFAULT 10 CHECK (sabedoria BETWEEN 1 AND 30),
      espirito smallint NOT NULL DEFAULT 10 CHECK (espirito BETWEEN 1 AND 30),
      carisma smallint NOT NULL DEFAULT 10 CHECK (carisma BETWEEN 1 AND 30),
      inteligencia smallint NOT NULL DEFAULT 10 CHECK (inteligencia BETWEEN 1 AND 30),
      traco text,
      ordem int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS racas_slug_idx ON racas (slug);
    CREATE INDEX IF NOT EXISTS racas_ordem_idx ON racas (ordem, nome);

    INSERT INTO racas (slug, nome, dado_de_vida, forca, destreza, constituicao, sabedoria, espirito, carisma, inteligencia, traco, ordem)
    VALUES
      ('humano',   'Humano',   '1d8',  12, 12, 12, 12, 12, 12, 10, 'Versátil — linhagem equilibrada.', 10),
      ('elfo',     'Elfo',     '1d8',  10, 15, 10, 12, 13, 10, 12, 'Visão no Escuro · Sentidos Aguçados.', 20),
      ('anao',     'Anão',     '1d10', 14,  9, 15, 12, 11, 10, 11, 'Resistência Anã.', 30),
      ('halfling', 'Halfling', '1d6',  10, 14, 11, 13, 12, 13,  9, 'Sortudo.', 40),
      ('draconato','Draconato','1d10', 14, 10, 13, 10, 10, 15, 10, 'Sopro Dracônico.', 50),
      ('gnomo',    'Gnomo',    '1d6',   8, 11, 13, 10, 11, 13, 16, 'Astúcia Gnômica.', 60),
      ('tiefling', 'Tiefling', '1d8',  10, 10, 11,  9, 10, 17, 15, 'Legado Abissal.', 70),
      ('orc',      'Orc',      '1d12', 15, 12, 13, 10, 11, 10, 10, 'Vigor Selvagem.', 80)
    ON CONFLICT (slug) DO UPDATE SET
      nome = EXCLUDED.nome,
      dado_de_vida = EXCLUDED.dado_de_vida,
      forca = EXCLUDED.forca,
      destreza = EXCLUDED.destreza,
      constituicao = EXCLUDED.constituicao,
      sabedoria = EXCLUDED.sabedoria,
      espirito = EXCLUDED.espirito,
      carisma = EXCLUDED.carisma,
      inteligencia = EXCLUDED.inteligencia,
      traco = EXCLUDED.traco,
      ordem = EXCLUDED.ordem,
      updated_at = CURRENT_TIMESTAMP;

    ALTER TABLE personagens
      ADD COLUMN IF NOT EXISTS raca_id uuid REFERENCES racas(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS personagens_raca_id_idx ON personagens (raca_id);

    -- Backfill: vincula fichas antigas pelo slug salvo em dados_extras->>race
    UPDATE personagens p
    SET raca_id = r.id
    FROM racas r
    WHERE p.raca_id IS NULL
      AND lower(btrim(p.dados_extras->>'race')) = r.slug;

    ALTER TABLE public.racas ENABLE ROW LEVEL SECURITY;
  `);
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query(`
    ALTER TABLE personagens DROP COLUMN IF EXISTS raca_id;
    DROP TABLE IF EXISTS racas;
  `);
}

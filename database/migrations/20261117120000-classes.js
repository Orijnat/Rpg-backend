// Catálogo global de Classes do Grimorium RPG (mestre cria/edita; qualquer mestre pode editar).
// A classe é a fonte de verdade das HABILIDADES DE NÍVEL (fixas por classe, referência dinâmica)
// e do DADO DE VIDA (a raça deixa de definir o dado de vida).
// `classes` guarda o catálogo; `classe_habilidades` guarda as habilidades de nível por classe/nível;
// `personagens.classe_id` vincula a ficha à classe (ON DELETE SET NULL).
export async function up(queryInterface) {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS classes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug varchar(60) NOT NULL UNIQUE,
      nome varchar(80) NOT NULL,
      dado_de_vida varchar(10) NOT NULL,
      atributo_primario varchar(3),
      atributo_secundario varchar(3),
      descricao text,
      ordem int NOT NULL DEFAULT 0,
      criado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS classes_slug_idx ON classes (slug);
    CREATE INDEX IF NOT EXISTS classes_ordem_idx ON classes (ordem, nome);

    INSERT INTO classes (slug, nome, dado_de_vida, atributo_primario, atributo_secundario, descricao, ordem)
    VALUES
      ('bruxeiro',  'Bruxeiro',  '1d10', 'ESP', 'SAB', 'Caçador de monstros guiado pelos Sinais e pela lâmina de prata.', 10),
      ('guerreiro', 'Guerreiro', '1d10', 'FOR', 'CON', 'Mestre de armas, escudos e tática de combate frontal.', 20),
      ('barbaro',   'Bárbaro',   '1d12', 'CON', 'FOR', 'Fúria primal que despreza a dor e o aço adversário.', 30),
      ('ladino',    'Ladino',    '1d8',  'DES', 'CAR', 'Sombras, fechaduras e oportunidade onde outros veem só parede.', 40),
      ('ranger',    'Ranger',    '1d10', 'DES', 'SAB', 'Caçador silencioso dos ermos, rastreador e arqueiro de escol.', 50),
      ('mago',      'Mago',      '1d6',  'INT', 'ESP', 'Estudioso dos arcanos; o conhecimento pesa mais que aço.', 60),
      ('clerigo',   'Clérigo',   '1d8',  'CAR', 'ESP', 'Canais da vontade divina; cura, proteção e julgamento.', 70),
      ('bardo',     'Bardo',     '1d8',  'CAR', 'INT', 'Palavras e música que inspiram ou despedaçam a coragem.', 80)
    ON CONFLICT (slug) DO UPDATE SET
      nome = EXCLUDED.nome,
      dado_de_vida = EXCLUDED.dado_de_vida,
      atributo_primario = EXCLUDED.atributo_primario,
      atributo_secundario = EXCLUDED.atributo_secundario,
      descricao = EXCLUDED.descricao,
      ordem = EXCLUDED.ordem,
      updated_at = CURRENT_TIMESTAMP;

    CREATE TABLE IF NOT EXISTS classe_habilidades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      classe_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      nivel smallint NOT NULL CHECK (nivel BETWEEN 1 AND 20),
      nome varchar(120) NOT NULL,
      tipo varchar(20) NOT NULL DEFAULT 'ativa',
      custo varchar(60) NOT NULL DEFAULT '',
      atributo varchar(3) NOT NULL DEFAULT 'ESP',
      formula varchar(120) NOT NULL DEFAULT '',
      dano_tipo varchar(60) NOT NULL DEFAULT '',
      alcance varchar(120) NOT NULL DEFAULT '',
      descricao text,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS classe_habilidades_classe_nivel_idx ON classe_habilidades (classe_id, nivel);

    ALTER TABLE personagens
      ADD COLUMN IF NOT EXISTS classe_id uuid REFERENCES classes(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS personagens_classe_id_idx ON personagens (classe_id);

    -- Backfill: vincula fichas antigas pela ocupação/classe livre digitada no cadastro
    -- (match exato sem acento e sem caixa, contra slug e nome do catálogo — determinístico).
    UPDATE personagens p
    SET classe_id = c.id
    FROM classes c
    WHERE p.classe_id IS NULL
      AND translate(lower(btrim(COALESCE(p.classe, ''))), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') IN (
        translate(lower(btrim(c.slug)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc'),
        translate(lower(btrim(c.nome)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')
      );

    ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.classe_habilidades ENABLE ROW LEVEL SECURITY;
  `);
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query(`
    ALTER TABLE personagens DROP COLUMN IF EXISTS classe_id;
    DROP TABLE IF EXISTS classe_habilidades;
    DROP TABLE IF EXISTS classes;
  `);
}

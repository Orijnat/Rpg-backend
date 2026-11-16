// Mercado do Mundo (catálogo gerenciado pelo mestre): vendedores e itens.
// Tabelas por mestre (criado_por_id), sem FKs entre itens e vendedores — o
// formulário permite vendedor customizado em texto livre (igual ao formato antigo).
export async function up(queryInterface) {
  await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS mercado_vendedores (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      criado_por_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      nome varchar(160) NOT NULL,
      titulo varchar(160),
      regiao varchar(160) NOT NULL,
      humor text,
      especialidade varchar(200),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mercado_itens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      criado_por_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      nome varchar(160) NOT NULL,
      regiao varchar(160) NOT NULL,
      vendedor varchar(160) NOT NULL,
      tipo varchar(80) NOT NULL,
      quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade >= 0),
      preco numeric(10,2) NOT NULL DEFAULT 0 CHECK (preco >= 0),
      moeda varchar(10) NOT NULL DEFAULT 'ouro' CHECK (moeda IN ('ouro', 'prata', 'cobre', 'latina')),
      peso numeric(8,2) NOT NULL DEFAULT 0 CHECK (peso >= 0),
      raridade varchar(20) NOT NULL DEFAULT 'Comum'
        CHECK (raridade IN ('Comum', 'Incomum', 'Raro', 'Muito Raro', 'Lendário')),
      descricao text,
      requisitos text,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS mercado_vendedores_criado_por_idx ON mercado_vendedores (criado_por_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS mercado_itens_criado_por_idx ON mercado_itens (criado_por_id, updated_at DESC);

    -- RLS habilitado (backend Express conecta como role postgres, que ignora RLS)
    ALTER TABLE public.mercado_vendedores ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.mercado_itens ENABLE ROW LEVEL SECURITY;
  `);
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query("DROP TABLE IF EXISTS mercado_itens");
  await queryInterface.sequelize.query("DROP TABLE IF EXISTS mercado_vendedores");
}

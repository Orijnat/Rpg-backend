// Migração de dados: montarias que viviam em personagens.dados_extras.mounts (JSONB)
// passam a ser linhas na tabela `montarias` (criada no baseline, nunca usada).
// Idempotente por ficha: fichas que já têm linhas em montarias são ignoradas.
// O JSON de origem é PRESERVADO (dados_extras->'mounts' não é removido nesta migração).

export async function up(queryInterface) {
  const sequelize = queryInterface.sequelize;
  await sequelize.query(`
    INSERT INTO montarias (personagem_id, nome, especie, descricao, pontos_vida, pontos_vida_maximo, dados_extras, created_at, updated_at)
    SELECT
      p.id,
      COALESCE(NULLIF(btrim(m->>'name'), ''), 'Montaria'),
      NULLIF(btrim(COALESCE(m->>'species', '')), ''),
      COALESCE(m->>'notes', ''),
      LEAST(GREATEST(0, COALESCE((m->>'hp')::int, 20)), GREATEST(1, COALESCE((m->>'hpMax')::int, 20))),
      GREATEST(1, COALESCE((m->>'hpMax')::int, 20)),
      jsonb_strip_nulls(jsonb_build_object(
        'attributes', COALESCE(m->'attributes', '{"FOR":10,"DES":10,"CON":10,"SAB":10,"ESP":10,"CAR":10,"INT":10}'::jsonb),
        'alive', COALESCE((m->>'alive')::boolean, TRUE),
        'notes', COALESCE(m->>'notes', ''),
        'legadoId', m->>'id'
      )),
      now(),
      now()
    FROM personagens p,
         jsonb_array_elements(COALESCE(p.dados_extras->'mounts', '[]'::jsonb)) AS m
    WHERE jsonb_typeof(p.dados_extras->'mounts') = 'array'
      AND NOT EXISTS (SELECT 1 FROM montarias x WHERE x.personagem_id = p.id);
  `);
}

export async function down(queryInterface) {
  const sequelize = queryInterface.sequelize;
  // Remove apenas as linhas migradas (identificadas por dados_extras.legadoId).
  await sequelize.query(`
    DELETE FROM montarias WHERE dados_extras ? 'legadoId';
  `);
}

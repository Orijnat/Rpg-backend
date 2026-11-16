// Ajustes apontados pelo linter/advisors do Supabase (schema public):
// 1) RLS habilitado nas tabelas que estavam sem ela (acesso via PostgREST com a chave anon
//    bloqueado; o backend Express conecta como role postgres, que ignora RLS).
// 2) Índices de cobertura para FKs de tabelas da aplicação (auth.*/storage.* são gerenciados
//    pelo Supabase e não são tocadas aqui).
// 3) Índices exatamente duplicados removidos (o backend não os referencia pelo nome).

export async function up(queryInterface) {
  const sequelize = queryInterface.sequelize;

  // 1) RLS: tabelas públicas sem Row Level Security
  for (const tabela of ["arquivos", "log_batalha", "mapa_tatico", "rolagens", "sequelize_meta"]) {
    await sequelize.query(`ALTER TABLE public.${tabela} ENABLE ROW LEVEL SECURITY`);
  }

  // 2) Índices de cobertura para FKs da aplicação
  const fkIndexes = [
    ["contratos_campanha_idx", "contratos", "campanha_id"],
    ["anotacoes_personagem_idx", "anotacoes", "personagem_id"],
    ["imagens_proprietario_idx", "imagens", "proprietario_id"],
    ["npcs_criado_por_idx", "npcs", "criado_por_id"],
    ["encontros_criado_por_idx", "encontros", "criado_por_id"],
    ["iniciativas_npc_idx", "iniciativas", "npc_id"],
    ["iniciativas_personagem_idx", "iniciativas", "personagem_id"],
    ["recursos_campanha_criado_por_idx", "recursos_campanha", "criado_por_id"],
    ["sessoes_jogo_criado_por_idx", "sessoes_jogo", "criado_por_id"],
    ["rolagens_encontro_idx", "rolagens", "encontro_id"],
    ["arquivos_encontro_idx", "arquivos", "encontro_id"],
    ["mapa_tatico_arquivo_fundo_idx", "mapa_tatico", "arquivo_fundo_id"],
    ["mapa_tatico_updated_por_idx", "mapa_tatico", "updated_por_id"],
  ];
  for (const [nome, tabela, coluna] of fkIndexes) {
    await sequelize.query(`CREATE INDEX IF NOT EXISTS ${nome} ON public.${tabela} (${coluna})`);
  }

  // 3) Índices exatamente duplicados (definições idênticas; nada depende deles pelo nome)
  await sequelize.query("DROP INDEX IF EXISTS public.auditoria_usuario_idx");      // idêntico a auditoria_usuario_data_idx
  await sequelize.query("DROP INDEX IF EXISTS public.auditoria_campanha_idx");     // idêntico a auditoria_campanha_data_idx
  await sequelize.query("DROP INDEX IF EXISTS public.mapa_tatico_campanha_idx");   // coberto por mapa_tatico_campanha_id_key (UNIQUE, constraint)
  await sequelize.query("DROP INDEX IF EXISTS public.sessoes_jogo_campanha_idx");  // coberto por sessoes_jogo_campanha_numero_unico (UNIQUE, constraint)
}

export async function down(queryInterface) {
  const sequelize = queryInterface.sequelize;

  // Restaura os índices duplicados (mantendo os sufixados _data_/UNIQUE como no schema original)
  await sequelize.query("CREATE INDEX IF NOT EXISTS auditoria_usuario_idx ON public.auditoria (usuario_id, created_at DESC)");
  await sequelize.query("CREATE INDEX IF NOT EXISTS auditoria_campanha_idx ON public.auditoria (campanha_id, created_at DESC)");
  await sequelize.query("CREATE INDEX IF NOT EXISTS mapa_tatico_campanha_idx ON public.mapa_tatico (campanha_id)");
  await sequelize.query("CREATE INDEX IF NOT EXISTS sessoes_jogo_campanha_idx ON public.sessoes_jogo (campanha_id, numero)");

  for (const nome of [
    "contratos_campanha_idx", "anotacoes_personagem_idx", "imagens_proprietario_idx",
    "npcs_criado_por_idx", "encontros_criado_por_idx", "iniciativas_npc_idx",
    "iniciativas_personagem_idx", "recursos_campanha_criado_por_idx", "sessoes_jogo_criado_por_idx",
    "rolagens_encontro_idx", "arquivos_encontro_idx",
    "mapa_tatico_arquivo_fundo_idx", "mapa_tatico_updated_por_idx",
  ]) {
    await sequelize.query(`DROP INDEX IF EXISTS ${nome}`);
  }

  for (const tabela of ["arquivos", "log_batalha", "mapa_tatico", "rolagens", "sequelize_meta"]) {
    await sequelize.query(`ALTER TABLE public.${tabela} DISABLE ROW LEVEL SECURITY`);
  }
}

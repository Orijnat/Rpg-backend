// CSV para importação direta no Google Sheets (Arquivo → Importar → Upload).
// Cada exportador é puro e testável; o controller só aplica autorização.

export function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows, { delimiter = ";" } = {}) {
  return rows.map((row) => row.map(csvEscape).join(delimiter)).join("\r\n");
}

export function characterToSheetRows(character) {
  const a = character?.atributos || {};
  const extras = character?.dadosExtras || {};
  const attr = (k, fallback = 10) => Number(character?.[k] ?? a?.[k] ?? extras?.[k] ?? fallback);
  const mod = (v) => Math.floor((Number(v || 10) - 10) / 2);
  const rows = [
    ["Grimorium RPG — Ficha de Personagem", ""],
    ["Nome", character?.name ?? ""],
    ["Classe / Ofício", character?.customClass || character?.job || ""],
    ["Nível", character?.level ?? 1],
    ["XP", character?.experiencia ?? character?.xp ?? 0],
    ["HP", `${character?.hp ?? 0}/${character?.hpMax ?? 0}`],
    ["PE", `${Number(extras.peCurrent ?? 0)}/${Number(extras.peMax ?? 0)}`],
    ["PV/BP", `${Number(extras.bpCurrent ?? 0)}/${Number(extras.bpMax ?? 0)}`],
    ["Insanidade", `${Number(extras.insanity ?? extras.insanityCurrent ?? 0)}/${Number(extras.insanityMax ?? 0)}`],
    ["CA", extras.armorClass ?? 10],
    ["Iniciativa", extras.initiative ?? 0],
    ["Dado de Vida", extras.hitDie || "1d10"],
    ["Moedas", [
      `latina:${Number(character?.latina ?? extras.moedas?.latina ?? extras.moedas?.platina ?? 0)}`,
      `ouro:${Number(character?.ouro ?? extras.moedas?.ouro ?? 0)}`,
      `prata:${Number(character?.prata ?? extras.moedas?.prata ?? 0)}`,
      `cobre:${Number(character?.cobre ?? extras.moedas?.cobre ?? 0)}`,
    ].join(" ")],
    [],
    ["Atributo", "Valor", "Modificador"],
    ...["FOR", "DES", "CON", "SAB", "ESP", "CAR", "INT"].map((k) => [k, attr(k), mod(attr(k)) >= 0 ? `+${mod(attr(k))}` : mod(attr(k))]),
    [],
    ["Perícia", "Treinada", "Bônus"],
  ];
  const skills = Array.isArray(character?.pericias) ? character.pericias : Array.isArray(character?.skills) ? character.skills : [];
  for (const skill of skills) {
    rows.push([skill?.name ?? "", skill?.trained ? "sim" : "não", skill?.bonus ?? ""]);
  }
  return rows;
}

export function npcToSheetRows(npcs) {
  const rows = [
    ["Grimorium RPG — Bestiário da Mesa", "", "", "", "", "", ""],
    ["Nome", "Papel", "PV", "CA", "Iniciativa", "Status", "Tags"],
  ];
  for (const npc of npcs || []) {
    const extras = npc?.dadosExtras || {};
    rows.push([
      npc?.nome ?? "",
      npc?.papel ?? "",
      `${npc?.hp ?? 0}/${npc?.hpMax ?? 0}`,
      extras.ca ?? "",
      extras.iniciativa ?? "",
      extras.status ?? "Ativo",
      Array.isArray(extras.tags) ? extras.tags.join(", ") : "",
    ]);
  }
  return rows;
}

export function campaignToSheetRows({ campanha, membros, personagens, contagens }) {
  const rows = [
    ["Grimorium RPG — Campanha", ""],
    ["Nome", campanha?.nome ?? ""],
    ["Cenário", campanha?.cenario ?? ""],
    ["Estado", campanha?.estado ?? ""],
    ["Código de convite", campanha?.codigoConvite ?? ""],
    ["Membros", membros?.length ?? 0],
    ["Heróis", personagens?.length ?? 0],
    ["NPCs", contagens?.npcs ?? 0],
    ["Encontros", contagens?.encontros ?? 0],
    [],
    ["Membro", "Papel", "Bloqueado"],
    ...(membros || []).map((m) => [m?.usuario?.username ?? m?.usuarioId ?? "", m?.papel ?? "jogador", m?.bloqueado ? "sim" : "não"]),
    [],
    ["Herói", "Nível", "Classe", "HP"],
    ...(personagens || []).map((c) => [c?.name ?? "", c?.level ?? 1, c?.customClass || c?.job || "", `${c?.hp ?? 0}/${c?.hpMax ?? 0}`]),
  ];
  return rows;
}

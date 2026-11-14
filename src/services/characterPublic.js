// Serialização canônica de personagens para a API (usada por /auth/me, /characters, /sync, login e register).
// Garante que atributos, perícias, inventário, moedas etc. estejam sempre no formato achatado consumido pelo frontend.

export const DEFAULT_ATRIBUTOS = {
  forca: 10, destreza: 10, constituicao: 10,
  sabedoria: 10, espirito: 10, carisma: 10, inteligencia: 10,
};

export function atributosFromPayload(payload) {
  return {
    forca:        payload.FOR ?? payload.forca        ?? DEFAULT_ATRIBUTOS.forca,
    destreza:     payload.DES ?? payload.destreza     ?? DEFAULT_ATRIBUTOS.destreza,
    constituicao: payload.CON ?? payload.constituicao ?? DEFAULT_ATRIBUTOS.constituicao,
    sabedoria:    payload.SAB ?? payload.sabedoria     ?? DEFAULT_ATRIBUTOS.sabedoria,
    espirito:     payload.ESP ?? payload.espirito      ?? DEFAULT_ATRIBUTOS.espirito,
    carisma:      payload.CAR ?? payload.carisma       ?? DEFAULT_ATRIBUTOS.carisma,
    inteligencia: payload.INT ?? payload.inteligencia  ?? DEFAULT_ATRIBUTOS.inteligencia,
  };
}

export function atributosToPublic(atributos) {
  if (!atributos) return DEFAULT_ATRIBUTOS;
  const a = atributos.toJSON ? atributos.toJSON() : atributos;
  return {
    forca: a.forca, destreza: a.destreza, constituicao: a.constituicao,
    sabedoria: a.sabedoria, espirito: a.espirito, carisma: a.carisma,
    inteligencia: a.inteligencia,
    // aliases abreviados consumidos pelo frontend
    FOR: a.forca, DES: a.destreza, CON: a.constituicao,
    SAB: a.sabedoria, ESP: a.espirito, CAR: a.carisma, INT: a.inteligencia,
  };
}

export function publicCharacter(character) {
  const data = character.toJSON ? character.toJSON() : { ...character };
  const extras = data.dadosExtras || {};

  // Atributos: vêm de `atributos` (associação) ou fallback em dadosExtras
  const atributos = data.atributos
    ? atributosToPublic(data.atributos)
    : {
        forca: extras.forca ?? 10, destreza: extras.destreza ?? 10,
        constituicao: extras.constituicao ?? 10, sabedoria: extras.sabedoria ?? 10,
        espirito: extras.espirito ?? 10, carisma: extras.carisma ?? 10,
        inteligencia: extras.inteligencia ?? 10,
        FOR: extras.FOR ?? extras.forca ?? 10, DES: extras.DES ?? extras.destreza ?? 10,
        CON: extras.CON ?? extras.constituicao ?? 10, SAB: extras.SAB ?? extras.sabedoria ?? 10,
        ESP: extras.ESP ?? extras.espirito ?? 10, CAR: extras.CAR ?? extras.carisma ?? 10,
        INT: extras.INT ?? extras.inteligencia ?? 10,
      };

  Object.assign(data, atributos);

  // Campos legados vivendo em dados_extras
  const preferArray = (a, b) => (Array.isArray(a) && a.length > 0 ? a : Array.isArray(b) ? b : []);
  data.pericias        = preferArray(extras.pericias, extras.skills);
  data.skills          = data.pericias;
  data.itensInventario = preferArray(extras.itensInventario, extras.inventory);
  data.inventory       = data.itensInventario;
  data.contratosDados  = preferArray(extras.contratosDados, extras.contracts);
  data.contracts       = data.contratosDados;
  data.jogadores       = extras.jogadores || [];
  data.npcs            = extras.npcs || [];
  data.imagensAnotacoes = extras.imagensAnotacoes ?? extras.notesImages ?? [];
  data.notesImages     = data.imagensAnotacoes;
  data.customClass     = extras.customClass ?? "";
  data.bankSlots       = extras.bankSlots ?? Array.from({ length: 80 }, () => ({ item: "" }));
  data.notes           = extras.notes ?? "";
  data.roomNotes       = extras.roomNotes ?? "";
  data.mountName       = extras.mountName ?? "";
  data.mountHP         = extras.mountHP ?? 20;
  data.mountHPMax      = extras.mountHPMax ?? 20;
  data.mountNotes      = extras.mountNotes ?? "";
  data.peMax           = extras.peMax ?? 0;
  data.pe              = extras.pe ?? 0;
  data.peCurrent       = extras.peCurrent ?? extras.pe ?? 0;
  data.insanityMax     = extras.insanityMax ?? 0;
  data.insanity        = extras.insanity ?? 0;
  data.insanityCurrent = extras.insanityCurrent ?? extras.insanity ?? 0;
  data.bpMax           = extras.bpMax ?? 0;
  data.bp              = extras.bp ?? 0;
  data.bpCurrent       = extras.bpCurrent ?? extras.bp ?? 0;
  data.armorClass      = extras.armorClass ?? 10;
  data.initiative      = extras.initiative ?? 0;
  data.hitDie          = extras.hitDie ?? "d8";
  data.xp              = Number(data.experiencia ?? extras.xp ?? 0) || 0;

  // Moedas
  const moedas = extras.moedas || extras.currencies || {};
  data.latina  = extras.latina  ?? moedas.latina  ?? moedas.platina ?? 0;
  data.ouro    = extras.ouro    ?? moedas.ouro    ?? 0;
  data.prata   = extras.prata   ?? moedas.prata   ?? 0;
  data.cobre   = extras.cobre   ?? moedas.cobre   ?? 0;
  data.moedas  = { latina: data.latina, ouro: data.ouro, prata: data.prata, cobre: data.cobre };
  data.currencies = data.moedas;

  if (data.user) {
    data.owner = {
      id: data.user.id, username: data.user.username,
      email: data.user.email, perfil: data.user.perfil,
    };
  }

  delete data.bankPassword;
  return data;
}

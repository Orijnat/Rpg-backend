import { z } from "zod";

const texto = (max) => z.string().trim().max(max);
const numero = z.number().finite();
const json = z.unknown();
const atributo = numero.int().min(1).max(30);

export const registroSchema = z.object({
  username: texto(120).min(1),
  email: z.string().trim().email().max(320),
  password: z.string().min(6).max(128),
  characterName: texto(160).max(160).optional(),
  characterJob: texto(100).max(100).optional(),
  customClass: texto(100).max(100).optional(),
  perfil: z.enum(["jogador", "mestre"]).optional(),
  role: z.enum(["player", "master"]).optional(),
  inviteCode: texto(40).optional(),
  codigoConvite: texto(40).optional(),
}).strict();

export const loginSchema = z.object({
  login: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(128),
}).strict();

export const verificarEmailSchema = z.object({
  token: z.string().trim().min(16).max(256),
}).strict();

export const reenviarVerificacaoSchema = z.object({
  email: z.string().trim().email().max(320),
}).strict();

export const pedidoRedefinicaoSchema = z.object({
  email: z.string().trim().email().max(320),
}).strict();

export const redefinirSenhaSchema = z.object({
  token: z.string().trim().min(16).max(256),
  password: z.string().min(6).max(128),
}).strict();

export const tokenMapaSchema = z.object({
  id: z.string().min(1).max(64),
  tipo: z.enum(["personagem", "npc", "monstro", "efeito"]),
  refId: z.string().uuid().nullable().optional(),
  name: texto(120).min(1),
  x: numero.min(0).max(1),
  y: numero.min(0).max(1),
  tamanho: z.enum(["P", "M", "G", "E"]).optional(),
  hp: numero.int().min(0).nullable().optional(),
  hpMax: numero.int().min(0).nullable().optional(),
  oculto: z.boolean().optional(),
});

export const mapaTaticoPatchSchema = z.object({
  titulo: texto(120).min(1).optional(),
  arquivoFundoId: z.string().uuid().nullable().optional(),
  urlFundo: z.string().max(2048).nullable().optional(),
  gradePx: numero.int().min(10).max(200).optional(),
  gradeVisivel: z.boolean().optional(),
  tokens: z.array(tokenMapaSchema).max(200).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo do mapa." });

export const rolagemSchema = z.object({
  formula: texto(60).min(1),
  expressao: texto(255).optional(),
  resultados: z.array(json).max(100).optional(),
  kept: numero.int().optional(),
  modifier: numero.int().optional(),
  total: numero.int().min(-100000).max(100000),
  modo: z.enum(["normal", "advantage", "disadvantage"]).optional(),
  critico: z.boolean().optional(),
  falhaCritica: z.boolean().optional(),
  contexto: texto(80).optional(),
  personagemId: z.string().uuid().nullable().optional(),
  campanhaId: z.string().uuid().nullable().optional(),
  encontroId: z.string().uuid().nullable().optional(),
}).refine((value) => value.total !== undefined, { message: "Total da rolagem é obrigatório." });

const camposFicha = {
  id: z.string().uuid().optional(),
  campanhaId: z.string().uuid().nullable().optional(),
  name: texto(160).optional(),
  descricao: z.string().max(10000).nullable().optional(),
  hp: numero.int().min(0).max(9999).optional(),
  hpMax: numero.int().min(1).max(9999).optional(),
  level: numero.int().min(1).max(30).optional(),
  job: texto(100).optional(),
  experiencia: numero.int().min(0).max(999999).optional(),
  forca: atributo.optional(),
  destreza: atributo.optional(),
  constituicao: atributo.optional(),
  sabedoria: atributo.optional(),
  espirito: atributo.optional(),
  carisma: atributo.optional(),
  inteligencia: atributo.optional(),
  age: texto(80).optional(), eyes: texto(80).optional(),
  height: texto(40).optional(), skin: texto(80).optional(),
  weight: texto(40).optional(), hair: texto(80).optional(),
  appearance: texto(10000).optional(),
  attributes: z.record(z.string(), numero).optional(),
  skills: z.array(json).max(500).optional(),
  pericias: z.array(json).max(500).optional(),
  currencies: z.record(z.string(), numero).optional(),
  moedas: z.record(z.string(), numero).optional(),
  latina: numero.min(0).max(999999999).optional(), ouro: numero.min(0).max(999999999).optional(),
  prata: numero.min(0).max(999999999).optional(), cobre: numero.min(0).max(999999999).optional(),
  itensInventario: z.array(json).max(1000).optional(),
  contratosDados: z.array(json).max(500).optional(),
  jogadores: z.array(json).max(500).optional(),
  npcs: z.array(json).max(500).optional(),
  bankSlots: z.array(json).max(80).optional(),
  notes: z.string().max(50000).optional(),
  imagensAnotacoes: z.array(json).max(500).optional(),
  roomNotes: z.string().max(50000).optional(),
  mountName: texto(100).optional(), mountHP: numero.int().min(0).optional(),
  mountHPMax: numero.int().min(0).optional(), mountNotes: z.string().max(10000).optional(),
  dadosExtras: z.record(z.string(), json).optional(),
  FOR: atributo.optional(), DES: atributo.optional(),
  CON: atributo.optional(), SAB: atributo.optional(),
  ESP: atributo.optional(), CAR: atributo.optional(),
  INT: atributo.optional(),
  inventory: z.array(json).max(1000).optional(), contracts: z.array(json).max(500).optional(),
  players: z.array(json).max(500).optional(), notesImages: z.array(json).max(500).optional(),
  customClass: texto(100).optional(),
  xp: numero.int().min(0).optional(),
  pe: numero.min(0).optional(),
  peMax: numero.min(0).optional(),
  peCurrent: numero.min(0).optional(),
  insanity: numero.min(0).optional(),
  insanityMax: numero.min(0).optional(),
  insanityCurrent: numero.min(0).optional(),
  bp: numero.min(0).optional(),
  bpMax: numero.min(0).optional(),
  bpCurrent: numero.min(0).optional(),
  armorClass: numero.min(0).optional(),
  initiative: numero.int().optional(),
  hitDie: texto(20).optional(),
  // Concorrência otimista (sync): versão remota vista pelo cliente + override explícito.
  // Não são persistidos na ficha — ver normalizeCharacterPayload.
  updatedAt: z.string().max(40).optional(),
  force: z.boolean().optional(),
};

export const fichaSchema = z.object(camposFicha);
export const sincronizacaoSchema = fichaSchema;
export const senhaCofreSchema = z.object({
  password: z.string().max(128),
}).strict();

export const campanhaSchema = z.object({
  nome: texto(120).min(1).optional(),
  descricao: z.string().max(20000).optional(),
  cenario: texto(100).optional(),
  estado: z.enum(["planejamento", "ativa", "pausada", "encerrada"]).optional(),
  codigoConvite: texto(20).optional(),
  dadosExtras: z.record(z.string(), json).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "Informe ao menos um campo da campanha.",
});

export const conviteSchema = z.object({
  inviteCode: texto(20).min(1),
}).strict();

export const membroSchema = z.object({
  papel: z.enum(["jogador", "mestre", "observador"]).optional(),
  bloqueado: z.boolean().optional(),
}).strict();

export const notaSchema = z.object({
  titulo: texto(150).min(1).optional(),
  conteudo: z.string().max(100000).optional(),
  tipo: z.enum(["diario", "anotacao", "handout"]).optional(),
  privada: z.boolean().optional(),
  is_private: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "Informe ao menos um campo da nota.",
});

export const npcSchema = z.object({
  nome: texto(120).min(1).optional(),
  papel: texto(80).optional(),
  hp: numero.int().min(0).optional(),
  hpMax: numero.int().min(0).optional(),
  ca: numero.int().min(0).max(100).optional(),
  iniciativa: numero.int().optional(),
  attitude: z.enum(["Aliado", "Neutro", "Hostil", "Chefe"]).optional(),
  status: z.enum(["Ativo", "Inconsciente", "Derrotado", "Fugiu"]).optional(),
  tags: z.array(texto(50)).max(50).optional(),
  avatar: texto(255).optional(),
  acoes: z.array(json).max(100).optional(),
  habilidadesEspeciais: z.array(json).max(100).optional(),
  notasMestre: z.string().max(100000).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "Informe ao menos um campo do NPC.",
});

export const encontroSchema = z.object({
  nome: texto(120).min(1).optional(),
  tipo: z.enum(["combate", "social", "exploracao", "outro"]).optional(),
  ativo: z.boolean().optional(),
  inimigos: z.array(json).max(500).optional(),
  recursos: z.record(z.string(), json).optional(),
  dadosExtras: z.record(z.string(), json).optional(),
  novoEventoLog: z.string().max(1000).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "Informe ao menos um campo do encontro.",
});

export const sessaoSchema = z.object({
  titulo: texto(200).min(1).optional(),
  numero: numero.int().min(1).optional(),
  estado: z.enum(["planejada", "em_andamento", "concluida", "cancelada"]).optional(),
  dataAgendada: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, "Use YYYY-MM-DD ou ISO datetime").nullable().optional(),
  resumo: z.string().max(100000).optional(),
  cenas: z.array(json).max(500).optional(),
  objetivos: z.array(json).max(500).optional(),
  recompensas: z.record(z.string(), json).optional(),
  novoEvento: texto(1000).optional(),
  dadosExtras: z.record(z.string(), json).optional(),
  confirmacao: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "Informe ao menos um campo da sessão.",
});

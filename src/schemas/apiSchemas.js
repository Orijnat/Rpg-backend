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
}).strict();

export const loginSchema = z.object({
  login: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(128),
}).strict();

const camposFicha = {
  id: z.string().uuid().optional(),
  campanhaId: z.string().uuid().nullable().optional(),
  name: texto(160).optional(),
  descricao: z.string().max(10000).nullable().optional(),
  hp: numero.int().min(0).optional(),
  hpMax: numero.int().min(0).optional(),
  level: numero.int().min(1).optional(),
  job: texto(100).optional(),
  experiencia: numero.int().min(0).optional(),
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
  latina: numero.min(0).optional(), ouro: numero.min(0).optional(),
  prata: numero.min(0).optional(), cobre: numero.min(0).optional(),
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
};

export const fichaSchema = z.object(camposFicha);
export const sincronizacaoSchema = fichaSchema;
export const senhaCofreSchema = z.object({
  password: z.string().min(1).max(128),
}).strict();

export const campanhaSchema = z.object({
  nome: texto(120).min(1).optional(),
  descricao: z.string().max(20000).optional(),
  cenario: texto(100).optional(),
  estado: z.enum(["planejamento", "ativa", "pausada", "arquivada"]).optional(),
  codigoConvite: texto(20).optional(),
  dadosExtras: z.record(z.string(), json).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "Informe ao menos um campo da campanha.",
});

export const conviteSchema = z.object({
  inviteCode: texto(20).min(1),
}).strict();

export const membroSchema = z.object({
  papel: z.enum(["jogador", "co-mestre", "mestre"]).optional(),
  bloqueado: z.boolean().optional(),
}).strict();

export const notaSchema = z.object({
  titulo: texto(150).min(1).optional(),
  conteudo: z.string().max(100000).optional(),
  tipo: z.enum(["anotacao", "pista", "lore", "segredo"]).optional(),
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
  status: z.enum(["preparando", "em_andamento", "pausado", "encerrado"]).optional(),
  rodadaAtual: numero.int().min(1).optional(),
  turnoIndice: numero.int().min(0).optional(),
  combatentes: z.array(json).max(500).optional(),
  historicoAcoes: z.array(json).max(5000).optional(),
  recompensas: z.record(z.string(), json).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "Informe ao menos um campo do encontro.",
});

export const sessaoSchema = z.object({
  titulo: texto(200).min(1).optional(),
  numero: numero.int().min(1).optional(),
  estado: z.enum(["planejada", "em_andamento", "concluida", "cancelada"]).optional(),
  dataAgendada: z.string().datetime().nullable().optional(),
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

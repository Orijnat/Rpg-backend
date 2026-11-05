import "dotenv/config";
import bcrypt from "bcryptjs";
import { sequelize, User, Character, Campaign, CampaignMember, NPC } from "../src/models/index.js";

const seedPassword = process.env.SEED_PASSWORD;

if (!seedPassword || seedPassword.length < 12) {
  throw new Error("Defina SEED_PASSWORD com pelo menos 12 caracteres para executar o seed.");
}

async function seed() {
  await sequelize.authenticate();
  const password = await bcrypt.hash(seedPassword, 12);

  const [master] = await User.findOrCreate({
    where: { email: "mestre@rpg.local" },
    defaults: { username: "mestre-admin", password, perfil: "mestre" },
  });
  if (master.perfil !== "mestre") await master.update({ perfil: "mestre" });

  const players = [];
  for (const [index, email] of ["jogador1@rpg.local", "jogador2@rpg.local"].entries()) {
    const [player] = await User.findOrCreate({
      where: { email },
      defaults: { username: `jogador-${index + 1}`, password, perfil: "jogador" },
    });
    players.push(player);
  }

  const [campaign] = await Campaign.findOrCreate({
    where: { proprietarioId: master.id, nome: "Crônicas de Demonstração" },
    defaults: {
      descricao: "Campanha criada pelo seed local.",
      estado: "ativa",
      codigoConvite: "RPGLOCAL",
    },
  });

  await CampaignMember.findOrCreate({
    where: { campanhaId: campaign.id, usuarioId: master.id },
    defaults: { papel: "mestre", bloqueado: false },
  });

  for (const [index, player] of players.entries()) {
    const [character] = await Character.findOrCreate({
      where: { userId: player.id, nome: `Herói de Teste ${index + 1}` },
      defaults: { campanhaId: campaign.id, nome: `Herói de Teste ${index + 1}`, classe: "Aventureiro" },
    });
    await CampaignMember.findOrCreate({
      where: { campanhaId: campaign.id, usuarioId: player.id },
      defaults: { papel: "jogador", bloqueado: false },
    });
    await character.update({ campanhaId: campaign.id });
  }

  await NPC.findOrCreate({
    where: { campanhaId: campaign.id, nome: "Chefe de Teste" },
    defaults: {
      criadoPorId: master.id,
      papel: "Chefe",
      hp: 100,
      hpMax: 100,
      dadosExtras: { atitude: "Hostil", status: "Ativo" },
    },
  });

  console.log("Seed concluído.");
}

try {
  await seed();
} finally {
  await sequelize.close();
}

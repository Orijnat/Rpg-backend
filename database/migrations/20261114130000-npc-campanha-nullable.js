import { DataTypes } from "sequelize";

export async function up(queryInterface) {
  await queryInterface.sequelize.query(
    'ALTER TABLE npcs ALTER COLUMN campanha_id DROP NOT NULL;'
  );
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query(
    'ALTER TABLE npcs ALTER COLUMN campanha_id SET NOT NULL;'
  );
}

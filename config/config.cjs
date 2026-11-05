require("dotenv").config();

module.exports = {
  development: {
    url: process.env.DATABASE_URL || "******localhost:5432/rpg_ficha",
    dialect: "postgres",
    logging: false,
  },
  test: {
    url: process.env.DATABASE_URL || "******localhost:5432/rpg_ficha_test",
    dialect: "postgres",
    logging: false,
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: "postgres",
    logging: false,
    dialectOptions: process.env.DB_SSL === "true"
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
  },
};

const { Sequelize } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const WatermarkJob = require('./models/WatermarkJob');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: config.dbPath,
  logging: false,
});

WatermarkJob.init(sequelize);

async function initDatabase() {
  const dbDir = path.dirname(config.dbPath);
  await fs.mkdir(dbDir, { recursive: true });

  await sequelize.authenticate();
  await WatermarkJob.sync({ alter: true });
  return sequelize;
}

module.exports = {
  sequelize,
  initDatabase,
};

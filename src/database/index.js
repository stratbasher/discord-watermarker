const { Sequelize } = require('sequelize');
const path = require('path');
const config = require('../config');
const WatermarkJob = require('./models/WatermarkJob');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: config.dbPath,
});

WatermarkJob.init(sequelize);

async function initDatabase() {
  await sequelize.authenticate();
  await WatermarkJob.sync({ alter: true });
  return sequelize;
}

module.exports = {
  sequelize,
  initDatabase,
};
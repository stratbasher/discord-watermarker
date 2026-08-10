const { DataTypes, Model } = require('sequelize');

class WatermarkJob extends Model {
  static init(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        userId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        username: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        guildId: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        guildName: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        channelId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        originalMessageContent: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        imageCount: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        imageHashes: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM('processing', 'completed', 'failed'),
          allowNull: false,
          defaultValue: 'processing',
        },
        errorMessage: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'watermarkJob',
      }
    );
  }
}

module.exports = WatermarkJob;
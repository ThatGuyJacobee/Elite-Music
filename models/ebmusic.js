const { DataTypes, Model } = require('sequelize');

module.exports = class ebmusic extends Model {
    static init(sequelize) {
        return super.init({
            EntryID: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            GuildID: { type: DataTypes.STRING },
            DJToggle: { type: DataTypes.BOOLEAN },
            DJRole: { type: DataTypes.STRING },
        }, {
            tableName: 'ebmusic',
            timestamps: true,
            sequelize
        });
    }
}
const Sequelize = require('sequelize');
const conf = require(`../../config/${process.env.conf}.json`);

let sequelize = new Sequelize(conf.db.database, conf.db.user, conf.db.password, {
    host: conf.db.host,
    port: conf.db.port,
    dialect: 'mysql',
    // logging: () => {},
    operatorsAliases: false,
    pool: {
        max: conf.db.pool,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    timezone: '+08:00',
    define: {
        timestamps: false
    }
});


module.exports = sequelize;
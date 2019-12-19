const Sequelize = require('sequelize');
const utils = require('../utils/utils');
const _ = require('underscore');


let db = module.exports = require('./model');


db.sequelize = require('./sequelize');


db.call = (name, params, select, cb) => {
    let sql = 'CALL ' + name + db.toCallParamSql(params);
    db.sequelize.query(sql, { replacements: params, type: select ? Sequelize.QueryTypes.SELECT : Sequelize.QueryTypes.UPDATE })
        .then(d => {
            let arr = [];
            for (let i in d[0]) {
                arr.push(d[0][i]);
            }
            d[0] = arr;
            utils.cbOK(cb, d);
        })
        .catch(e => {
            console.log(e);
            utils.cb(cb, e);
        });
};


db.pcall = (name, params, select) => {
    let sql = 'CALL ' + name + db.toCallParamSql(params);
    return db.sequelize.query(sql, { replacements: params, type: select ? Sequelize.QueryTypes.SELECT : Sequelize.QueryTypes.UPDATE })
        .then(ret => {
            let arr = [];
            for (let i in ret[0]) {
                arr.push(ret[0][i]);
            }
            return { err: null, ret: arr };
        })
        .catch(err => {
            console.error(err);
            return { err, ret: null }
        });
};


db.delete = (table, filter, cb) => {
    let sql = `DELETE FROM \`${table}\` WHERE ${db.toAssignmentSql(filter)}`;
    db.sequelize.query(sql, { replacements: filter, type: Sequelize.QueryTypes.DELETE })
        .then(d => utils.cbOK(cb, d))
        .catch(e => {
            console.log(e);
            utils.cb(cb, e);
        });
};


db.find = (table, filter, cb) => {
    db.list(table, filter, (err, rows) => {
        utils.cb(cb, err, rows ? _.first(rows) : null);
    });
};


db.insert = (table, filter, cb) => {
    let sql = `INSERT INTO \`${table}\` SET ${db.toAssignmentSql(filter, ', ')}`;
    console.log(sql, filter);
    db.sequelize.query(sql, { replacements: filter, type: Sequelize.QueryTypes.INSERT })
        .then(d => utils.cbOK(cb, _.first(d)))
        .catch(e => {
            console.log(e);
            utils.cb(cb, e);
        });
};


db.bulkInsert = (table, filter, cb) => {
    let sql = `INSERT INTO \`${table}\` ${db.toCallFieldSql(filter)} VALUES ${db.toCallValueSql(filter)}`;
    db.sequelize.query(sql, { type: Sequelize.QueryTypes.INSERT })
        .then(d => utils.cbOK(cb, _.first(d)))
        .catch(e => {
            console.log(e);
            utils.cb(cb, e);
        });
};


db.list = (table, filter, cb) => {
    let sql = `SELECT * FROM \`${table}\` WHERE ${db.toAssignmentSql(filter, ' AND ', false)}`;
    db.sequelize.query(sql, { replacements: filter, type: Sequelize.QueryTypes.SELECT })
        .then(d => utils.cbOK(cb, d))
        .catch(e => {
            console.log(e);
            utils.cb(cb, e);
        });
};


db.max = (table, key, cb) => {
    let sql = `SELECT MAX(\`${table}\`.\`${key}\`) AS \`${key}\` FROM \`${table}\``;
    db.sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT })
        .then(d => utils.cb(cb, _.isEmpty(d) ? null : d[0][key]))
        .catch(e => {
            console.log(e);
            utils.cb(cb, e);
        });
};


db.query = (sql, cb) => {
    db.sequelize.query(sql)
        .then(d => utils.cbOK(cb, d))
        .catch(e => {
            console.log(e);
            utils.cb(cb, e);
        });
};

db.scalar = (sql, cb) => {
    db.sequelize.query(sql)
        .then(d => utils.cbOK(cb, d[0][0]))
        .catch(e => {
            console.log(e);
            utils.cb(cb, e);
        });
};

db.update = (table, filter, params, cb) => {
    let rps = [];
    let asql = '';
    let wsql = '';

    _.each(params, (value, key) => {
        rps.push(value);
        asql += (_.isEmpty(asql) ? '' : ', ') + '`' + key + '` = ?';
    });

    _.each(filter, (value, key) => {
        rps.push(value);
        wsql += (_.isEmpty(wsql) ? '' : ' AND ') + '`' + key + '` = ?';
    });

    let sql = `UPDATE \`${table}\` SET ${asql} WHERE ${wsql}`;
    db.sequelize.query(sql, { replacements: rps, type: Sequelize.QueryTypes.UPDATE })
        .then(d => utils.cbOK(cb, _.first(d)))
        .catch(e => {
            console.log(e);
            utils.cb(cb, e);
        });
};


db.toCallParamSql = (params) => {
    let sql = _.map(params, () => '?');
    return '(' + sql.join(',') + ')';
};


db.toAssignmentSql = (params, sp = ' AND ', ep = true) => {
    let sql = _.map(params, (value, key) => {
        if (_.isArray(value)) {
            return `\`${key}\` IN (:${key})`;
        }

        return `\`${key}\` = :${key}`;
    });

    if (!ep && _.isEmpty(sql)) {
        sql.push('1 = 1');
    }

    return sql.join(sp);
};


db.saver = (target, dirty = false, interval = 500) => {
    target.__dirty__ = dirty;
    target.__saving__ = null;
    target.__save__ = () => {
        if (target.__saving__) {
            target.__dirty__ = true;
            return;
        }

        target.__dirty__ = false;
        target.__saving__ = setTimeout(() => {
            target.save()
                .catch(console.log)
                .then(() => {
                    target.__saving__ = null;
                    target.__dirty__ && target.__save__();
                });
        }, interval);
    };
    dirty && target.__save__();

    return new Proxy(target, {
        set: (obj, prop, value, receiver) => {
            obj[prop] = value;

            if (['__dirty__', '__saving__'].indexOf(prop) < 0) {
                target.__save__();
            }

            return true;
        }
    });
};





db.toCallFieldSql = (params) => {
    let sql = _.map(_.first(params), (value, key) => {
        return key;
    });
    return '(' + sql.join(',') + ')';
};


db.toCallValueSql = (params) => {
    let sql = _.map(params, (value) => {
        return '(\'' + _.values(value).join('\',\'') + '\')';
    });
    return sql.join(',');
};

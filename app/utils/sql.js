const _ = require('underscore');


let util = module.exports = {};


util.toSqlKey = (key) => {
    return '`' + key + '`';
};


util.toSqlValue = (value) => {
    if(_.isNull(value)){
        return 'null';
    }

    if(_.isString(value)){
        return "'" + value + "'";
    }

    return value;
};


util.toValueClause = (data) => {
    let sql = '';
    _.each(data, (value, key) => {
        if(!_.isEmpty(sql)){
            sql += ',';
        }
        sql += util.toSqlKey(key) + '=' + util.toSqlValue(value);
    });
    return sql;
};


util.toWhereClause = (data) => {
    let sql = '';
    _.each(data, (value, key) => {
        if(!_.isEmpty(sql)){
            sql += ' AND ';
        }
        sql += util.toSqlKey(key) + '=' + util.toSqlValue(value);
    });
    return sql;
};


util.toDeleteSql = (table, data) => {
    return 'DELETE FROM ' + util.toSqlKey(table) + ' WHERE ' + util.toWhereClause(data);
};


util.toInsertSql = (table, data) => {
    return 'INSERT INTO ' + util.toSqlKey(table) + ' SET ' + util.toValueClause(data);
};


util.toListSql = (table, filter) => {
    return "SELECT * FROM " + util.toSqlKey(table) + (_.isEmpty(filter) ? '' : ' WHERE ' + util.toWhereClause(filter));
};


util.toMaxSql = (table, key) => {
    return "SELECT MAX(`" + table + "`.`" + key + "`) AS " + key + " FROM `" + table + "`";
};


util.toUpdateSql = (table, filter, data) => {
    return 'UPDATE ' + util.toSqlKey(table) + ' SET ' + util.toValueClause(data) + ' WHERE ' + util.toWhereClause(filter);
};
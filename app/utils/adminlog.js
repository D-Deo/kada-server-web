
const constants = require('../common/constants');
const _ = require('underscore');
const logger = require('log4js').getLogger('admin');
const db = require('../db');
const requestIp = require('request-ip');
const moment = require('moment');
const utils = require('./utils');

let adminlog = module.exports = {
};

adminlog.external = (req, params) => {
    params.ip = utils.ip(requestIp.getClientIp(req));
    params.optime = moment().format('YYYY-MM-DD HH:mm:ss');
}

adminlog.logadmin = (params, cb) => {
    db.call('proc_adminlog_save', [params.userId, params.module, params.desc, params.opname, params.ip, params.optime, params.ext1, params.ext2, params.ext3], true, (err, result) => {
        if (err) {
            logger.error('proc_adminlog_save错误: ' + err);
            cb(err);
            return;
        }
        console.log('result of proc_adminlog_save:' + result);
        console.log('result of proc_adminlog_save:' + JSON.stringify(result));
        let lastid = result[0][0].lastid;
        console.log('lastid:' + lastid);

        _.each(params.columns, (column) => {
            db.call('proc_tablelog_save', [lastid, column.table, column.column, column.key, column.before, column.after], true, (err, result) => {

            });
        });

        logger.info('proc_adminlog_save完成: ');
        if (cb)
            cb();
    });
};
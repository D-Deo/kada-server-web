const agentManager = require('../agent/manager');
const data = require('../data');
const url = require('url');
const userManager = require('../user/manager');
const db = require('../../app/db');
const utils = require('../utils/utils');
const logger = require('log4js').getLogger('admin');
const _ = require('underscore');
const requestIp = require('request-ip');
const conf = require(`../../config/${process.env.conf}.json`);

let operate = module.exports = {};

operate.before = () => {
    return (req, res, next) => {
        console.log('===========================operate before====================================');
        logger.info(req.path, req.method, requestIp.getClientIp(req), 'params', req.params, 'query', req.query, 'body', req.body);

        if (!_.contains(conf.operate_path_filter, req.path)) {
            console.log('req:' + req.api_user);
            let user = userManager.getUserBySession(req.sessionID);
            console.log('req.sessionID:' + req.sessionID);
            console.log('user:' + JSON.stringify(user));
            if (user) {
                console.log('user:' + JSON.stringify(user));
                db.call('proc_operate_save', [user.attrs.id, req.path, req.method, utils.ip(requestIp.getClientIp(req)), JSON.stringify(req.params), JSON.stringify(req.query), JSON.stringify(req.body)], true);
            }
        }

        next();
    };
};

operate.after = () => {
    return (req, res, next) => {
        console.log('===========================operate after====================================');
        logger.info(req.path, req.method, requestIp.getClientIp(req), 'params', req.params, 'query', req.query, 'body', req.body);
        if (next)
            next();
    };
};
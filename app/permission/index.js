const agentManager = require('../agent/manager');
const data = require('../data');
const url = require('url');
const userManager = require('../user/manager');
const utils = require('../utils/utils');
const logger = require('log4js').getLogger('admin');
const requestIp = require('request-ip');

let permission = module.exports = {};

permission.session = () => {
    return (req, res, next) => {
        logger.info(req.path, req.method, requestIp.getClientIp(req), 'params', req.params, 'query', req.query, 'body', req.body, 'session', JSON.stringify(req.session));

        let api = data.api[url.parse(req.originalUrl).pathname];
        if (api && !api.session) {
            next();
            return;
        }

        let agent = agentManager.getAgentBySession(req.sessionID);
        if (agent) {
            if (api.type && (agent.getAttr('type') !== api.type)) {
                utils.responseError(res);
                return;
            }

            req.agent = agent;
            next();
            return;
        }

        let user = userManager.getUserBySession(req.sessionID);
        if (user) {
            req.user = user;
            next();
            return;
        }

        utils.responseSessionError(res);
    };
};

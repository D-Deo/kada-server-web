const agentManager = require('../app/agent/manager');
const cons = require('../app/common/constants');
const data = require('../app/data');
const db = require('../app/db');
const express = require('express');
const sao = require('../app/server/sao');
const server = require('../app/server');
const smsManager = require('../app/sms/manager');
const userManager = require('../app/user/manager');
const utils = require('../app/utils/utils');
const _ = require('underscore');


let router = express.Router();


router.post('/apply/commit', (req, res) => {
    let id = parseInt(req.body.id);
    let commit = parseInt(req.body.commit);
    if(!utils.isNumber(id, 1) || !utils.isNumber(commit, 0, 10)) {
        utils.responseError(res);
        return;
    }

    let agent = agentManager.getAgentById(id);
    if(!agent) {
        utils.response(res, cons.ResultCode.UNKNOWN_AGENT());
        return;
    }

    if(agent.getAttr('type') !== cons.Agent.AGENT_APPLYING()) {
        utils.response(res, cons.ResultCode.COMMITED_AGENT());
        return;
    }

    agent.commit(commit === 1);
    utils.responseOK(res);
});


router.get('/apply/details', (req, res) => {
    db.query('SELECT `agent`.id FROM `agent` WHERE `agent`.type = 11;', (err, rows) => {
        let data = _.map(rows, (row) => {
            return agentManager.getAgentById(row.id).toJson_Apply();
        });
        utils.responseOK(res, data);
    });
});


/**
 * @api {post} agent/charge/user 给玩家充值
 * @apiGroup agent
 * @apiParam {id} id 玩家id
 * @apiParam {enum} itemId 物品id => 物品类型
 * @apiParam {number{0...房卡数量}} count 物品数量
 * @apiSuccessExample 返回
 * {
 *  "diamond": 10, 修改后的钻石数
 *  "bindDiamond": 10, 修改后的绑定钻石数
 * }
 */
router.post('/charge/user', (req, res) => {
    let agent = req.agent;
    let id = req.body.id;
    let itemId = req.body.itemId;
    let count = req.body.count;

    if( !utils.isId(id) ||
        !utils.isNumber(itemId, cons.Item.DIAMOND(), cons.Item.BIND_DIAMOND()) ||
        !utils.isNumber(count, 1)) {
        utils.responseError(res);
        return;
    }

    if(!agent.haveEnoughDiamond(itemId, count)) {
        utils.response(res, cons.ResultCode.NOT_ENOUGH_DIAMOND());
        return;
    }

    let user = userManager.getUserByAgentId(id, agent.getId());
    if(!user) {
        utils.response(res, cons.ResultCode.UNKNOWN_USER());
        return;
    }

    agent.changeDiamond(itemId, -count, cons.AgentDiamondChangeReason.SELL(), id + '');
    sao.item.chargeDiamond(id, itemId, count, cons.ItemChangeReason.AGENT(), (result) => {
        utils.response(res, result);
    });
});

router.post('/setparentagentuserid', (req, res) => {
    let parentAgentId = parseInt(req.body.parentAgentId);
    let userIds = req.body.userIds;
    if (!utils.isNumber(parentAgentId) || !utils.isString(userIds, 1)) {
        utils.responseError(res);
        return;
    }
    /*let agent = agentManager.getAgentById(parentAgentId);
    if (!agent) {
        utils.response(res, cons.ResultCode.UNKNOWN_AGENT());
        return;
    }*/
    db.call('proc_agent_set_parent', [parentAgentId, userIds], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        utils.responseOK(res);
    });
});

router.post('/setrebaterate', (req, res) => {
    let {ids,agentRebateRate} = req.body;
    agentRebateRate = parseInt(agentRebateRate);
    if (!utils.isNumber(agentRebateRate) || !utils.isString(ids, 1)) {
        utils.responseError(res);
        return;
    }
    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }

    let arr = ids.split(',');
    if (arr && arr.length > 0) {
        db.call('proc_set_agent_rebates', [agentRebateRate, ids, user.attrs.id], true, (err, result) => {
            if(err) {
                utils.responseError(res);
                return;
            }

            utils.responseOK(res, {});
        });
    } else {
        utils.responseError(res);
        return;
    }
});

router.post('/setdefaultrebaterate', (req, res) => {
    let {agentDefaultRebateRate} = req.body;
    agentDefaultRebateRate = parseInt(agentDefaultRebateRate);
    if (!utils.isNumber(agentDefaultRebateRate)) {
        utils.responseError(res);
        return;
    }
    //let user = userManager.getUserBySession(req.sessionID);

    db.call('proc_set_default_agent_rebate', [agentDefaultRebateRate], true, (err, result) => {
        if(err) {
            utils.responseError(res);
            return;
        }

        utils.responseOK(res, {});
    });
});

router.get('/rebates', (req, res) => {
    //let from = utils.isDate(req.query.from) ? req.query.from : null;
    //let to = utils.isDate(req.query.to) ? req.query.to : null;
    //let level = parseInt(req.query.level);
    let pindex = parseInt(req.query.page);
    let gameId = req.query.gameId;
    let psize = parseInt(req.query.skip);
    let search = req.query.condition || null;
    let type = parseInt(req.query.type);
    if (type == 0) {
        type = null;
    }
    if (!utils.isString(gameId, 1)) {
        gameId = null;
    }

    /*if( !utils.isNumber(level, -1, 3) ||
        !utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 5)) {
        utils.responseError(res);
        return;
        }*/

    db.call('proc_rebates', [gameId, type, pindex, psize], true, (err, result) => {
        if(err) {
            utils.responseError(res);
            return;
        }

        let data = result[0];
        let total = result[1][0].total;

        utils.responseOK(res, {data, total});
    });
});

router.get('/details', (req, res) => {
    let from = utils.isDate(req.query.from) ? req.query.from : null;
    let to = utils.isDate(req.query.to) ? req.query.to : null;
    let level = parseInt(req.query.level);
    let pindex = parseInt(req.query.page);
    let psize = parseInt(req.query.skip);
    let search = req.query.condition || null;

    if( !utils.isNumber(level, -1, 3) ||
        !utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 5)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_agent_details', [from, to, level, pindex, psize, search], true, (err, result) => {
        if(err) {
            utils.responseError(res);
            return;
        }

        let data = result[0];
        let total = result[1][0].total;
        _.each(data, (d) => {
            let a = agentManager.getAgentById(d.id);
            d.recommender = a.getAttr('recommender');
            d.recommenderChildren = a.getChildrenCount();
            d.recommenderLevel = a.getRecommenderLevel();
        });
        utils.responseOK(res, {data, total});
    });
});


/**
 * @api {get} agent/find 按照id 或者 账号查询代理信息
 * @apiGroup agent
 * @apiParam {id} id 代理id
 * @apiParam {string} account 账号
 * @apiSuccessExample 返回
 * {
 *  "account": "1", 账号
 *  "diamond": 1, 剩余钻石数
 *  "bindDiamond": 1, 剩余绑定钻石数
 *  "level": 1, 等级
 *  "id": 1, 代理id
 *  "nick": "1", 昵称
 *  "packages": {}, 可充值套餐
 * }
 */
router.get('/find', (req, res) => {
    let id = parseInt(req.query.id);
    let account = req.query.account;
    let agent = agentManager.getAgentById(id) || agentManager.getAgentByAccount(account);
    let json = agent ? agent.toJson_Charge() : null;
    utils.responseOK(res, json);
});


router.post('/login', (req, res) => {
    let agent = agentManager.getAgentBySession(req.sessionID);
    if(!agent) {
        utils.responseSessionError(res);
        return;
    }

    utils.responseOK(res, agent.toJson_Login());
});


/**
 * @api {post} agent/register/commit 代理注册
 * @apiGroup agent
 * @apiParam {string} account 账号 - 手机号码
 * @apiParam {string} address 通讯地址
 * @apiParam {string} bankAccount 银行账号
 * @apiParam {string} bankBranch 银行分行
 * @apiParam {string} bankCode 银行代码
 * @apiParam {string} code 验证码
 * @apiParam {string} idcard 身份证
 * @apiParam {string} idcardAddress 户籍地址
 * @apiParam {string} line line
 * @apiParam {string} nick 昵称
 * @apiParam {string} password 密码
 * @apiParam {id} userId 玩家id
 */
router.post('/register/commit', (req, res) => {
    let {account, address, bankAccount, bankBranch, bankCode, code, idcard, idcardAddress, line, nick, password, userId} = req.body;
    let level = 2;
    let name = nick;
    let type = cons.Agent.AGENT_APPLYING();

    if( !utils.isString(account, 1) ||
        !utils.isString(idcard, 1) ||
        !utils.isString(line, 1) ||
        !utils.isString(nick, 1) ||
        !utils.isString(password, 1) ||
        !utils.isNumber(userId, 1)) {
        utils.responseError(res);
        return;
    }

    if(!smsManager.commit(cons.SMS.AGENT_REGISTER(), account, code)) {
        utils.response(res, cons.ResultCode.CODE_ERROR());
        return;
    }

    db.find('user', {id: userId}, (err, data) => {
        if(err || !data) {
            utils.response(res, cons.ResultCode.UNKNOWN_USER());
            return;
        }

        let user = userManager.getUserById(userId);
        let recommender = user  ? user.getAttr('agentId') : null;
        if(!user || !recommender) {
            utils.response(res, cons.ResultCode.UNBIND_USER());
            return;
        }

        if(agentManager.getAgentByAccount(account)) {
            utils.response(res, cons.ResultCode.USED_PHONE());
            return;
        }

        if(agentManager.getAgentByIdcard(idcard)) {
            utils.response(res, cons.ResultCode.USED_IDCARD());
            return;
        }

        if(agentManager.getAgentByLine(line)) {
            utils.response(res, cons.ResultCode.USED_LINE());
            return;
        }

        if(agentManager.getAgentByUserId(userId)) {
            utils.response(res, cons.ResultCode.USED_USER_ID());
            return;
        }

        agentManager.createAgent({account, address, bankAccount, bankBranch, bankCode, idcard, idcardAddress, line, level, nick, name, password, recommender, timestamp: utils.date.timestamp(), type, userId});
        utils.responseOK(res);
    });
});


/**
 * @api {get} agent/register/info 获取注册信息
 * @apiGroup agent
 * @apiSuccessExample 返回
 * {
 *  "account": "1", 账号
 *  "address": "2", 通讯地址
 *  "bankerAccount": "111", 银行账号
 *  "bankerBranch": "11", 银行分行
 *  "bankerCode": "11", 银行代码
 *  "line": "111", line
 *  "idcard": "11", 身份证
 *  "idcardAddress": "11", 户籍地址
 *  "nick": "1", 名字
 *  "userId": 111, 玩家id
 * }
 */
router.get('/register/info', (req, res) => {
    utils.responseOK(res, req.agent.toJson_Register());
});


/**
 * @api {post} agent/register/recommit 重新申请
 * @apiGroup agent
 */
router.post('/register/recommit', (req, res) => {
    let agent = req.agent;
    let {address, bankAccount, bankBranch, bankCode, idcard, idcardAddress, line, nick} = req.body;

    if( !utils.isString(idcard, 1) ||
        !utils.isString(line, 1) ||
        !utils.isString(nick, 1)) {
        utils.responseError(res);
        return;
    }

    if(agent.getAttr('type') !== cons.Agent.AGENT_REFUSED()) {
        utils.responseError(res);
        return;
    }

    if(agentManager.getAgentByIdcard(idcard) && (agentManager.getAgentByIdcard(idcard) !== agent)) {
        utils.response(res, cons.ResultCode.USED_IDCARD());
        return;
    }

    if(agentManager.getAgentByLine(line) && (agentManager.getAgentByLine(line) !== agent)) {
        utils.response(res, cons.ResultCode.USED_LINE());
        return;
    }

    agent.setAttrs({address, bankAccount, bankBranch, bankCode, idcard, idcardAddress, line, nick, type: cons.Agent.AGENT_APPLYING()});
    utils.responseOK(res);
});


router.get('/register/send', (req, res) => {
    let phone = req.query.phone;

    if(!utils.isString(phone, 10, 10)) {
        utils.responseError(res);
        return;
    }

    if(agentManager.getAgentByAccount(phone)) {
        utils.response(res, cons.ResultCode.USED_PHONE());
        return;
    }

    let code = smsManager.send(cons.SMS.AGENT_REGISTER(), phone);
    utils.responseOK(res, utils.date.remain(code.timestamp, cons.SMS.SEND_INTERVAL()));
});


router.post('/token', (req, res) => {
    let account = req.body.account;
    let password = req.body.password;

    let agent = agentManager.getAgentByAccount(account);
    if(!agent) {
        utils.response(res, cons.ResultCode.UNKNOWN_AGENT());
        return;
    }

    if(agent.getAttr('password') !== password) {
        utils.response(res, cons.ResultCode.UNKNOWN_AGENT());
        return;
    }

    agentManager.bindSession(agent, req.sessionID);
    utils.responseOK(res, req.sessionID);
});


router.get('/user/details', (req, res) => {
    db.list('user', {agentId: req.agent.getId()}, (err, rows) => {
        if(err) {
            utils.responseError(res);
            return;
        }

        let data = _.map(rows, (row) => _.pick(row, ['account', 'agentTime', 'id', 'nick']));
        utils.responseOK(res, data);
    });
});


/**
 * @api {get} agent/user/bind/details 获取名下绑定玩家的详细信息
 * @apiGroup agent
 * @apiParam {number} page 分页索引
 * @apiParam {number} skip 分页大小
 * @apiParam {string} search 搜索条件
 * @apiSuccessExample 返回
 * [{
 *  "agentAccount": "1", 代理账号
 *  "agentId": 1, 代理id和邀请码
 *  "agentNick": "1", 代理昵称
 *  "agentTime": "2018-1-1", 代理绑定时间
 *  "userId": 1, 玩家id
 * }]
 */
router.get('/user/bind/details', (req, res) => {
    let pindex = parseInt(req.query.page);
    let psize = parseInt(req.query.skip);
    let search = req.query.search;

    if( !utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 5) ||
        !utils.isString(search)) {
        utils.responseError(res);
        return;
    }


    let agentId = req.agent.isAdmin() ? null : req.agent.getId();
    db.call('proc_agent_bind_users', [agentId, pindex, psize, search], true, (err, result) => {
        if(err) {
            utils.responseError(res);
            return;
        }

        let data = result[0];
        let total = result[1][0].total;
        utils.responseOK(res, {data, total});
    });
});


/**
 * @api {post} agent/user/bind/remove 移除绑定玩家
 * @apiGroup agent
 * @apiParam {id} userId 玩家id
 */
router.post('/user/bind/remove', (req, res) => {
    let userId = req.body.userId;
    let user = userManager.getUserById(userId);
    let agentId = user ? user.getAttr('agentId') : null;
    if(!user || !agentId) {
        utils.responseOK(res);
        return;
    }

    if(!req.agent.isAdmin() && (req.agent.getId() !== agentId)) {
        utils.responseError(res);
        return;
    }

    userManager.bindAgent(userId, null);
    server.post('user/agent', {agentId: null, agentNick: null, userId});
    utils.responseOK(res);
});

/**
 * @api {get} agent/paystats 充值统计
 * @class finace
 * @param {number} agentId 代理id
 * @param {number} from 起始时间
 * @param {number} to 结束时间
 * @param {number} pindex 页索引 0开始
 * @param {number} psize 页大小
 * @apiSuccessExample 返回
 * {
 *     "count": 1, 总数，
 *     "rows": [ 数据集

 *     ]
 * }
 */
router.get('/paystats', (req, res) => {
    let agentId = parseInt(req.query.agentId);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let from = req.query.from;
    let to = req.query.to;


    from = utils.isDate(from) ? (from) : null;
    to = utils.isDate(to) ? (to) : null;
    if (/^\d{4}\-\d{1,2}\-\d{1,2}$/img.test(from)) {
        from = from + ' 00:00:00';
    }
    if (/^\d{4}\-\d{1,2}\-\d{1,2}$/img.test(to)) {
        to = to + ' 23:59:59.999';
    }

    dateFrom = new Date(from);
    dateTo = new Date(to);

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    agentId = utils.isNumber(agentId) ? agentId : null;
    db.call('proc_pay_stats', [from, to, pindex, psize], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let data = result[0];
        let total = result[1][0].total;
        utils.responseOK(res, { data, total });
    });
});

module.exports = router;
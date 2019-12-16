const agentManager = require('../app/agent/manager');
const cons = require('../app/common/constants');
const data = require('../app/data');
const dao = require('../app/db/dao');
const db = require('../app/db');
const redis = require('../app/redis/index');
const express = require('express');
const sao = require('../app/server/sao');
const saop = require('../app/server/saop');
const server = require('../app/server');
const smsManager = require('../app/sms/manager');
const userManager = require('../app/user/manager');
const utils = require('../app/utils/utils');
const _ = require('underscore');
const permission = require('../app/utils/permission');
const model = require('../app/db/model');
const QRCode = require('qrcode');
const libqqwry = require('lib-qqwry');
const adminlog = require('../app/utils/adminlog');
const logger = require('log4js').getLogger('bindAgent');
const requestIp = require('request-ip');
const utility = require('utility');
const Geetest = require('gt3-sdk');
const conf = require(`../config/${process.env.conf}.json`);

const notp = require('notp');
const t2 = require('thirty-two');

const speakeasy = require('speakeasy');

let captcha = new Geetest({
    geetest_id: 'a5480c8e9f39bf55ebfa153e89e556ce',
    geetest_key: '3daeb4139d7a425f5eecfd3d375f2fcd'
});

let router = express.Router();


/**
 * @api {get} user/achieve/children 当前直属结算业绩列表
 * @class user
 * @param {number} userId 玩家id
 * @param {number} pindex 分页索引
 * @param {number} psize 分页大小
 * @apiSuccess {json} 返回
 *  [{
 *      "id": 100001,       id
 *      "account": "123",   账号
 *      "nick": "123",      昵称
 *      "sachieve": 200,    自己业绩
 *      "cachieve": 200,    下级业绩
 *      "children": 2,      直属数量
 *      "descendants": 3,  下级数量
 *      "rate": 0.1         返利比例,
 *      "rebate": 1,        返利
 *  }]
 *  返利数 客户端计算
 */
router.get('/achieve/children', (req, res) => {
    let recommenderId = parseInt(req.query.userId);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    if (!utils.isId(recommenderId, 0) ||
        !utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_user_achieve_children', [null, pindex, psize, recommenderId], true, (err, d) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let count = d[1][0].total;
        _.each(d[0], d => {
            let [srate, srebate] = data.getRebate(d.sachieve + d.cachieve);
            let [crate, crebate] = data.getRebate(d.cachieve);
            d.rate = srate;
            d.rebate = srebate - crebate;
        });
        utils.responseOK(res, { count, rows: d[0] });
    });
});

router.get('/recommend', (req, res) => {
    let recommender = parseInt(req.query.recommender);
    let userId = parseInt(req.query.userId);
    if (!utils.isNumber(recommender) || !utils.isNumber(userId)) {
        utils.responseError(res);
        return;
    }
    db.query('update user set recommender=' + recommender + ' where id=' + userId, (err, result) => {
        if (err) {
            return utils.responseError(res);
        }
        return utils.responseOK(res, 'success');
    });
});

/**
 * @api {get} user/achieve/self 当前自己结算业绩
 * @class user
 * @param {number} userId 玩家id
 * @apiSuccess {json} 返回
 *  {
 *      "sachieve": 200,    自己业绩
 *      "cachieve": 200,    下级业绩
 *      "children": 2,      直属数量
 *      "descendants": 3    下级数量
 *      "rate": 0.1，        返利比例
 *      "rebate": 1         返利
 *  }
 *  返利比例 返利数 客户端计算
 */
router.get('/achieve/self', (req, res) => {
    let userId = parseInt(req.query.userId);

    if (!utils.isId(userId)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_user_achieve_self', [userId], true, (err, d) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        _.each(d[0], d => {
            let [srate, srebate] = data.getRebate(d.sachieve + d.cachieve);
            let [crate, crebate] = data.getRebate(d.cachieve);
            d.rate = srate;
            d.rebate = srebate - crebate;
        });

        utils.responseOK(res, d[0][0]);
    });
});

/**
 * @api {get} user/bind/agent 玩家绑定代理
 * @class user
 * @param {number} agentId 代理id
 * @param {number} userId 玩家id
 * @apiSuccess {json} items 奖励物品
 */
router.get('/bind/agent', async (req, res) => {
    let userId = parseInt(req.query.userId);
    let inviteCode = req.query.inviteCode;

    if (!utils.isId(userId) ||
        // !utils.isId(agentId) ||
        !utils.isString(inviteCode, 1, 64)) {
        return utils.responseError(res);
    }

    let user = await userManager.loadUserById(userId);
    if (!user) {
        return utils.response(res, cons.ResultCode.USER_UNKNOWN());
    }

    if (user.getAttr('agentId')) {
        return utils.response(res, cons.ResultCode.BINDED_INVITE_CODE());
    }

    // let agent = agentManager.getAgentById(agentId);
    // if (!agent) {
    //     utils.response(res, cons.ResultCode.UNKNOWN_AGENT());
    //     return;
    // }

    db.find('user', { inviteCode }, (err, agent) => {
        if (err) {
            return logger.error(err);
        }
        if (!agent) {
            utils.response(res, cons.ResultCode.UNKNOWN_INVITE_CODE());
            return;
        }

        userManager.bindAgent(userId, agent.id);
        sao.user.bindAgent(userId, agent.id, agent.nick);
        utils.responseOK(res);
    });
});


/**
 * @api {get} user/feedback 反馈
 * @class user
 * @param {id} id 玩家id
 * @param {string} content 反馈内容
 */
router.get('/feedback', (req, res) => {
    let userId = parseInt(req.query.userId);
    let content = req.query.content;

    if (!utils.isId(userId) ||
        !utils.isString(content, 1, 200)) {
        utils.responseError(res);
        return;
    }

    dao.user.feedback(userId, content);
    utils.responseOK(res);
});


/**
 * @api {get} user/find 按照id 或者 账号查询代理信息，优先ID
 * @class user
 * @param {id} id 玩家id
 * @param {string} account 账号
 * @apiSuccessExample 返回
 * {
 *  "account": "1", 账号
 *  "gold": 1, 剩余金币数
 *  "diamond": 1, 剩余钻石数
 *  "bindDiamond": 1, 剩余绑定钻石数
 *  "id": 1, id
 *  "nick": "1", 昵称
 * }
 */
router.get('/find', async (req, res) => {
    let { id, account } = req.query;
    id = parseInt(id) || null;
    account = account || null;

    if ((!id || !utils.isId(id)) && (!account || !utils.isString(account, 1))) {
        return utils.responseError(res, '参数错误');
    }

    if (req.admin && req.admin.isAgent()) {
        let user = await model.User.findById(id);
        if (!user || (user.agentId != req.admin.getId())) {
            return utils.responseError(res, '没有找到对应的玩家');
        }
    }

    db.call('proc_user_find', [id, account], true, (err, result) => {
        if (err) {
            return utils.responseError(res);
        }
        utils.responseOK(res, result[0][0] || null);
    });
});


/**
 * @api {post} user/item/records 物品变动记录
 * @class user
 * @param {id} userId 玩家id null 全部
 * @param {id} itemId 物品id -1 全部
 * @param {id} reason 变动原因 -1 全部
 * @param {number} page 分页索引
 * @param {number} skip 分页大小
 * @param {string} from 起始时间 null 全部
 * @param {string} to 结束时间 null 全部
 * @param {string} order 排序类型 null 不排序 desc 降序 asc 升序
 * @param {string} column 排序的列 null 不排序 否则传对应的数据名
 * @apiSuccessExample
 * [{
 *  "userId": 111111, 玩家id
 *  "itemId": 2, 物品id
 *  "count": -100, 变动数量
 *  "remain": 100, 变动后剩余
 *  "reason": 1, 变动原因
 *  "timestamp": "2018-3-28 00:00:00", 时间戳
 * }]
 */
router.post('/item/records', (req, res) => {
    let { userId, itemId, reason, from, to, order, column } = req.body;
    let pindex = req.body.page;
    let psize = req.body.skip;

    if (!utils.isId(itemId) ||
        !utils.isNumber(reason) ||
        !utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 5)) {
        utils.responseError(res);
        return;
    }

    userId = utils.isString(userId) ? userId : null;
    from = utils.isDate(from) ? utils.date.timestamp(from) : null;
    to = utils.isDate(to) ? utils.date.timestamp(to) : null;

    db.call('proc_item_record_details', [userId, itemId, reason, from, to, pindex, psize], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let data = result[0];
        let total = result[1][0].total;
        utils.responseOK(res, { data, total });
    });
});

/**
 * @api {post} /user/login/records 登录日志
 * @class user
 */
router.post('/login/records', (req, res) => {
    let { userId, ip, device, from, to, from_logout, to_logout, opts } = req.body;
    let pindex = req.body.page;
    let psize = req.body.skip;

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 5)) {
        return utils.responseError(res);
    }

    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        return utils.response(res, { code: 402, msg: '登录失效！' });
    }

    let agentId = user.attrs.id;

    var qqwry = libqqwry.init();    //初始化IP库解析器
    qqwry.speed();                  //启用急速模式 比不开启效率率快非常多 但多占10M左右内存;

    agentId = utils.isNumber(agentId) ? agentId : null;
    userId = utils.isString(userId) ? userId : null;
    ip = utils.isString(ip) ? ip : null;
    device = utils.isString(device) ? device : null;
    from = utils.isDate(from) ? (from) : null;
    to = utils.isDate(to) ? (to) : null;
    from_logout = utils.isDate(from_logout) ? (from_logout) : null;
    to_logout = utils.isDate(to_logout) ? (to_logout) : null;

    permission.isAgent(agentId, (isAgent) => {
        agentId = isAgent ? agentId : null;
        db.call('proc_user_login_record_details', [
            userId, opts.online, !opts.last || 1, opts.level == '' ? null : opts.level,
            ip, device, from, to, from_logout, to_logout, agentId, pindex, psize
        ], true, (err, result) => {
            if (err) {
                utils.responseError(res);
                return;
            }

            let data = result[0];
            _.each(data, (row) => {
                try {
                    if (row.ip) {
                        var ip = qqwry.searchIP(utils.ip(row.ip)); //查询IP信息
                        row.ip = row.ip + ' (' + ip.Country + ip.Area + ')';
                        row.ip = row.ip.replace(/ CZ88.NET/g, "");
                    }
                    if (row.registIp) {
                        var ip = qqwry.searchIP(utils.ip(row.registIp)); //查询IP信息
                        row.registIp = row.registIp + ' (' + ip.Country + ip.Area + ')';
                        row.registIp = row.registIp.replace(/ CZ88.NET/g, "");
                    }
                } catch (e) {
                    console.log(e);
                }
            });

            let total = result[1][0].total;
            utils.responseOK(res, { data, total });
        });
    }, res);
});

/**
 * @api {post} user/login/info 登录信息
 * @class user
 * @param {string} account 账号
 * @param {string} password 密码
 * @apiSuccessExample 返回
 * {
 *  "id": 玩家id,
 *  "account": 玩家账号,
 *  "nick": 玩家昵称,
 *  "sex": 玩家性别
 * }
 */
router.post('/login/info', async (req, res) => {
    let item = await model.Item.findOne({ where: { userId: req.admin.getId(), itemId: cons.Item.DIAMOND() } });
    req.admin.diamond = item ? item.count : 0;
    utils.responseOK(res, req.admin.toJson_Login());
});


/**
 * @api {post} user/login/token 登录凭证
 * @class user
 * @param {string} account 账号
 * @param {string} password 密码
 * @param {string} valid 验证码
 */
router.post('/login/token', (req, res) => {
    let { account, password, valid, isconfirm } = req.body;

    if (!utils.isString(account, 1, 30) ||
        !utils.isString(password, 1, 30)) {
        utils.responseError(res);
        return;
    }

    password = utility.md5(password).toUpperCase();

    (async () => {
        let user = await userManager.loadUserByAccount(account);

        if (!user) {
            return utils.response(res, cons.ResultCode.UNKNOWN_USER());
        }

        let roleIps = conf.whiteIp[utils.ip(req.ip)] || conf.whiteIp['*'];
        if (!roleIps) {
            return utils.response(res, cons.ResultCode.UNKNOWN_USER());
        }

        if (roleIps && roleIps.length > 0) {
            let exits = false;
            for (let r of roleIps) {
                if (user.getAttr('role') == r) {
                    exits = true;
                    break;
                }
            }

            if (!exits) {
                return utils.response(res, cons.ResultCode.UNKNOWN_USER());
            }
        }

        // if (!user && utils.isNumber(account)) {
        //     user = await userManager.loadUserById(account);
        // }

        if (user.getAttr('role') == cons.Role.USER() || user.getAttr('role') == cons.Role.TEST()) {
            return utils.response(res, cons.ResultCode.UNKNOWN_USER());
        }

        if (user.getAttr('state') == cons.UserState.SUSPENDED()) {
            return utils.response(res, cons.ResultCode.USER_SUSPENDED());
        }

        if (user.getAttr('password') !== password) {
            let params = {};
            params.userId = user.attrs.id;
            params.module = '登录';
            params.desc = account + '登录后台，密码错误';
            params.opname = '登录后台';
            adminlog.external(req, params);
            params.ext1 = user.attrs.id;
            params.ext2 = null;
            params.ext3 = null;
            params.columns = [];
            adminlog.logadmin(params);
            return utils.response(res, cons.ResultCode.USER_PASSWORD_ERROR());
        }

        if (conf.development.googleAuth && user.getAttr('role') != cons.Role.AGENT()) {
            if (!user.getAttr('token')) {
                let secret = speakeasy.generateSecret({ name: account });
                QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
                    console.log(secret.base32, data_url);
                    if (isconfirm == 1)
                        user.bindToken(secret.base32, data_url);
                    // user.setAttr('token', secret.base32);
                    return utils.response(res, cons.ResultCode.USER_TOKEN_ERROR(), { token: secret.base32, qrcode: data_url });
                });
                return;
            }

            let base32Secret = user.getAttr('token');
            console.log('token, secret', valid, base32Secret);

            let verified = speakeasy.totp.verify({
                secret: base32Secret,
                encoding: 'base32',
                token: valid
            });

            if (!verified) {
                let params = {};
                params.userId = user.attrs.id;
                params.module = '登录';
                params.desc = account + '登录后台，验证错误';
                params.opname = '登录后台';
                adminlog.external(req, params);
                params.ext1 = user.attrs.id;
                params.ext2 = null;
                params.ext3 = null;
                params.columns = [];
                adminlog.logadmin(params);
                return utils.response(res, cons.ResultCode.USER_VALID_ERROR());
            }
        }

        let params = {};
        params.userId = user.attrs.id;
        params.module = '登录';
        params.desc = account + '登录后台,登录成功';
        params.opname = '登录后台';
        adminlog.external(req, params);
        params.ext1 = user.attrs.id;
        params.ext2 = null;
        params.ext3 = null;
        params.columns = [];
        adminlog.logadmin(params);

        userManager.bindSession(user.getId(), req.sessionID);
        return utils.responseOK(res);
    })();
});


/**
 * @api {get} user/mail/delete 删除邮件
 * @class user
 * @param {id} id 邮件id
 * @param {id} userId 玩家id
 */
router.get('/mail/delete', (req, res) => {
    let id = parseInt(req.query.id);
    let userId = parseInt(req.query.userId);

    if (!utils.isId(id) ||
        !utils.isId(userId)) {
        utils.responseError(res);
        return;
    }

    /*db.delete('mail', { id, userId }, () => {
        utils.responseOK(res);
    });*/

    db.update("mail", { id: id }, { status: 3 }, (err, result) => {
        if (err) {
            utils.responseError(res, cons.ResultCode.MAIL_DEL_ERROR());
            return;
        }

        let params = {};
        params.userId = userId;
        params.module = '邮件管理';
        params.desc = userId + '删除邮件：' + id + ',成功';
        params.opname = '玩家删除邮件';
        adminlog.external(req, params);
        params.ext1 = id;
        params.ext2 = 3;
        params.ext3 = userId;
        params.columns = [];
        adminlog.logadmin(params);
        utils.responseOK(res);
    });
});


/**
 * @api {get} user/mail/details 获取邮件列表
 * @class user
 * @param {id} userId 玩家id
 */
router.get('/mail/details', (req, res) => {
    let userId = parseInt(req.query.userId);
    if (!utils.isId(userId)) {
        utils.responseError(res);
        return;
    }

    db.list('mail', { userId, status: 1 }, (err, rows) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        _.each(rows, (row) => {
            row.items = JSON.parse((row.items || '{}'));
            row.timestamp = utils.date.formatYYMMDDHHMMSS(row.timestamp);
        });

        utils.responseOK(res, rows.reverse());
    });
});


/**
 * @api {get} user/mail/read 读取邮件
 * @class user
 * @param {id} id 邮件id
 * @param {id} userId 玩家id
 */
router.get('/mail/read', (req, res) => {
    let id = parseInt(req.query.id);
    let userId = parseInt(req.query.userId);

    if (!utils.isId(id) ||
        !utils.isId(userId)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_mail_read', [id, userId], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let error = result[0][0].error;
        if (error) {
            utils.response(res, cons.ResultCode.MAIL_ERROR(), error);
            return;
        }

        utils.responseOK(res);
    });
});


/**
 * @api {get} user/mail/receive 领取邮件
 * @class user
 * @param {id} id 邮件id
 * @param {id} userId 玩家id
 */
router.get('/mail/receive', (req, res) => {
    let id = parseInt(req.query.id);
    let userId = parseInt(req.query.userId);

    if (!utils.isId(id) ||
        !utils.isId(userId)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_mail_receive', [id, userId], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let error = result[0][0].error;
        if (error) {
            utils.response(res, cons.ResultCode.MAIL_ERROR(), error);
            return;
        }

        let items = JSON.parse(result[0][0].items);
        sao.item.changeItems(userId, items, {
            from: id + "",
            reason: cons.ItemChangeReason.MAIL()
        });
        utils.responseOK(res, JSON.parse(result[0][0].items));
    });
});


/**
 * @api {get} user/mall/order 玩家购买下单
 * @class user
 * @param {id} suitId 套餐id
 * @param {id} userId 玩家id
 */
router.get('/mall/order', (req, res) => {
    let suitId = parseInt(req.query.suitId);
    let userId = parseInt(req.query.userId);

    if (!utils.isId(suitId) ||
        !utils.isId(userId)) {
        utils.responseError(res);
        return;
    }

    let suit = data.getMall(suitId);
    if (!suit) {
        utils.responseError(res);
        return;
    }

    dao.user.isUser(userId, (result) => {
        if (!result) {
            utils.response(res, cons.ResultCode.UNKNOWN_USER());
            return;
        }

        dao.user.order(userId, 0, suit.money, suit.item, suit.count);
        sao.item.changeItem(userId, suit.item, suit.count, cons.ItemChangeReason.BUY(), (err, msg) => {
            utils.response(res, err, msg);
        });
    });
});

/**
 * @api {post} user/info/commit 玩家修改个人信息
 * @class user
 * @param {string} account 帐号 -- 手机号码
 * @param {string} nick 昵称 null or 空字符串 都表示不修改
 * @param {number} sex 性别 0男 1女 其他值为不修改
 */
router.route('/info/commit').post((req, res) => {
    let { account, nick, sex } = req.body;

    if (!utils.isString(account, 1, 30)) {
        utils.responseError(res);
        return;
    }

    nick = !utils.isString(nick, 1, 30) ? nick : null;
    sex = !utils.isNumber(sex, 0, 1) ? sex : null;

    let user = userManager.getUserByAccount(account);
    if (!user) {
        utils.response(res, cons.ResultCode.UNKNOWN_USER());
        return;
    }

    return utils.responseOK(res);
    // sao.user.password(account, password, (result) => {
    //     if (!utils.crOK(result)) {
    //         utils.response(res, result);
    //         return;
    //     }

    //     user.setAttr('password', password);
    //     utils.responseOK(res);
    // });
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});

/**
 * @api {post} user/password/commit 玩家修改账号密码 - 提交信息
 * @class user
 * @param {string} account 账号 - 手机号码
 * @param {string} code 验证码
 * @param {string} password 密码
 */
router.route('/password/commit').post((req, res) => {
    let { account, code, password } = req.body;

    if (!utils.isString(account, 1, 30) ||
        !utils.isString(password, 1, 30)) {
        utils.responseError(res);
        return;
    }

    let user = userManager.getUserByAccount(account);
    if (!user) {
        utils.responseError(res);
        return;
    }

    if (!smsManager.commit(cons.SMS.USER_PASSWORD(), account, code)) {
        utils.response(res, cons.ResultCode.CODE_ERROR());
        return;
    }

    let p = saop.user.password(account, password);
    p.then(() => user.setAttr('password', password));
    utils.responseProm(res, p);
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});


/**
 * @api {get} user/password/send 玩家修改密碼 - 发送验证码
 * @class user
 * @param {string} account 账号 - 手机号码
 */
router.get('/password/send', (req, res) => {
    let account = req.query.account;
    let code = req.query.code;
    let v = req.query.v;

    if (!utils.isString(account, 1, 30)
        || !utils.isString(code, 4, 4)
        || !utils.isString(v, 1)) {
        utils.responseError(res);
        return;
    }

    if (!utils.checkVercode(v, code)) {
        utils.response(res, cons.ResultCode.VERCODE_ERROR());
        return;
    }

    let ip = utils.ip(requestIp.getClientIp(req));

    let p = userManager.loadUserByAccount(account);
    p = p.then(() => {
        if (!smsManager.checkIp(ip)) {
            return Promise.reject(cons.ResultCode.VERCODE_SAME_IP_ERROR());
        }

        let code = smsManager.send(cons.SMS.USER_PASSWORD(), account);
        return utils.date.remain(code.timestamp, cons.SMS.SEND_INTERVAL());
    });
    utils.responseProm(res, p);
});

/**
 * @api {post} user/password/commit 玩家修改银行密码 - 提交信息
 * @class user
 * @param {string} account 账号 - 手机号码
 * @param {string} code 验证码
 * @param {string} password 密码
 */
router.route('/password2/commit').post((req, res) => {
    let { account, code, password } = req.body;

    if (!utils.isString(account, 1, 30) ||
        !utils.isString(password, 1, 30)) {
        utils.responseError(res);
        return;
    }

    let user = userManager.getUserByAccount(account);
    if (!user) {
        utils.responseError(res);
        return;
    }

    if (!smsManager.commit(cons.SMS.USER_PASSWORD2(), account, code)) {
        utils.response(res, cons.ResultCode.CODE_ERROR());
        return;
    }

    let p = saop.user.password2(account, password);
    p.then(() => user.setAttr('password2', password));
    utils.responseProm(res, p);
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});


/**
 * @api {get} user/password/send 玩家修改密碼 - 发送验证码
 * @class user
 * @param {string} account 账号 - 手机号码
 */
router.get('/password2/send', (req, res) => {
    let account = req.query.account;
    let code = req.query.code;
    let v = req.query.v;

    if (!utils.isString(account, 1, 30)
        || !utils.isString(code, 4, 4)
        || !utils.isString(v, 1)) {
        utils.responseError(res);
        return;
    }

    if (!utils.checkVercode(v, code)) {
        utils.response(res, cons.ResultCode.VERCODE_ERROR());
        return;
    }

    let ip = utils.ip(requestIp.getClientIp(req));

    let p = userManager.loadUserByAccount(account);
    p = p.then(() => {
        if (!smsManager.checkIp(ip)) {
            return Promise.reject(cons.ResultCode.VERCODE_SAME_IP_ERROR());
        }

        let code = smsManager.send(cons.SMS.USER_PASSWORD2(), account);
        return utils.date.remain(code.timestamp, cons.SMS.SEND_INTERVAL());
    });
    utils.responseProm(res, p);
});

/**
 * @api {get} user/rebate/self 历史分红详细信息
 * @class user
 * @param {number} userId 玩家id
 * @param {number} index 分红编号
 * @param {number} pindex 分页索引
 * @param {number} psize 分页大小
 * @apiSuccess {json} 返回
 *  [{
 *      "userId": 111111,       玩家id
 *      "index": 1,             编号
 *      "from": '2018-05-01',   起始时间
 *      "to": '2018-05-07',     结束时间
 *      "children": 2,          直属数量
 *      "descendants": 3        下级数量
 *      "tachieve": 400,        总业绩
 *      "sachieve": 200,        自己业绩
 *      "cachieve": 200,        下级业绩
 *      "rate": 0.1,            分红比例
 *      "rebate": 100,           分红数
 *  }]
 */
router.get('/rebate/children', (req, res) => {
    let userId = parseInt(req.query.userId);
    let index = parseInt(req.query.index);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    if (!utils.isId(userId) ||
        !utils.isNumber(index, 0) ||
        !utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_user_rebate_children', [userId, index, pindex, psize], true, (err, data) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let count = data[1][0].total;
        utils.responseOK(res, { count, rows: data[0] });
    });
});


/**
 * @api {get} user/rebate/self 历史分红记录
 * @class user
 * @param {number} userId 玩家id
 * @param {number} pindex 分页索引
 * @param {number} psize 分页大小
 * @apiSuccess {json} 返回
 *  [{
 *      "userId": 111111,       玩家id
 *      "index": 1,             编号
 *      "from": '2018-05-01',   起始时间
 *      "to": '2018-05-07',     结束时间
 *      "children": 2,          直属数量
 *      "descendants": 3        下级数量
 *      "tachieve": 400,        总业绩
 *      "sachieve": 200,        自己业绩
 *      "cachieve": 200,        下级业绩
 *      "rate": 0.1,            分红比例
 *      "rebate": 100,           分红数
 *  }]
 */
router.get('/rebate/self', (req, res) => {
    let user = userManager.getUserBySession(req.sessionID);
    let userId = user.attrs.id;
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    if (!utils.isId(userId) ||
        !utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_user_rebate_self', [userId, pindex, psize, null, null, null, null], true, (err, data) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        utils.responseOK(res, data[0]);
    });
});



/**
 * @api {post} user/message/commit 新增消息
 * @class user
 * @param {id} userId            发布人ID 
 * @param {number} type          类型(1:跑马灯;2:公告)
 * @param {string} title         标题
 * @param {string} content       内容
 * @param {number} pub_type      发布类型(1：立即发布；2：延迟发布)
 * @param {number} pubtimes      发布次数
 * @param {number} pub_gap       发布间隔
 * @param {date} pub_time        发布时间
 */
router.route('/message/commit').post((req, res) => {
    let { userId, type, title = null, content, pub_type, pubtimes = null, pub_gap = null, pub_time = null, status = 0 } = req.body;
    if (!utils.isId(userId) ||
        !utils.isNumber(type) ||
        (title && !utils.isString(title)) ||
        !utils.isString(content) ||
        !utils.isNumber(pub_type) ||
        (pubtimes && !utils.isNumber(pubtimes)) ||
        (pub_gap && !utils.isNumber(pub_gap)) ||
        (pub_time && !utils.isDate(pub_time))) {
        utils.responseError(res);
        return;
    }

    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    let msg = type == 1 ? content : JSON.stringify({ title: title, content: content, create_time: utils.date.timestamp() });
    if (pub_type == 1) {
        server.postp((type == 1 ? 'inspector/broadcast' : 'inspector/announce'), { channel: 'default', msg }).then((result) => {
            if (result == 'ok') {
                db.call('proc_message_manage_add', [userId, type, title, content, pub_type, pubtimes, pub_gap, pub_time, 1], true, (err, result) => {
                    if (err) {
                        utils.response(res, cons.ResultCode.DB_ERROR());
                        return;
                    }
                    let error = result[0][0].error;
                    if (error) {
                        return utils.responseError(res, error);
                    }

                    let params = {};
                    params.userId = operateid;
                    params.module = '消息管理';
                    params.desc = operateid + '新增消息：' + content + ',成功';
                    params.opname = '新增消息';
                    adminlog.external(req, params);
                    params.ext1 = title;
                    params.ext2 = content;
                    params.ext3 = userId;
                    params.columns = [];
                    adminlog.logadmin(params);

                    utils.responseOK(res);
                    return;
                });
            }
        });
    } else {
        db.call('proc_message_manage_add', [userId, type, title, content, pub_type, pubtimes, pub_gap, pub_time, status], true, (err, result) => {
            if (err) {
                utils.response(res, cons.ResultCode.DB_ERROR());
                return;
            }
            let error = result[0][0].error;
            if (error) {
                return utils.responseError(res, error);
            }

            utils.responseOK(res);
        });
    }


}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});


/**
 * @api {post} user/message/update  更新消息内容
 * @class user
 * @param {id} msgId             消息id
 * @param {string} content       内容
 * @param {date} pub_time        发布时间
 * @param {number} pubtimes      发布次数
 * @param {number} pub_gap       发布间隔
 */
router.route('/message/update').post((req, res) => {
    let { msgId, title = null, content, pub_time, pubtimes, pub_gap } = req.body;
    if (!utils.isId(msgId) ||
        (title && !utils.isString(title)) ||
        !utils.isString(content) ||
        !utils.isDate(pub_time) ||
        !utils.isNumber(pubtimes) ||
        !utils.isNumber(pub_gap)) {
        utils.responseError(res);
        return;
    }
    db.call('proc_message_manage_update', [msgId, title, content, pub_time, pubtimes, pub_gap], true, (err, result) => {
        if (err) {
            utils.response(res, cons.ResultCode.DB_ERROR());
            return;
        }
        let error = result[0][0].error;
        if (error) {
            return utils.responseError(res, error);
        }

        utils.responseOK(res);
    });
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});


/**
 * @api {get} user/message/list     消息列表
 * @class user
 * @param {number} pindex        分页索引
 * @param {number} psize         分页大小
 * @param {string} dateStart     起始时间 
 * @param {string} dateEnd       结束时间
 * @param {string} search        搜索条件
 * @param {number} published     全部(-1) 未发布(0) 已发布(1) 已过期(2)
 * @param {number} typenum       全部(0) 跑马灯(1) 公告(2)
 * @apiSuccess {json}               返回
 *  [{
 *      "msgId": 111111,        消息msgId
 *      "title": 111111,        公告标题
 *      "create_time":          创建时间
 *      "type": 1,              type 类型(1:跑马灯;2:公告)
 *      "content": 'www',       内容
 *      "pub_time": '2018-05-07 12:12:12',     发布时间
 *      "pubtimes": 2,          发布次数
 *      "pub_gap": 3            发布间隔
 *      "status": 0,            状态(0未发布,1已发布，2发布过期)
 *      "account":              发布人
 *  }]
 */
router.get('/message/list', (req, res) => {
    let userId = null;
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let { published = -1, typenum = 0 } = req.query;
    let search = req.query.search || null;

    let dateStart = utils.isString(req.query.dateStart, 0, 30) ? req.query.dateStart : null;
    let dateEnd = utils.isString(req.query.dateEnd, 0, 30) ? req.query.dateEnd : null;
    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0) ||
        (search && !utils.isString(search))) {
        utils.responseError(res);
        return;
    }

    db.call('proc_message_manage_list', [userId, pindex, psize, published, typenum, search, dateStart, dateEnd], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        let data = result[0];
        let total = result[1][0].total;
        utils.responseOK(res, { data, total });
    });
});


/**
 * @api {get} user/announce/details     获取公告列表
 * @class user
 * @apiSuccess {json}                   返回
 *  [{
 *      "title": '231',                 公告标题
 *      "content": '123123',            公告内容
 *      "create_time": ''               公告时间
 *  }]
 */
router.get('/announce/details', (req, res) => {
    db.list('message_manage', { type: 2, status: 1 }, (err, rows) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        _.each(rows, (row) => {
            row.create_time = utils.date.formatYYMMDDHHMMSS(row.create_time);
        });
        utils.responseOK(res, rows);
    });
});


/** 
 * @api {post} user/message/del 删除消息
 * @class user
 * @param {id} msgId 消息ID（要删除的消息ID）
 */
router.post('/message/del', (req, res) => {
    let msgId = parseInt(req.body.msgId);

    if (!utils.isNumber(msgId)) {
        utils.responseError(res);
        return;
    }

    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    db.delete('message_manage', { id: msgId }, (err) => {
        if (err) {
            utils.response(res, cons.ResultCode.ADMIN_PERMISSION_DELETE_ERROR());
            return;
        }
        let params = {};
        params.userId = operateid;
        params.module = '消息管理';
        params.desc = operateid + '删除消息：' + msgId + ',成功';
        params.opname = '新增消息';
        adminlog.external(req, params);
        params.ext1 = msgId;
        params.ext2 = null;
        params.ext3 = null;
        params.columns = [];
        adminlog.logadmin(params);
        return utils.responseOK(res);
    });
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});

// /**
//  * @api {post} user/register/account/commit 玩家账号注册 - 提交信息
//  * @class user
//  * @param {string} account 账号
//  * @param {string} password 密码
//  * @param {string} device 设备类型
//  * @param {number} sex 性别
//  */
// router.route('/register/account/commit').post((req, res) => {
//     let { account, password, sex, device, agentId, deviceid, ip } = req.body;

//     if (!utils.isString(account, 1, 30) || !utils.isString(deviceid) ||
//         !utils.isString(password, 1, 30) ||
//         !utils.isString(device, 1, 30) ||
//         !utils.isNumber(sex, 0, 1)) {
//         utils.responseError(res);
//         return;
//     }

//     (async () => {
//         let SameIPLogin = await model.Setting.find({ where: { key: 'SameIPLogin' } });
//         let SameDeviceLogin = await model.Setting.find({ where: { key: 'SameDeviceLogin' } });
//         console.log('SameIPLogin:' + SameIPLogin.value);
//         console.log('SameDeviceLogin:' + SameDeviceLogin.value);

//         // 临时处理接受客户端的IP
//         if (!ip) {
//             ip = utils.ip(requestIp.getClientIp(req));
//         }

//         model.User.count({ where: { ip: ip } }).then(count => {
//             if (count >= (SameIPLogin.value || 10)) {       //同IP最多10个注册账号
//                 utils.response(res, cons.ResultCode.SAMEIP_USERS_OVERED());
//             } else {
//                 model.User.count({ where: { deviceid: deviceid } }).then(devicecount => {
//                     if (devicecount >= (SameDeviceLogin.value || 1)) {
//                         utils.response(res, cons.ResultCode.SAME_DEVICEID());
//                     } else {
//                         if (agentId) {  //如果存在agnetid 就是代理的包里面写定的agentid
//                             sao.user.register(account, device, ip, account, password, null, cons.Role.USER(), cons.UserType.AUTH(), sex, agentId, deviceid, (result) => {
//                                 utils.response(res, result);
//                             });
//                         } else {
//                             /*db.find('user_agentbind_list', { userip: ip, state: 0 }, (err, row) => {//如果不存在agnetid 需要查询是否是ip绑定
//                                 if (row && row.agentid) {
//                                     agentId = row.agentid;
//                                     db.update('user_agentbind_list', { id: row.id }, { state: 1 });

//                                 }

//                                 sao.user.register(account, device, ip, account, password, null, cons.Role.USER(), cons.UserType.AUTH(), sex, agentId, deviceid, (result) => {
//                                     utils.response(res, result);
//                                 });
//                             });*/
//                             redis.get(`WebServer:Bind:${ip}`, (reply) => {
//                                 if (reply) {
//                                     agentId = reply;
//                                     logger.info('绑定成功,agentid:', reply, 'userip:', ip);

//                                     redis.del(ip, (reply) => {
//                                         if (reply) {
//                                             console.log('删除成功');
//                                         }
//                                     });
//                                 }
//                                 sao.user.register(account, device, ip, account, password, null, cons.Role.USER(), cons.UserType.AUTH(), sex, agentId, deviceid, (result) => {
//                                     utils.response(res, result);
//                                 });
//                             });
//                         }

//                     }
//                 }).catch(err => {
//                     console.error(err);
//                     return Promise.reject(cons.ResultCode.ERROR);
//                 });
//             }
//         }).catch(err => {
//             console.error(err);
//             return Promise.reject(cons.ResultCode.ERROR);
//         });
//     })();

// }).options((req, res) => {
//     res.set('Access-Control-Allow-Origin', '*');
//     res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
//     res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
//     res.end('');
// });

// /**
//  * @api {get, post} user/register/agent/bind 玩家推广页绑定代理
//  * @class user
//  * @param {string} agentid 代理ID
//  * @param {string} userip 用户ip
//  */
// router.route('/register/agent/bind', (req, res) => {
//     let agentid = req.query.agentid;
//     let userip = req.query.userip;

//     agentid = parseInt(agentid);
//     if (!utils.isNumber(agentid, 1)) {
//         return;
//     }

//     redis.set(`WebServer:Bind:${userip}`, agentid.toString());
//     redis.expire(userip, 60 * 30);
//     logger.info('新增注册绑定', 'agentid:', agentid, 'userip:', userip);
//     utils.response(res);
// });

/**
 * @api {post} user/register/agent/bind 玩家推广页绑定代理
 * @class user
 * @param {string} agentId 代理ID
 * @param {string} userIp 用户ip
 */
router.route('/register/agent/bind').all((req, res) => {
    let agentId, userIp = null;
    if (req.method == 'GET') {
        agentId = req.query.agentid;
        userIp = req.query.userip;
    } else if (req.method == 'POST') {
        agentId = req.body.agentid;
        userIp = req.body.userip;
    }

    agentId = parseInt(agentId);
    if (!utils.isNumber(agentId, 1)) {
        return;
    }

    redis.set(`WebServer:Bind:${userIp}`, agentId.toString());
    redis.expire(userIp, 60 * 30);
    logger.info('新增注册绑定', 'agentId:', agentId, 'userIp:', userIp);
    utils.response(res);
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});

/**
 * 暂时废弃
 * @api {post} user/register/commit 玩家注册 - 提交信息 
 * @class user
 * @param {string} account 账号 - 手机号码
 * @param {string} code 验证码
 * @param {string} nick 昵称
 * @param {string} password 密码
 * @param {string} device 设备类型
 * @param {enum} sex 性别
 */
// router.route('/register/commit').post((req, res) => {
//     let { account, code, nick, password, recommender, sex, device, agentId, deviceid } = req.body;
//     if (!utils.isString(account, 1, 30) || !utils.isString(deviceid, 1) ||
//         !utils.isString(nick, 1, 30) ||
//         !utils.isString(password, 1, 30) ||
//         !utils.isString(device, 1, 30) ||
//         !utils.isNumber(sex, 0, 1)) {
//         utils.responseError(res);
//         return;
//     }

//     if (recommender && !utils.isId(recommender)) {
//         utils.responseError(res);
//         return;
//     }

//     if (!smsManager.commit(cons.SMS.USER_REGISTER(), account, code)) {
//         utils.response(res, cons.ResultCode.CODE_ERROR());
//         return;
//     }

//     let ip = utils.ip(requestIp.getClientIp(req));
//     let SameIPLogin = model.Setting.find({ where: { key: 'SameIPLogin' } });
//     let SameDeviceLogin = model.Setting.find({ where: { key: 'SameDeviceLogin' } });
//     console.log('SameDeviceLogin:' + SameDeviceLogin.value);

//     model.User.count({ where: { ip: ip } }).then(count => {
//         if (count >= 10) {//同IP最多10个注册账号
//             utils.response(res, cons.ResultCode.SAMEIP_USERS_OVERED());
//         } else {
//             model.User.count({ where: { deviceid: deviceid } }).then(devicecount => {
//                 if (devicecount >= (SameDeviceLogin.value || 1)) {
//                     utils.response(res, cons.ResultCode.SAME_DEVICEID());
//                 } else {
//                     sao.user.register(account, device, ip, nick, password, recommender, cons.Role.USER(), cons.UserType.AUTH(), sex, agentId, deviceid, (result) => {
//                         utils.response(res, result);
//                     });
//                 }
//             }).catch(err => {
//                 console.error(err);
//                 return Promise.reject(cons.ResultCode.ERROR);
//             });
//         }
//     }).catch(err => {
//         console.error(err);
//         return Promise.reject(cons.ResultCode.ERROR);
//     });
// }).options((req, res) => {
//     res.set('Access-Control-Allow-Origin', '*');
//     res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
//     res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
//     res.end('');
// });

/**
 * @api {get} user/register/send/action
 * @class user
 * @param {string} account 账号 - 手机号码
 * @param {string} geetest_challenge
 * @param {string} geetest_validate
 * @param {string} geetest_seccode
 * @return 
 */
router.get('/register/send/action', (req, res) => {
    let account = req.query.account;
    let geetest_challenge = req.query.geetest_challenge;
    let geetest_validate = req.query.geetest_validate;
    let geetest_seccode = req.query.geetest_seccode;

    if (!utils.isString(account, 1, 30)) {
        utils.responseError(res);
        return;
    }

    // 对提供的验证凭证进行二次验证
    captcha.validate(req.session.fallback, {
        geetest_challenge: geetest_challenge,
        geetest_validate: geetest_validate,
        geetest_seccode: geetest_seccode
    }, (err, success) => {
        if (err) {
            utils.responseError(res, '网络错误');
        } else if (!success) {
            utils.responseError(res, '验证失败');
        } else {
            let ip = utils.ip(requestIp.getClientIp(req));

            db.find('user', { account }, (err, row) => {
                if (err) {
                    utils.responseError(res);
                    return;
                }

                if (row) {
                    utils.response(res, cons.ResultCode.USER_ACCOUNT_USED());
                    return;
                }

                if (!smsManager.checkIp(ip)) {
                    utils.response(res, cons.ResultCode.VERCODE_SAME_IP_ERROR());
                    return;
                }

                let code = smsManager.send(cons.SMS.USER_REGISTER(), account);
                utils.responseOK(res, utils.date.remain(code.timestamp, cons.SMS.SEND_INTERVAL()));
            });
        }
    });
});

/**
 * @api {get} user/register/send 玩家注册 - 发送验证码
 * @class user
 * @param {string} account 账号 - 手机号码
 */
router.get('/register/send', (req, res) => {
    let account = req.query.account;
    let code = req.query.code;
    let v = req.query.v;

    if (!utils.isString(account, 1, 30)
        || !utils.isString(code, 4, 6)
        || !utils.isString(v, 1, 30)) {
        utils.responseError(res);
        return;
    }

    if (!utils.checkVercode(v, code)) {
        utils.response(res, cons.ResultCode.VERCODE_ERROR());
        return;
    }

    let ip = utils.ip(requestIp.getClientIp(req));
    account.replace('/^86/g', '');
    account = '86' + account;

    db.find('user', { account }, (err, row) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        if (row) {
            utils.response(res, cons.ResultCode.USER_ACCOUNT_USED());
            return;
        }

        /*if (!smsManager.checkIp(ip)) {
            utils.response(res, cons.ResultCode.VERCODE_SAME_IP_ERROR());
            return;
        }*/

        let code = smsManager.send(cons.SMS.USER_REGISTER(), account);
        utils.responseOK(res, utils.date.remain(code.timestamp, cons.SMS.SEND_INTERVAL()));
    });
});

/**
 * @api {post} user/bind/account 游客绑定账号
 * @class user
 * @param {number} userId 玩家id
 * @param {string} account 要绑定的账号
 * @param {string} password 账号密码
 */
router.route('/bind/account').post((req, res) => {
    let { userId, account, password, deviceid, ip } = req.body;

    if (!utils.isId(userId) ||
        !utils.isString(account, 6, 12) ||
        !utils.isString(password, 6, 12)) {
        utils.responseError(res);
        return;
    }

    (async () => {
        let SameIPLogin = await model.Setting.find({ where: { key: 'SameIPLogin' } });
        let SameDeviceLogin = await model.Setting.find({ where: { key: 'SameDeviceLogin' } });
        console.log('SameIPLogin:' + SameIPLogin.value);
        console.log('SameDeviceLogin:' + SameDeviceLogin.value);

        // 临时处理接受客户端的IP
        if (!ip) {
            ip = utils.ip(requestIp.getClientIp(req));
        }

        model.User.count({ where: { ip: ip } }).then(count => {
            if (count >= (SameIPLogin.value || 10)) {       //同IP最多10个注册账号
                utils.response(res, cons.ResultCode.SAMEIP_USERS_OVERED());
            } else {
                model.User.count({ where: { deviceid: deviceid } }).then(devicecount => {
                    if (devicecount >= (SameDeviceLogin.value || 1)) {
                        utils.response(res, cons.ResultCode.SAME_DEVICEID());
                    } else {
                        server.get('user/bind/account', { userId, account, password }, (result) => {
                            utils.response(res, result);
                        });

                    }
                }).catch(err => {
                    console.error(err);
                    return Promise.reject(cons.ResultCode.ERROR);
                });
            }
        }).catch(err => {
            console.error(err);
            return Promise.reject(cons.ResultCode.ERROR);
        });
    })();
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});

/**
 * @api {get} user/bind/phone/commit 玩家绑定手机 提交验证码
 * @class user
 * @param {string} code 验证码
 * @param {string} name 玩家实名
 * @param {string} phone 绑定手机号码
 * @param {id} userId 玩家id
 */
router.get('/bind/phone/commit', (req, res) => {
    let code = req.query.code;
    // let name = req.query.name;
    let phone = req.query.phone;
    let userId = parseInt(req.query.userId);
    let password = req.query.password;

    if (!utils.isString(phone, 1, 30) ||
        !utils.isId(userId) ||
        !utils.isString(password, 1)) {
        utils.responseError(res);
        return;
    }

    if (!smsManager.commit(cons.SMS.USER_BIND_PHONE(), phone, code)) {
        utils.response(res, cons.ResultCode.CODE_ERROR());
        return;
    }

    server.get('user/bind/phone', { phone, userId, password }, (result) => {
        utils.response(res, result);
    });
});

/**
 * @api {get} user/bind/phone/send 玩家绑定手机 发送验证码
 * @class user
 * @param {string} phone 绑定手机号码
 * @param {id} userId 玩家id
 */
router.get('/bind/phone/send', (req, res) => {
    let phone = req.query.phone;
    let userId = parseInt(req.query.userId);

    if (!utils.isString(phone, 1, 30) ||
        !utils.isId(userId)) {
        utils.responseError(res);
        return;
    }

    db.find('user', { id: userId }, (err, row) => {
        if (!row) {
            utils.response(res, cons.ResultCode.UNKNOWN_USER());
            return;
        }

        if (row.phone) {
            utils.response(res, cons.ResultCode.BINDED_USER_PHONE());
            return;
        }

        db.find('user', { phone }, (err, row) => {
            if (row) {
                utils.response(res, cons.ResultCode.USED_PHONE());
                return;
            }

            let code = smsManager.send(cons.SMS.USER_BIND_PHONE(), phone);
            code.remain = utils.date.remain(code.timestamp, cons.SMS.SEND_INTERVAL());
            utils.responseOK(res, code);
        });
    });
});

/**
 * @api {get} user/roundabout/free 大转盘摇奖免费版
 * @class user
 * @param {id} userId 玩家id
 * @apiSuccess {json} items 奖励物品
 */
router.get('/roundabout/free', (req, res) => {
    let userId = parseInt(req.query.userId);

    if (!utils.isId(userId)) {
        utils.responseError(res);
        return;
    }

    let reward = data.randomRoundabout('free');
    if (!reward) {
        utils.responseError(res);
        return;
    }

    let state = utils.item.isDiamond(reward.itemId) ? 1 : 0;
    dao.user.roundabout(userId, cons.Roundabout.FREE(), cons.RoundaboutCost.FREE(), reward.itemId, reward.count, state, (err, msg) => {
        if (err) {
            utils.response(res, err);
            return;
        }

        let items = utils.item.toItems(reward.itemId, reward.count);
        if (state === 1) {
            sao.item.changeItems(userId, items, cons.ItemChangeReason.ROUNDABOUT())
        } else {
            dao.mail.createMail_Roundabout(userId, reward.itemId, reward.count);
        }
        utils.responseOK(res, items);
    });
});


/**
 * @api {get} user/roundabout/diamond 大转盘摇奖钻石版
 * @class user
 * @param {id} userId 玩家id
 * @apiSuccess {json} items 奖励物品
 */
router.get('/roundabout/diamond', (req, res) => {
    let userId = parseInt(req.query.userId);

    if (!utils.isId(userId)) {
        utils.responseError(res);
        return;
    }

    let reward = data.randomRoundabout('diamond');
    if (!reward) {
        utils.responseError(res);
        return;
    }

    let state = utils.item.isDiamond(reward.itemId) ? 1 : 0;
    sao.item.useDiamond(userId, cons.RoundaboutCost.DIAMOND(), cons.ItemChangeReason.ROUNDABOUT_COST(), false, (result) => {
        if (!utils.crOK(result)) {
            utils.response(res, result);
            return;
        }

        let items = utils.item.toItems(reward.itemId, reward.count);
        if (state === 1) {
            sao.item.changeItems(userId, items, cons.ItemChangeReason.ROUNDABOUT())
        } else {
            dao.mail.createMail_Roundabout(userId, reward.itemId, reward.count);
        }
        dao.user.roundabout(userId, cons.Roundabout.DIAMOND(), 0, reward.itemId, reward.count, state);
        utils.responseOK(res, items);
    });
});


/**
 * @api {get} user/roundabout/remain 大转盘摇奖剩余次数
 * @class user
 * @param {id} userId 玩家id
 */
router.get('/roundabout/remain', (req, res) => {
    let userId = parseInt(req.query.userId);

    if (!utils.isId(userId)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_user_roundabout_remain', [userId], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        utils.responseOK(res, Math.floor(result[0][0].remain / cons.RoundaboutCost.FREE()));
    });
});


/**
 * @api {get} user/property/rank        玩家日均排行
 * @class user
 * @class {number} typenum              账号类型
 * @param {number} pindex            分页索引
 * @param {number} psize             分页大小
 * @apiSuccess {json} 返回
 *  [{
 *      "id": 100001,       id
 *      "userId": 5555      玩家ID
 *      "account": "123",   账号
 *      "nick": "123",      昵称
 *      "head": "4",        头像
 *      "type": "1001",     玩家类型(1001为特殊账号)
 *      "gcoin": 200,       gcoin货币的抽样数量
 *      "wfee": 200,        wfee货币的抽样数量
 *      "property": 400,    资产数 = gcoin + wfee
 *      "rank": 3,          排名
 *  }]
 */
router.get('/property/rank', (req, res) => {
    let { typenum = 0 } = req.query;
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_user_property_hourly', [typenum, pindex, psize], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        let data = result[0];
        _.each(result[0], (r, index) => {
            r.rank = index + 1 + pindex * psize;
        })
        let total = _.values(result[1]) ? (_.values(result[1]).length > 1000 ? 1000 : _.values(result[1]).length) : 0;
        utils.responseOK(res, { data, total });
    });
});

/**
 * @api {get} user/single/rank          玩家个人排名
 * @class user
 * @param {number} userId            玩家id
 * @apiSuccess {json} 返回
 *  [{
 *      "rank": "1",        排名
 *      "property": 400,    资产数
 *  }]
 */
router.get('/single/rank', (req, res) => {
    let userId = parseInt(req.query.userId);

    if (!utils.isId(userId)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_user_single_rank', [], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        let data = _.find(result[0], (r, index) => {
            r.rank = index + 1;
            if (r.userId == userId) { return r; }
        })
        utils.responseOK(res, _.pick(data, 'rank', 'property'));
    });
});

/**
 * @api {post} user/pay/complete 充值回调
 * @class user
 * @param {string} account 账号 - 手机号码
 * @param {string} code 验证码
 * @param {string} password 密码
 */
router.route('/pay/complete').post((req, res) => {
    let { account, order, money } = req.body;

    if (!utils.isString(account, 1, 30) ||
        !utils.isString(order, 1, 255)) {
        utils.responseError(res);
        return;
    }

    let user = userManager.getUserByAccount(account);
    if (!user) {
        utils.responseError(res);
        return;
    }

    sao.user.payComplete(account, order, money, (result) => {
        utils.response(res, result);
    });
});

/**
* @api {post} user/withdraw/complete 提现回调
* @class user
* @param {string} account 账号 - 手机号码
* @param {string} code 验证码
* @param {string} password 密码
*/
router.route('/withdraw/complete').post((req, res) => {
    let { account, order, money } = req.body;

    if (!utils.isString(account, 1, 30) ||
        !utils.isString(order, 1, 255)) {
        utils.responseError(res);
        return;
    }

    let user = userManager.getUserByAccount(account);
    if (!user) {
        utils.responseError(res);
        return;
    }

    sao.user.withdrawComplete(account, order, money, (result) => {
        utils.response(res, result);
    });
});

/**
 * @api {get} user/bank/list 获取玩家银行卡
 */
router.get('/bank/list', (req, res) => {
    let { userId } = req.query;

    if (!utils.isId(parseInt(userId))) {
        return utils.responseError(res);
    }

    db.call('proc_user_bank_details', [userId], true, (err, data) => {
        if (err) {
            utils.responseBDError(res);
            return;
        }

        utils.responseOK(res, data[0]);
    });
});

/**
 * @api {get} user/belongto 设置玩家的上级代理
 */
router.get('/belongto', (req, res) => {
    let id = parseInt(req.query.id);
    let parentId = parseInt(req.query.parentid);
    if (!utils.isNumber(id)) {
        return utils.responseError(res);
    }
    if (!utils.isNumber(parentId)) {
        return utils.responseError(res);
    }
    let account = req.query.account;
    db.call('proc_user_belongto', [id, parentId], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        let obj = result[0][0];
        let msg = '失败';
        let code = -1;
        if (typeof (obj['0']) != 'undefined') {
            msg = '成功';
            code = obj['0'];
        }
        else {
            msg = '失败';
            code = obj['1'];
        }

        utils.responseOK(res, { text: msg, code: code });
    });
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});

router.get('/shareurl', (req, res) => {
    /*model.User.count({ where: { ip:'192.168.31.116' } }).then(data => {
        utils.response(res, { code:200, msg: data});
        return req.sessionID;
    }).catch(err => {
        console.error(err);
        return Promise.reject(cons.ResultCode.ERROR);
    });*/
    let url = req.query.url || "http://news.163.com";
    console.log('typeof:' + typeof (url));
    console.log('url:' + url);

    QRCode.toDataURL(url, (err, data_url) => {
        return utils.response(res, cons.ResultCode.OK(), { qrcode: data_url });
    });
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});

/**
 * 获取推广接口
 * @api get '/user/mytuiguang'
 */
router.get('/mytuiguang', (req, res) => {
    let agentId = req.query.agentId;
    model.Setting.find({ where: { key: 'tuiguang' } }).then(data => {
        let url = data.value + '?agentid=' + agentId;
        QRCode.toDataURL(url, (err, data_url) => {
            return utils.response(res, cons.ResultCode.OK(), { qrcode: url, webqrcode: data_url });
        });
        return req.sessionID;
    }).catch(err => {
        console.error(err);
        return Promise.reject(cons.ResultCode.ERROR);
    });
});

/**
 * 获取推广接口
 * @api get '/user/recommend/qrcode'
 */
router.get('/recommend/qrcode', (req, res) => {
    let agentId = req.query.agentId;
    model.Setting.find({ where: { key: 'tuiguang' } }).then(data => {
        let url = data.value + '?agentid=' + agentId;
        QRCode.toDataURL(url, (err, data_url) => {
            var base64Data = data_url.replace(/^data:image\/png;base64,/, '');
            let img = Buffer.from(base64Data, 'base64');
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': img.length,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(img);
        });
        return req.sessionID;
    }).catch(err => {
        console.error(err);
        return Promise.reject(cons.ResultCode.ERROR);
    });
});

module.exports = router;
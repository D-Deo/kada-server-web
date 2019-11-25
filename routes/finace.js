const _ = require('underscore');
const cons = require('../app/common/constants');
const db = require('../app/db');
const express = require('express');
const model = require('../app/db/model');
const sao = require('../app/server/sao');
const saop = require('../app/server/saop');
const utils = require('../app/utils/utils');
const server = require('../app/server/index');
const permission = require('../app/utils/permission');
const adminlog = require('../app/utils/adminlog');
const logger = require('log4js').getLogger('user');
const userManager = require('../app/user/manager');
var events = require('events');
var eventEmitter = new events.EventEmitter();
const axios = require('axios');
var https = require('https');
var url = require('url');
var util = require('util');
const conf = require(`../config/${process.env.conf}.json`);

let router = express.Router();

/**
 * @api {get} /finace/pay/records 充值记录
 * @class finace
 * @param {number} userId 玩家id
 * @param {number} state 状态
 * @param {number} pindex 页索引 0开始
 * @param {number} psize 页大小
 */
router.get('/pay/records', (req, res) => {
    let userId = req.query.userId;
    let id = req.query.id;
    let orderId = req.query.orderId;//渠道订单id
    let minMoney = parseInt(req.query.minMoney);
    let maxMoney = parseInt(req.query.maxMoney);
    let state = parseInt(req.query.state);
    let push = parseInt(req.query.push);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let type = parseInt(req.query.type);
    let channel = req.query.channel;
    let level = req.query.level;
    let from = req.query.from;
    let to = req.query.to;
    let pay = parseInt(req.query.pay);
    // let all = req.query.all;
    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    pindex = pindex >= 0 ? pindex : null;
    psize = psize >= 0 ? psize : null;
    if ((pindex && !utils.isNumber(pindex, 0)) ||
        (psize && !utils.isNumber(psize, 0))) {
        utils.responseError(res);
        return;
    }

    id = utils.isString(id, 1) ? id : null;
    orderId = utils.isString(orderId, 1) ? orderId : null;
    minMoney = utils.isNumber(minMoney) ? minMoney : null;
    maxMoney = utils.isNumber(maxMoney) ? maxMoney : null;
    userId = utils.isString(userId) ? userId : null;
    state = utils.isNumber(state, -1) ? state : null;
    push = utils.isNumber(push, -1) ? push : null;
    type = utils.isNumber(type) ? type : null;
    channel = utils.isString(channel) ? channel : null;
    level = utils.isString(level) ? level : -1;
    pay = utils.isNumber(pay) ? pay : null;
    from = utils.isString(from, 1) ? from : null;
    to = utils.isString(to, 1) ? to : null;
    // all = all == 'true' ? 1 : 0;

    (async () => {
        if (operateid && utils.isNumber(operateid)) {
            if (user.attrs.role != 3) {//代理
                operateid = null;
            }
        }

        db.call('proc_user_pay_details', [pay, userId, channel, type, state, push, minMoney, maxMoney, level, id, orderId, operateid, from, to, pindex, psize], true, (err, result) => {
            if (err) {
                utils.responseError(res);
                return;
            }

            let data = result[0];
            if (!pindex && !psize) {
                utils.responseOK(res, { data });
                return;
            }
            let total = result[1][0].total;
            let payMoney = result[2][0].payMoney || 0;
            let payPersonCount = result[3][0].payPersonCount || 0;
            let pushCoin = result[4][0].pushCoin || 0;
            utils.responseOK(res, { data, total, payMoney, pushCoin, payPersonCount });
        });
    })();
});

/**
 * @api {get} /finace/pay/channels 获取充值渠道
 * @param {number} userId 玩家ID
 */
router.get('/pay/channels', (req, res) => {
    let { userId } = req.query;

    if (!utils.isId(parseInt(userId))) {
        utils.responseError(res);
        return;
    }

    db.call('proc_user_pay_channel', [parseInt(userId)], true, (err, data) => {
        if (err) {
            logger.error(err);
            return utils.responseBDError(res);
        }
        return utils.responseOK(res, data[0]);
    });
});

/**
 * @api {get} /finace/pay/channels/vip 获取VIP充值渠道
 * @param {number} userId 玩家ID
 */
router.get('/pay/channels/vip', (req, res) => {
    let { userId } = req.query;

    if (!utils.isId(parseInt(userId))) {
        utils.responseError(res);
        return;
    }

    db.call('proc_user_pay_channel_vip', [parseInt(userId)], true, (err, data) => {
        if (err) {
            logger.error(err);
            return utils.responseBDError(res);
        }
        return utils.responseOK(res, data[0]);
    });
});

/**
 * @api {post} /finace/pay/order 充值下单
 * @param {number} userId 玩家ID
 * @param {number} money 充值金额（单位RMB）
 * @param {number} type 充值类型（0官方 1微信 2QQ钱包 3支付宝 4银联 5京东钱包
 * @param {string} channelId 充值渠道ID
 */
router.route('/pay/order').post((req, res) => {
    let { userId, money, type, channelId, bankCode } = req.body;

    if (!utils.isNumber(parseInt(type), 0, 5) ||
        !utils.isId(parseInt(userId)) ||
        !utils.isNumber(parseInt(money), 1) ||
        !utils.isString(channelId, 1)) {
        utils.responseError(res);
        return;
    }

    bankCode = utils.isString(bankCode, 1) ? bankCode : null;

    let platform = conf.payapi.name || "";
    platform = platform.replace("/", "");

    let id = 'P' + _.now() + _.random(1000, 9999);
    if (platform && platform.length > 0)
        id = id + "_" + platform;

    model.ConfigChannel.findById(channelId).then(channel => {
        if (!channel) {
            return utils.responseError(res, '该渠道不存在');
        }
        if (channel.pay == 0) {
            switch (channel.type) {
                case 1:
                    model.PayChannelWx.find({ where: { channelId: channelId } }).then(wx => {
                        if (!wx) {
                            return utils.responseError(res, '当前没有开通');
                        }
                        return utils.responseOK(res, { mode: 2, wx: { id: wx.id, name: wx.name, account: wx.account, qrcode: wx.qrcode, reason: '', /* payChannel.reason ,*/ orderId: id } });
                    });
                    return;
                case 3:
                    model.PayChannelAli.find({ where: { channelId: channelId } }).then(ali => {
                        if (!ali) {
                            return utils.responseError(res, '当前没有开通');
                        }
                        return utils.responseOK(res, { mode: 3, ali: { id: ali.id, account: ali.account, qrcode: ali.qrcode, reason: '', /* payChannel.reason ,*/ orderId: id } });
                    });
                    return;
                case 4:
                    model.PayChannelUnion.find({ where: { channelId: channelId } }).then(bank => {
                        if (!bank) {
                            return utils.responseError(res, '当前没有开通');
                        }
                        return utils.responseOK(res, { mode: 1, bank: { id: bank.id, name: bank.name, bank: bank.bank, bankNo: bank.bankNo, reason: '', /* payChannel.reason, */ orderId: id } });
                    });
                    return;
            }
        } else {
            model.PayChannel.find({ where: { channelId: channelId } }).then(chan => {
                if (!chan) {
                    return utils.responseError(res, '渠道不存在');
                }
                if (!chan.minpay || money < chan.minpay) {
                    return utils.responseError(res, '充值金额小于最小充值金额');
                }
                if (!chan.maxpay || money > chan.maxpay) {
                    return utils.responseError(res, '充值金额大于最大充值金额');
                }

                logger.info('channel: ', 'http://' + conf.payapi.host + ':' + conf.payapi.port, channel.api);

                try {
                    server.get(channel.api, {
                        orderId: id,
                        money,
                        type: type == 1 ? 1 : 0
                    }, (ret) => {
                        if (ret.code != 200 || !ret.success) {
                            logger.error(ret);
                            return utils.responseError(res, ret.message);
                        }

                        db.call('proc_user_pay', [id, userId, money, type, channelId, 0, '', ret.data.code], true, (err) => {
                            if (err) {
                                logger.error('proc_user_pay error', err);
                                return utils.responseBDError(res);
                            }
                            return utils.responseOK(res, { mode: 0, id, url: ret.data.url });
                        });
                    }, 'http://' + conf.payapi.host + ':' + conf.payapi.port);
                } catch (e) {
                    logger.info(e);
                    return utils.responseError(res, '充值异常');
                }
            });
            return;
        }

        return utils.responseError(res, '当前没有开放充值渠道');
    }).catch(err => {
        if (err) {
            logger.error(err);
            return utils.responseBDError(res);
        }
    });
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});

/**
 * @api {post} /finace/pay/order/result 充值下单回调
 */
router.route('/pay/order/result').post((req, res) => {
    let { ordernumber, paymoney, sysnumber, orderstatus, sign } = req.body;

    if (!utils.isString(paymoney, 1) ||
        !utils.isString(sysnumber, 1, 50) ||
        !utils.isString(orderstatus, 1) ||
        !utils.isString(ordernumber, 1, 50) ||
        !utils.isString(sign, 1, 50)) {
        utils.responseError(res);
        return;
    }

    sign = sign.toLowerCase();

    let crypto = require('crypto');
    let content = sysnumber + ordernumber + orderstatus + paymoney + '99e0616a13e94591b1e815898e134898';
    let md5 = crypto.createHash('md5');
    md5.update(content);
    let _sign = md5.digest('hex').toLowerCase();
    logger.info('sign', _sign);
    if (_sign != sign) {
        utils.responseError(res, 'sign error: ' + _sign);
        return;
    }

    paymoney = parseInt(money);
    if (!utils.isNumber(paymoney, 1)) {
        return utils.responseError(res);
    }

    let status = 0;
    if (orderstatus == '1') {
        status = 1;
    }

    model.UserPay.find({
        where: { id: ordernumber, money: paymoney }
    }).then(userpay => {
        db.call('proc_user_pay_result', [ordernumber, paymoney, sysnumber, status], true, (err, result) => {
            if (err) {
                logger.error(err);
                return utils.responseBDError(res);
            }
            logger.info('proc_user_pay_result', userpay);

            sao.user.payComplete(userpay.userId, ordernumber, paymoney, 0, (result) => {
                utils.response(res, result.code, result.msg);
            });

            // 统计玩家的充值总额
            // db.call('proc_user_pay_statistics', [ordernumber, paymoney, status], true, () => { });
            // return utils.responseOK(res);
        });
    }).catch(err => {
        if (err) {
            logger.error(err);
            return utils.responseBDError(res);
        }
    });
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});

/**
 * @api {post} /finace/pay/order/ad 官方充值下单
 * @param {number} userId 玩家ID
 * @param {number} money 充值金额（单位RMB）
 * @param {number} type 充值类型
 * @param {string} channelId 充值渠道ID
 * @param {string} name 姓名
 * @param {string} orderTime 订单时间
 */
router.route('/pay/order/ad').post((req, res) => {
    let { userId, money, type, channelId, name, orderTime } = req.body;

    if (!utils.isId(userId) ||
        !utils.isNumber(money, 1) ||
        !utils.isString(channelId, 1) ||
        !utils.isNumber(type, 1) ||
        !utils.isString(name, 1) ||
        !utils.isString(orderTime, 1)) {
        return utils.responseError(res);
    }

    let id = 'P' + _.now() + _.random(100000, 999999);
    db.call('proc_user_pay', [id, userId, money, type, channelId, 0, name], true, (err, result) => {
        if (err) {
            logger.error(err);
            return utils.responseError(res);
        }

        utils.getEventEmitter().emit('newOrder', { type: 1, msg: '有新的充值订单待处理！', id: id, t: new Date().getTime() });
        utils.response(res, { code: 200, msg: "下单成功" });
    });
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});

/**
 * @api {get} /finace/pay/order/union 充值下单
 * @param {number} userId 玩家ID
 * @param {number} money 充值金额（单位RMB）
 * @param {string} channelId 充值渠道ID
 * @param {string} bank 开户账号
 * @param {string} bankNo 开户银行
 * @param {string} name 开户姓名
 * @param {string} orderTime 订单时间
 */
router.get('/pay/order/union', (req, res) => {
    let { userId, money, channelId, bank, bankNo, name, orderTime } = req.query;

    userId = parseInt(userId);
    money = parseInt(money);

    if (!utils.isId(userId) ||
        !utils.isNumber(money, 1) ||
        !utils.isString(channelId, 1) ||
        !utils.isString(bank, 1) ||
        !utils.isString(bankNo, 1) ||
        !utils.isString(name, 1) ||
        !utils.isString(orderTime, 1)) {
        return utils.responseError(res);
    }

    let id = 'p' + _.now() + _.random(100000, 999999);
    db.call('proc_user_pay', [id, userId, money, 4, channelId, 1, name], true, (err, result) => {
        if (err) {
            logger.error(err);
            return utils.responseError(res);
        }

        utils.getEventEmitter().emit('newOrder', { type: 1, msg: '有新的充值订单待处理！', id: id, t: new Date().getTime() });
        utils.response(res, { code: 200, msg: "提交成功" });
    });
});

/**
 * @api {get} /finace/pay/undo 撤销充值下单
 */
router.post('/pay/undo', (req, res) => {
    let { id, itemId, money, memo, orderId, adminId } = req.body;

    if (!utils.isId(id) ||
        !utils.isId(itemId) ||
        !utils.isNumber(money)) {
        utils.responseError(res);
        return;
    }

    (async () => {
        let pay = await model.UserPay.find({ where: { id: orderId, money } });
        if (!pay) {
            utils.responseError(res, '订单不存在');
            return;
        }

        if (pay.state == 0 || pay.state == 2 || pay.push != 1) {
            return utils.responseError(res, '订单已不可撤回');
        }

        if (utils.isId(adminId)) {
            let user = await model.User.findById(adminId);
            if (!user) {
                utils.responseError(res);
                return;
            }
            pay.adminId = adminId;

            let count = - (money * 100);
            saop.item.changeItem(id, itemId, count, {
                from: adminId + "",
                reason: cons.ItemChangeReason.ADMIN(),
                memo: memo
            }).then(p => {
                if (p['1'].remain == 0) {
                    return utils.responseError(res, '余额不足，撤回失败');
                }
                pay.push = 2;
                pay.state = 2;
                pay.save();

                return utils.responseOK(res);
            }).catch(err => {
                if (err) {
                    logger.error(err);
                    return utils.responseBDError(res);
                }
            });
        } else {
            return utils.responseError(res, '管理员不存在');
        }
    })();
});

router.get('/vipchannels', (req, res) => {
    let account = req.query.account;
    let displayName = req.query.displayName;
    let pay = parseInt(req.query.pay);
    let state = parseInt(req.query.state);
    let psize = parseInt(req.query.skip);
    let pindex = parseInt(req.query.page);

    if (pay == -1) {
        pay = null;
    }

    if (state == -1) {
        state = null;
    }

    if (!utils.isString(account, 1)) {
        account = null;
    }

    if (!utils.isString(displayName, 1)) {
        displayName = null;
    }

    db.call('proc_vipchannels', [account, displayName, pay, state, pindex, psize], true, (err, result) => {
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
 * @api {get} /finace/vipchannels/edit 修改VIP充值
 */
router.post('/vipchannels/edit', (req, res) => {
    let { id, account, displayName, pay, state, desc } = req.body;

    db.call('proc_vipchannel_edit', [id, account, displayName, desc, pay, state], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        utils.responseOK(res, '修改成功');
    });
});

router.post('/vipchannels/del', (req, res) => {
    let { id } = req.body;
    db.delete('pay_channel_vip', { id: id }, (err) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        utils.responseOK(res, '删除成功');
    });
});

/**
 * @api {get} /finace/pay/ingore 忽略充值订单
 */
router.post('/pay/ingore', (req, res) => {
    let { id, orderId, adminId } = req.body;

    if (!utils.isId(id)) {
        utils.responseError(res);
        return;
    }

    (async () => {
        let pay = await model.UserPay.find({ where: { id: orderId } });
        if (!pay) {
            utils.responseError(res, '订单不存在');
            return;
        }

        if (pay.state != cons.UserPayState.UNPAY()) {
            return utils.responseError(res, '只有未支付的订单才可以忽略');
        }

        if (utils.isId(adminId)) {
            let user = await model.User.findById(adminId);
            if (!user) {
                utils.responseError(res);
                return;
            }
            pay.adminId = adminId;

            pay.state = cons.UserPayState.INGORE();
            pay.save();

            return utils.responseOK(res);
        } else {
            return utils.responseError(res, '操作员不合法');
        }
    })();
});

/**
 * @api {post} /finace/pay/manual 手动充值
 * @class admin
 * @param {id} userId 操作员id
 * @param {id} id 订单id
 * @param {bool} commit 是否手动
 */
router.post('/pay/manual', (req, res) => {
    let { userId, id, money, commit } = req.body;

    if (!utils.isString(id, 1, 255)) {
        utils.responseError(res);
        return;
    }

    (async () => {
        let pay = await model.UserPay.find({ where: { id, money } });
        if (!pay) {
            utils.responseError(res, '订单不存在');
            return;
        }

        if (pay.state != 0 && (pay.state != 1 || pay.push != 0)) {
            return utils.responseError(res, '订单已完成过，不可重复提交');
        }

        if (utils.isId(userId)) {
            let user = await model.User.findById(userId);
            if (!user) {
                utils.responseError(res);
                return;
            }
            pay.adminId = userId;
            // pay.updateTime = _.now();
        }

        pay.commit = commit || 0;
        pay.save();

        sao.user.payComplete(pay.userId, pay.id, pay.money, pay.commit, (result) => {
            if (utils.isId(userId)) {
                let params = {};
                params.userId = userId;
                params.module = '充值订单';
                params.desc = userId + '给玩家' + pay.userId + '手动充值订单号：' + pay.id + ',充值' + pay.money + '元，成功';
                params.opname = '手动充值';
                adminlog.external(req, params);
                params.ext1 = pay.userId;
                params.ext2 = userId;
                params.ext3 = pay.money;
                params.columns = [];
                adminlog.logadmin(params);
            }
            logger.info('payComplete:' + result.code + ',' + result.msg);
            utils.response(res, result.code, result.msg);
        });
    })();
});

/**
 * @api {post} /finace/withdraw/submit 提现下单
 * @param {number} userId 玩家ID
 * @param {number} money 提现金额（单位RMB）
 * @param {number} coin 提现金币
 * @param {string} name 开户姓名
 * @param {string} bank 银行类型
 * @param {string} bankNo 银行账号
 */
router.route('/withdraw/submit').post((req, res) => {
    let { userId, money, coin, name, bank, bankNo } = req.body;

    if (!utils.isId(userId) ||
        !utils.isNumber(coin, 1) ||
        !utils.isString(name, 1) ||
        !utils.isString(bank, 1) ||
        !utils.isString(bankNo, 1)) {
        return utils.responseError(res);
    }

    //TODO: 两次提现之间的总充值、总投注（打码量）放到提现订单，由人工判断是否可以提现
    db.call('proc_user_journal', [userId, coin], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        if (!result[0][0].ok) {
            return utils.response(res, cons.ResultCode.WITHDRAW_ERROR());
        }

        sao.user.withdraw(userId, coin, name, bank, bankNo, (result) => {
            if (result.code == 200) {
                utils.getEventEmitter().emit('newOrder', { type: 2, msg: '有新的提现订单待处理！', userId: userId, count: coin, name: name, bank: bank, bankNo: bankNo, t: new Date().getTime() });
            }
            utils.response(res, result);
        });
    });
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});


/**
 * @api {post} /finace/withdraw/dm 获取打码量 充值总额
 * @param {number} userId 玩家ID
 * @param {number} id 提现订单号
 * @param {number} createTime 提现时间
 */
router.route('/withdraw/dm').post((req, res) => {
    let { userId, id, createTime } = req.body;

    if (!utils.isId(userId) ||
        !utils.isString(id, 1) ||
        !utils.isString(createTime, 1)) {
        return utils.responseError(res);
    }

    createTime = createTime.replace('T', ' ').replace('Z', '');
    db.call('proc_dm', [userId, id], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let dm = result[0][0].dm;
        let pay = result[1][0].pay;

        utils.responseOK(res, { dm, pay });
    });
});

/**
 * @api {get} /finace/withdraw/records 提现记录
 * @class finace
 * @param {number} userId 玩家id
 * @param {number} state 状态
 * @param {number} pindex 页索引 0开始
 * @param {number} psize 页大小
 * @apiSuccessExample 返回
 * {
 *     "count": 1, 总数，
 *     "rows": [ 数据集
 *         "userId":22
 *         "id":"abcdef"
 *         "uid":22
 *         "money":30000
 *         "state":1           0已下单 1已支付 2已取消
 *         "stateMsg":"aaa"
 *         "push":0            0未发放 1已发放
 *         "rate":0            兑换比例：比如100表示1元兑换100金币
 *     ]
 * }
 */
router.get('/withdraw/records', (req, res) => {
    let userId = req.query.userid;
    let state = parseInt(req.query.state);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let minMoney = parseInt(req.query.minMoney);
    let maxMoney = parseInt(req.query.maxMoney);
    let lock = parseInt(req.query.lock);
    let from = req.query.from;
    let to = req.query.to;
    let level = req.query.level;
    let orderid = req.query.orderid;
    let adminaccount = req.query.adminaccount;

    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    pindex = pindex >= 0 ? pindex : null;
    psize = psize >= 0 ? psize : null;
    if ((pindex && !utils.isNumber(pindex, 0)) ||
        (psize && !utils.isNumber(psize, 0))) {
        utils.responseError(res);
        return;
    }

    userId = utils.isString(userId) ? userId : null;
    from = utils.isDate(from) ? (from) : null;
    to = utils.isDate(to) ? (to) : null;

    minMoney = utils.isNumber(minMoney) ? minMoney : null;
    maxMoney = utils.isNumber(maxMoney) ? maxMoney : null;
    lock = utils.isNumber(lock) ? lock : null;
    level = utils.isString(level) ? level : -1;
    adminaccount = utils.isString(adminaccount, 1) ? adminaccount : null;
    orderid = utils.isString(orderid, 1) ? orderid : null;

    state = utils.isNumber(state, 0) ? state : null;
    (async () => {
        if (operateid && utils.isNumber(operateid)) {
            if (user.attrs.role != 3)
                operateid = null;
            db.call('proc_user_withdraw', [userId, state, from, to, minMoney, maxMoney, lock, level, orderid, adminaccount, operateid, pindex, psize], true, (err, result) => {
                if (err) {
                    utils.responseError(res);
                    return;
                }

                let data = result[0];
                if (!pindex && !psize) {
                    utils.responseOK(res, { data });
                    return;
                }

                let total = result[1][0].total;
                let withdrawPersonCount = result[2][0].withdrawPersonCount;
                let withdrawCount = result[3][0].withdrawCount;
                let allMoney = result[4][0].allMoney;
                let needWithdrawPersonCount = result[5][0].needWithdrawPersonCount;
                utils.responseOK(res, { data, total, allMoney, withdrawPersonCount, withdrawCount, withdrawPersonCount, needWithdrawPersonCount });
            });
        }
    })();
});

/**
 * @api {post} /finace/withdraw/lock 提现锁定
 * @class finace
 * @param {string} id 订单ID
 * @param {number} adminId 操作员ID 
 */
router.post('/withdraw/lock', (req, res) => {
    let { id, adminId } = req.body;
    if (!utils.isString(id, 1) ||
        !utils.isNumber(adminId)) {
        return utils.responseError(res);
    }

    (async () => {
        let user = await model.User.findById(adminId);
        if (!user) {
            return utils.response(res, cons.ResultCode.UNKNOWN_ADMIN());
        }

        let withdraw = await model.UserWithdraw.findById(id);
        if (!withdraw) {
            return utils.response(res, cons.ResultCode.ORDER_UNKNOWN());
        }

        withdraw.adminId = adminId;
        withdraw.lock = 1;
        withdraw.save();
        utils.responseOK(res);
    })();
});


/**
 * @api {post} /finace/withdraw/unlock 取消锁定
 * @class finace
 * @param {string} id 订单ID
 * @param {number} adminId 操作员ID 
 */
router.post('/withdraw/unlock', (req, res) => {
    let { id, adminId } = req.body;
    if (!utils.isString(id, 1) ||
        !utils.isNumber(adminId)) {
        return utils.responseError(res);
    }

    (async () => {
        let user = await model.User.findById(adminId);
        if (!user) {
            return utils.response(res, cons.ResultCode.UNKNOWN_ADMIN());
        }

        let withdraw = await model.UserWithdraw.findById(id);
        if (!withdraw) {
            return utils.response(res, cons.ResultCode.ORDER_UNKNOWN());
        }

        withdraw.adminId = adminId;
        withdraw.lock = 0;
        withdraw.save();
        utils.responseOK(res);
    })();
});

/**
 * @api {post} /finace/withdraw/audit 提现审核
 * @class finace
 * @param {id} userId 玩家id
 * @param {id} id 申请id
 * @param {bool} commit 是否通过
 * @param {bool} pass 是否忽略
 */
router.post('/withdraw/audit', (req, res) => {
    let { userId, id, commit, adminId, pass } = req.body;

    if (!utils.isNumber(userId, 1) ||
        !utils.isString(id, 1, 255) ||
        !utils.isNumber(adminId)) {
        return utils.responseError(res);
    }

    (async () => {
        let user = await model.User.findById(userId);
        if (!user) {
            return utils.response(res, cons.ResultCode.UNKNOWN_USER());
        }

        let admin = await model.User.findById(adminId);
        if (!admin) {
            return utils.response(res, cons.ResultCode.UNKNOWN_ADMIN());
        }

        let withdraw = await model.UserWithdraw.findById(id);
        if (!withdraw) {
            return utils.response(res, cons.ResultCode.ORDER_UNKNOWN());
        }

        if (!!commit) {
            withdraw.adminId = adminId;
            withdraw.lock = 0;
            withdraw.state = 1;
            withdraw.save();

            utils.responseOK(res);
        } else {
            if (pass) {
                withdraw.adminId = adminId;
                withdraw.lock = 0;
                withdraw.state = 3;
                withdraw.save();
                return utils.responseOK(res);
            }

            sao.user.withdrawRefuse(userId, id, withdraw.money, (result) => {
                if (result.code == 200) {
                    withdraw.adminId = adminId;
                    withdraw.lock = 0;
                    withdraw.state = 2;
                    withdraw.save();
                }
                return utils.response(res, result.code, result.msg);
            });
        }
    })();
});

/**
 * @api {post} /finace/withdraw/memo 提现备注
 * @class finace
 * @param {id} id 申请id
 * @param {bool} memo 备注
 */
router.post('/withdraw/memo', (req, res) => {
    let { id, memo, adminId } = req.body;

    if (!utils.isString(memo, 1, 255) ||
        !utils.isString(id, 1, 255)) {
        return utils.responseError(res);
    }

    (async () => {
        let withdraw = await model.UserWithdraw.findById(id);
        if (!withdraw) {
            return utils.response(res, cons.ResultCode.ORDER_UNKNOWN());
        }

        withdraw.memo = memo;
        withdraw.save();

        utils.responseOK(res);
    })();
});

/**
 * @api {get} /finace/item/records 资产变化记录
 * @class ether
 * @param {number} userId 玩家id
 * @param {number} state 状态
 * @param {number} pindex 页索引 0开始
 * @param {number} psize 页大小
 * @apiSuccessExample 返回
 * {
 *  "count": 1, 总数，
 *  "rows": [ 数据集
 *      "userId":22
 *      "id":"abcdef"
 *      "uid":22
 *      "money":30000
 *      "state":1           0已下单 1已支付 2已取消
 *      "stateMsg":"aaa"
 *      "push":0            0未发放 1已发放
 *      "rate":0            兑换比例：比如100表示1元兑换100金币
 *  ]
 * }
 */
router.post('/item/records', (req, res) => {
    let { userId, itemId, reason, level, game, from, to, pindex, psize, agentId } = req.body;

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    if (reason && !_.isNumber(reason, 0)) {
        return utils.responseError(res);
    }

    if (itemId && !_.isNumber(itemId)) {
        return utils.responseError(res);
    }

    if (level && !_.isNumber(level)) {
        return utils.responseError(res);
    }

    if (game && !_.isString(game, 1)) {
        return utils.responseError(res);
    }

    if (from && !_.isString(from)) {
        return utils.responseError(res);
    }

    if (to && !_.isString(to)) {
        return utils.responseError(res);
    }
    //to = to !== null ? to : null;

    agentId = utils.isNumber(agentId) ? agentId : null;

    permission.isAgent(agentId, (isAgent) => {
        agentId = isAgent ? agentId : null;
        db.call('proc_item_record_details', [userId, itemId, reason, level, game, from, to, agentId, pindex, psize], true, (err, result) => {
            if (err) {
                utils.responseError(res);
                return;
            }

            let data = result[0];
            let total = result[1][0].total;
            let count = result[1][0].count;
            utils.responseOK(res, { data, total, count });
        });
    }, res);
});


router.post('/pay/hide', (req, res) => {
    let { id, visiable } = req.body;

    if (!id) {
        return utils.responseError(res);
    }

    db.call('proc_user_pay_hide', [id, visiable], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        utils.responseOK(res);
    });
});

module.exports = router;
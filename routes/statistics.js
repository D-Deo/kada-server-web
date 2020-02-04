const cons = require('../app/common/constants');
const dao = require('../app/db/dao');
const data = require('../app/data');
const db = require('../app/db');
const express = require('express');
const model = require('../app/db/model');
const sao = require('../app/server/sao');
const saop = require('../app/server/saop');
const smsManager = require('../app/sms/manager');
const userManager = require('../app/user/manager');
const utils = require('../app/utils/utils');
const _ = require('underscore');
const co = require('co');
const thunkify = require('thunkify');
const server = require('../app/server/index');
const permission = require('../app/utils/permission');

let router = express.Router();

/**
 * @api {get} statistics/report/pay 充值统计
 * @class statistics
 */
router.get('/report/pay', (req, res) => {
    let { filter, pindex, psize } = req.query;

    pindex = parseInt(pindex) || 0;
    psize = parseInt(psize) || 0;

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 1)) {
        utils.responseError(res);
        return;
    }

    filter = utils.isString(filter, 1) ? JSON.parse(filter) : {};

    let from = utils.isDate(filter.from) ? filter.from : null;
    let to = utils.isDate(filter.to) ? filter.to : null;
    // if (/^\d{4}\-\d{1,2}\-\d{1,2}$/img.test(from)) {
    //     from = from + ' 00:00:00';
    // }
    // if (/^\d{4}\-\d{1,2}\-\d{1,2}$/img.test(to)) {
    //     to = to + ' 23:59:59.999';
    // }

    db.call('proc_pay_report', [pindex, psize, from, to], true, (err, result) => {
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
 * @api {get} statistics/ykbb 盈亏报表
 * @class statistics
 * @param {number} agentId 代理id
 * @param {number} from 起始时间
 * @param {number} to 结束时间
 * @param {number} pindex 页索引 0开始
 * @param {number} psize 页大小
 * @apiSuccessExample 返回
 * {
 *     "count": 1, 总数，
 *     "rows": [ 数据集 ]
 * }
 */
router.get('/ykbb', (req, res) => {
    let agentId = parseInt(req.query.agentId);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let from = req.query.from;
    let to = req.query.to;

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    agentId = utils.isNumber(agentId) ? agentId : null;
    from = utils.isDate(from) ? (from) : null;
    to = utils.isDate(to) ? (to) : null;
    if (/^\d{4}\-\d{1,2}\-\d{1,2}$/img.test(from)) {
        //from = from + ' 00:00:00';
    }
    if (/^\d{4}\-\d{1,2}\-\d{1,2}$/img.test(to)) {
        //to = to + ' 23:59:59.999';
    }

    permission.isAgent(agentId, (isAgent) => {
        agentId = isAgent ? agentId : null;
        db.call('proc_ykbb', [agentId, from, to, pindex, psize], true, (err, result) => {
            if (err) {
                utils.responseError(res);
                return;
            }

            let data = result[0];
            let total = result[1][0];
            //let today = result[2][0];
            utils.responseOK(res, { data, total });
        });
    }, res);
});

/**
 * @api {get} api/statistics/ykbb/zapp 盈亏报表（ZAPP）
 * @class statistics
 * @param {number} agentId 代理id
 * @param {number} from 起始时间
 * @param {number} to 结束时间
 * @param {number} pindex 页索引 0开始
 * @param {number} psize 页大小
 * @apiSuccessExample 返回
 * {
 *     "count": 1, 总数，
 *     "rows": [ 数据集 ]
 * }
 */
router.get('/ykbb/zapp', (req, res) => {
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let from = req.query.from;
    let to = req.query.to;

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    from = utils.isDate(from) ? (from) : null;
    to = utils.isDate(to) ? (to) : null;
    if (/^\d{4}\-\d{1,2}\-\d{1,2}$/img.test(from)) {
        //from = from + ' 00:00:00';
    }
    if (/^\d{4}\-\d{1,2}\-\d{1,2}$/img.test(to)) {
        //to = to + ' 23:59:59.999';
    }

    db.call('proc_ykbb_zapp', [from, to, pindex, psize], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let obj = {};
        // result[0] 新增用户 [1] 游戏用户 [2] 兑入 [3] 兑出 [4] 登录用户 [5] 次日留存 [6] 金币流水 [7] 金币税收 [8] 金币存款
        for (let i = 0; i < result.length; i++) {
            let ret = result[i];
            let total = 0;
            for (let rk in ret) {
                let r = ret[rk];
                if (!r.dateTime) continue;
                let o = obj[r.dateTime] = obj[r.dateTime] || {};
                total += Number(r.count) || 0;
                if (i == 0) {
                    o.newPlayers = o.newPlayers || 0;
                    o.newPlayers += r.count || 0;
                } else if (i == 1) {
                    o.gamePlayers = o.gamePlayers || 0;
                    o.gamePlayers = r.count || 0;
                } else if (i == 2) {
                    o.qcInMoney = o.qcInMoney || 0;
                    o.qcInMoney += new Number(r.money);
                    o.qcInCount = o.qcInCount || 0;
                    o.qcInCount += r.count;
                    o.qcInUser = o.qcInUser || 0;
                    o.qcInUser += r.userId ? 1 : 0;
                } else if (i == 3) {
                    o.qcOutMoney = o.qcOutMoney || 0;
                    o.qcOutMoney += new Number(r.money);
                    o.qcOutCount = o.qcOutCount || 0;
                    o.qcOutCount += r.count;
                    o.qcOutUser = o.qcOutUser || 0;
                    o.qcOutUser += r.userId ? 1 : 0;
                } else if (i == 4) {
                    o.loginPlayers = o.loginPlayers || 0;
                    o.loginPlayers += r.count || 0;
                } else if (i == 5) {
                    o.nextPlayers = o.nextPlayers || 0;
                    o.nextPlayers = r.count || 0;
                } else if (i == 6) {
                    o.goldCost = o.goldCost || 0;
                    o.goldCost = r.count || 0;
                } else if (i == 7) {
                    o.goldTex = o.goldTex || 0;
                    o.goldTex = r.count || 0;
                } else if (i == 8) {
                    o.goldTotal = o.goldTotal || 0;
                    o.goldTotal = total || 0;
                }
            }
        }

        let data = [];
        for (let key in obj) {
            obj[key].dateTime = key;
            data.push(obj[key]);
        }

        utils.responseOK(res, { data, total: data.length });
    });
});

/**
 * @api {get} statistics/jrbb 今日盈亏报表
 * @class statistics
 * @param {number} agentId 代理id
 * @param {number} from 起始时间
 * @param {number} to 结束时间
 * @param {number} pindex 页索引 0开始
 * @param {number} psize 页大小
 * @return 返回
 * {
 *     "count": 1, 总数，
 *     "rows": [ 数据集 ]
 * }
 */
router.get('/jrbb', (req, res) => {
    let agentId = parseInt(req.query.agentId);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    agentId = utils.isNumber(agentId) ? agentId : null;

    permission.isAgent(agentId, (isAgent) => {
        agentId = isAgent ? agentId : null;
        db.call('proc_jrbb', [agentId], true, (err, result) => {
            if (err) {
                utils.responseError(res);
                return;
            }

            let data = result[0];
            data[0].zjhz = data[0].czze + data[0].sdcz - data[0].txze;
            let total = 1;
            utils.responseOK(res, { data, total });
        });
    }, res);
});

router.get('/ykbb_compute', (req, res) => {
    let now = new Date().getTime();
    now = utils.date.formatYYMMDD(utils.date.dateBegin(now));
    let daysafter = parseInt(req.query.daysafter);
    if (!utils.isNumber(daysafter)) {
        daysafter = -1;//默认计算前一天的，过了夜里0点后计算
    }

    db.call('proc_ykbb_compute_daily_all', [now, daysafter], true, (err, result) => {
        utils.responseOK(res);
    });
});

router.get('/rebate_compute', (req, res) => {
    db.call('proc_compute_rebate', [], true, (err, result) => {
        utils.responseOK(res);
    });
});

/**
 * @api {get} statistics/hybb 会员报表
 * @class statistics
 * @param {number} agentId 代理id
 * @param {number} from 起始时间
 * @param {number} to 结束时间
 * @param {number} pindex 页索引 0开始
 * @param {number} psize 页大小
 * @apiSuccessExample 返回
 * {
 *     "count": 1, 总数，
 *     "rows": [ 数据集 ]
 * }
 */
router.get('/hybb', (req, res) => {
    let userId = req.query.userId;
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let from = req.query.from;
    let to = req.query.to;

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    userId = utils.isString(userId, 1) ? userId : null;
    from = utils.isDate(from) ? (from) : null;
    to = utils.isDate(to) ? (to) : null;
    if (/^\d{4}\-\d{1,2}\-\d{1,2}$/img.test(from)) {
        from = from + ' 00:00:00';
    }
    if (/^\d{4}\-\d{1,2}\-\d{1,2}$/img.test(to)) {
        to = to + ' 23:59:59.999';
    }

    db.call('proc_hybb2', [userId, from, to, pindex, psize], true, (err, result) => {
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
 * @api {get} statistics/paychannelbb 充值渠道报表
 * @class statistics
 * @param {number} channelId 渠道id
 * @param {number} from 起始时间
 * @param {number} to 结束时间
 * @apiSuccessExample 返回
 * {
 *     "count": 1, 总数，
 *     "rows": [ 数据集 ]
 * }
 */
router.get('/paychannelbb', (req, res) => {
    let channelId = req.query.channelId;
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let from = req.query.from;
    let to = req.query.to;

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    channelId = utils.isString(channelId, 1) ? channelId : null;
    from = utils.isDate(from) ? (from) : null;
    to = utils.isDate(to) ? (to) : null;
    if (/^\d{4}\-\d{1,2}\-\d{1,2}$/img.test(from)) {
        from = from + ' 00:00:00';
    }
    if (/^\d{4}\-\d{1,2}\-\d{1,2}$/img.test(to)) {
        //to = to + ' 23:59:59.999';
    }

    db.call('proc_paychannel_stats', [channelId, from, to/*, pindex, psize*/], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let data = result[0];
        let total = result[1][0].count;
        utils.responseOK(res, { data, total });
    });
});
module.exports = router;
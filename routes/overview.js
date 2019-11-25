const db = require('../app/db');
const express = require('express');
const utils = require('../app/utils/utils');
const server = require('../app/server');
const _ = require('underscore');


let router = express.Router();


router.get('/daily/:source', (req, res) => {
    // let agentId = req.agent.isAdmin() ? null : req.agent.getId();
    let agentId = null;
    let day = parseInt(req.query.day);
    let timestamp = req.query.timestamp;

    if (!utils.isNumber(day, 1, 30) ||
        !utils.isDate(timestamp)) {
        utils.responseError(res);
        return;
    }


    db.call('proc_overview_daily_' + req.params.source, [agentId, timestamp, day], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let data = _.first(result);
        _.each(data, (d) => d.dates = utils.date.formatYYMMDD(d.timestamp));
        utils.responseOK(res, data);
    });
});


router.get('/hourly/:source', (req, res) => {
    // let agentId = req.agent.isAdmin() ? null : req.agent.getId();
    let agentId = null;
    let timestamp = req.query.timestamp;

    if (!utils.isDate(timestamp)) {
        utils.responseError(res);
        return;
    }


    db.call('proc_overview_hourly_' + req.params.source, [agentId, timestamp], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let data = _.first(result);
        _.each(data, (d) => d.dates = utils.date.formatHHMM(d.beginTime) + '-' + utils.date.formatHHMM(d.endTime));
        utils.responseOK(res, data);
    });
});


/**
 * @api {get} overview/realtime 实时信息统计
 * @apiGroup overview
 * @apiSuccessExample
 * {
 *  "dau": 100 dau
 *  "diamond": 100 钻石消耗
 *  "registration": 100 注册数
 *  "room": 100 已开局房间数
 *  "onlineUser": 1 在线玩家
 *  "onlineRoom": 1 开局中的房间数
 * }
 */
router.get('/realtime', (req, res) => {
    //req.agent.isAdmin() ? null : req.agent.getId()
    db.call('proc_overview_realtime', [null], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        utils.responseOK(res, _.first(result[0]));
    });
});

/**
 * @api {get} overview/online/statistics 房间实时统计
 * @apiGroup overview
 * @apiSuccessExample
 * {
 *  "onlineRoom":0  开局中房间数
 * }
 */
router.get('/online/statistics', (req, res) => {
    server.get('room/onlineRoom', {}, (result) => {
        utils.response(res, result);
    });
});


/**
 * @api {get} overview/roundabout奖励信息统计
 * @apiGroup overview
 * @apiParam {number} type 免费版(1) 钻石版(2)
 * @apiParam {string} from 起始时间
 * @apiParam {string} to 结束时间
 * @apiSuccessExample
 * {
 *  "items": [{
 *      "itemId": 1, 物品id
 *      "count": 2 数量
 *  }],
 *  "times": 3, 抽奖次数
 * }
 */
router.get('/roundabout', (req, res) => {
    let type = parseInt(req.query.type);
    let from = utils.isDate(req.query.from) ? req.query.from : null;
    let to = utils.isDate(req.query.to) ? req.query.to : null;

    if (!utils.isNumber(type)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_overview_roundabout', [type, from, to], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let items = _.reject(result[0], (d) => d.count <= 0);
        let times = result[1][0].times;
        utils.responseOK(res, { items, times });
    });
});


/**
 * @api {get} overview/sale 销售信息统计
 * @apiGroup overview
 * @apiParam {string} timestamp 统计其实日期
 * @apiParam {number} day 统计天数
 * @apiSuccessExample
 * [{
 *  "chargeMoney": 100 充值金额
 *  "chargeDiamond": 100 充值钻石数
 *  "saleAdminAgent": 100 管理员给代理充值数
 *  "saleAdminUser": 100 管理员给玩家充值数
 *  "saleAgent": 100 代理销售数
 * }]
 */
// router.get('/sale', (req, res) => {
//     // let agentId = req.agent.isAdmin() ? null : req.agent.getId();
//     let agentId = null;
//     let day = parseInt(req.query.day);
//     let timestamp = req.query.timestamp;

//     if (!utils.isNumber(day, 1, 30) ||
//         !utils.isDate(timestamp)) {
//         utils.responseError(res);
//         return;
//     }

//     db.call('proc_overview_daily_sale', [agentId, timestamp, day], true, (err, result) => {
//         let data = _.first(result);
//         _.each(data, (d) => {
//             // d.saleAdminAgent = req.agent.isAdmin() ? d.saleAdminAgent : null;
//             // d.saleAdminUser = req.agent.isAdmin() ? d.saleAdminUser : null;
//             d.saleAdminAgent = null;
//             d.saleAdminUser = null;
//             d.timestamp = utils.date.formatYYMMDD(d.timestamp);
//         });
//         utils.responseOK(res, data);
//     });
// });


router.get('/user', (req, res) => {
    // let agentId = req.agent.isAdmin() ? null : req.agent.getId();
    let agentId = null;
    let day = parseInt(req.query.day);
    let timestamp = req.query.timestamp;

    if (!utils.isNumber(day, 1, 30) ||
        !utils.isDate(timestamp)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_overview_user', [agentId, timestamp, day], true, (err, result) => {
        let data = _.first(result);
        _.each(data, (d) => d.timestamp = utils.date.formatYYMMDD(d.timestamp));
        utils.responseOK(res, data);
    });
});


module.exports = router;
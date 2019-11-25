const db = require('../app/db');
const express = require('express');
const utils = require('../app/utils/utils');
const _ = require('underscore');


let router = express.Router();


/**
 * @api {get} nn/recommender/details 邀请详细列表
 * @apiGroup nn
 * @apiParam {id} userId 玩家id
 * @apiParam {number} pindex 页索引
 * @apiParam {number} psize 页大小
 * @apiSuccessExample 返回
 * {
 *  "count": 100, 总数
 *  [{
 *   "id": 10000, 玩家id
 *   "play": 3, 游戏局数,
 *   "charge": 3, 充值次数
 * }]
 * }
 */
router.get('/recommender/details', (req, res) => {
    let userId = parseInt(req.query.userId);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    if(!utils.isId(userId) ||
        !utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 1) ) {
        utils.responseError(res);
        return;
    }

    db.call('proc_nn_recommender_details', [userId, pindex, psize], true, (err, result) => {
        if(err) {
            utils.responseError(res);
            return;
        }

        let rows = _.toArray(result[0]);
        let count = result[1][0].count;
        utils.responseOK(res, {rows, count});
    });
});


/**
 * @api {get} nn/recommender/thumbnail 邀请简况
 * @apiGroup nn
 * @apiParam {id} userId 玩家id
 * @apiSuccessExample 返回
 * {
 *  "total": 10, 总邀请人数
 *  "rewarded": 3, 完成游戏任务人数
 *  "charged": 3, 完成首冲任务人数
 * }
 */
router.get('/recommender/thumbnail', (req, res) => {
    let userId = parseInt(req.query.userId);
    if(!utils.isId(userId)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_nn_recommender_thumbnail', [userId], true, (err, result) => {
        if(err) {
            utils.responseError(res);
            return;
        }

        let total = result[0][0].count;
        let rewarded = result[1][0].count;
        let charged = result[2][0].count;
        utils.responseOK(res, {total, rewarded, charged});
    });
});


module.exports = router;
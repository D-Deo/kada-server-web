const express = require('express');
const db = require('../app/db');
const utils = require('../app/utils/utils');
const _ = require('underscore');

let router = express.Router();

/**
 * 获取获取登录奖励数据
 * @api {get} activity/login/rewards
 * @param {number} userId
 * @return 返回
 * {
 *  "day": 当前用户已领取的天数
 *  "rewords": [
 *      {
 *          "day": 天数
 *          "coin": 金币数量
 *      },
 *      ...
 *  ]
 * }
 */
router.get('/login/rewards', (req, res) => {
    let userId = parseInt(req.query.userId);
    if (userId && !utils.isId(userId)) {
        return utils.responseError(res);
    }

    db.query('SELECT id as day, coin FROM activity_login ORDER BY id ASC', (err, rewards) => {
        if (err) {
            return utils.responseError(res);
        }

        let day = 0;
        if (userId) {
            db.query(`SELECT day, logTime FROM user_login_reward WHERE userId=${userId} ORDER BY logTime DESC LIMIT 0, 1`, (err, record) => {
                if (err) {
                    return utils.responseError(res);
                }
                utils.responseOK(res, { day: record[0][0] ? record[0][0].day : 0, logTime: record[0][0] ? record[0][0].logTime : null, rewards: rewards[0] });
            });
            return;
        }
        utils.responseOK(res, { day, rewards: rewards[0] });
    });
});

module.exports = router;

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

let router = express.Router();

/**
 * @api {get} customer/records 资产变化记录
 * @apiGroup ether
 * @apiParam {number} userId 玩家id
 * @apiParam {number} state 状态
 * @apiParam {number} pindex 页索引 0开始
 * @apiParam {number} psize 页大小
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
router.get('/records', (req, res) => {
    let userId = parseInt(req.query.userId);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    if( !utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    userId = utils.isId(userId) ? userId : null;

    let wheres = {
    };
    console.log('userId:'+userId);
    if (userId !== null) {
        wheres.reporterId = userId;
    }

    let p = model.Problem.findAndCountAll({
        attributes: ['id','reporterId','type','msg','status', 'feedback'],
        where: wheres,
        offset: pindex * psize,
        limit: psize,
        order: [['id', 'DESC']]
    });
    utils.responseProm(res, p);
});

/**
 * @api {post} customer/reply 回复问题
 * @apiGroup admin
 * @apiParam {id} userId 玩家id
 * @apiParam {id} id 申请id
 * @apiParam {bool} commit 是否通过
 */
router.post('/reply', (req, res) => {
    let {feedback, id, msg, reporterId, status, type} = req.body;

    console.log('feedback:'+feedback);
    console.log('id:'+id);
    
    if (!utils.isNumber(id, 1) ||
        !utils.isString(feedback, 1, 255)) {
        utils.responseError(res);
        return;
    }

    (async () => {
        var problem = await model.Problem.findById(id);

        if (!problem) {
            utils.responseError(res);
            return;
        }

        console.log('problem:'+JSON.stringify(problem));
        console.log('feedback:'+feedback);
        problem.feedback = feedback;
        problem.status = 1;
        await problem.save();

        let msg = {};
        msg.code = 200;
        msg.msg = "ok";
        utils.response(res);        
    })();
});

module.exports = router;
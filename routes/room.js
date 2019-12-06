const db = require('../app/db');
const express = require('express');
const server = require('../app/server');
const utils = require('../app/utils/utils');
const _ = require('underscore');
const zlib = require('zlib');


let router = express.Router();


/**
 * @api {get} room/online/details 获取在线房间的详细信息
 * @apiGroup room
 * @apiSuccessExample
 * [{
 *      "game": 'qm' 游戏类型
 *      "owner": 1 房主id
 *      "roomId": "123456" 房间id
 *      "rounds": 10 已开局数
 *      "state": 1 状态  1(准备中) 2(游戏中) 3(正常结束) 4(被解散) 11(游戏中被关服中断 - 做补偿)
 * }]
 */
router.get('/online/details', (req, res) => {
    db.call('proc_room_online_details', {}, true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        utils.responseOK(res, result[0]);
    });
});


/**
 * @api {post} room/online/dismiss 解散房间
 * @apiGroup room
 * @apiParam {string} game 游戏类型 暂时默认 'tm'
 * @apiParam {string} roomId 房间id
 */
router.post('/online/dismiss', (req, res) => {
    let game = req.body.game;
    let roomId = req.body.roomId;

    if (!utils.isString(game, 2, 2) ||
        !utils.isString(roomId, 1)) {
        utils.responseError(res);
        return;
    }

    server.post('room/dismiss', { game, roomId }, (result) => {
        utils.response(res, result);
    });
});


/**
 * @api {get} room/records 获取游戏记录列表
 * @apiGroup room
 * @apiParam {string} game 游戏类型
 * @apiParam {id} userId 玩家id
 * @apiParam {number} limit 获取条数
 * @apiSuccessExample
 * [{
 *      "recordId": 1 记录id
 *      "roomId": "123456" 房间id
 *      "rounds": 10 局数
 *      "balance": 总结算
 *      [{
 *          "bankerTimes": 1 最高连庄数
 *          "fireTimes": 1 放枪次数
 *          "winTimes": 1 胡牌次数
 *          "drawWinTimes": 1 自摸次数
 *          "drawWinTimes": 1 自摸次数
 *          "agentId": 123 代理id
 *          "agentNick": "123" 代理昵称
 *          "desp": "123" 备注
 *          "head": "http:www.baidu.com" 头像
 *          "id": 1 玩家id
 *          "nick": "123" 玩家昵称
 *          "score": -10 得分
 *          "sex": 0 性别
 *          "diamond": -10 钻石消耗
 *      }]
 *      "timestamp": 时间戳 结束时间
 * }]
 */
router.get('/records', (req, res) => {
    let game = req.query.game;
    let userId = parseInt(req.query.userId);
    let limit = parseInt(req.query.limit);

    if (!utils.isString(game, 2, 4) ||
        !utils.isId(userId) ||
        !utils.isNumber(limit, 1, 100)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_user_historys', [game, userId, limit], true, (err, result) => {
        let data = _.first(result);
        let all = data.length;
		
		let retFunc = (res, data) => {
			_.each(data, (d) => {
                d.balance = JSON.parse(d.balance);
				d.attrs = JSON.parse(d.attrs);
			});
			return utils.responseOK(res, data);
		};
		
        for (let i = 0; i < data.length; i++) {
            let d = data[i];
            // d.attrs = JSON.parse(d.attrs);
            if (d.balance) {
                // let buffer = Buffer.from(d.balance, 'base64').toString();
                let buffer = new Buffer(d.balance, 'base64');
				console.log(buffer);
                zlib.unzip(buffer, (err, balance) => {
                    if (err) {
						console.error(err);
						all -= 1;
						if (all <= 0) {
							return retFunc(res, data);
							// return utils.responseOK(res, data);
						}
                        return;
                    }
                    d.balance = balance.toString();
                    all -= 1;
                    if (all <= 0) {
						return retFunc(res, data);
                        // return utils.responseOK(res, data);
                    }
                });
                continue;
            }
            all -= 1;
            if (all <= 0) {
				return retFunc(res, data);
                // return utils.responseOK(res, data);
            }
        }
        // _.each(data, (d) => {
        //     let buffer = Buffer.from(d.balance, 'base64').toString();
        //     zlib.unzip(buffer, (err, balance) => {
        //         if (err) {

        //         }
        //     });

        //     d.balance = JSON.parse(d.balance);
        //     // d.balance = _.map(, (b) => {
        //     // return b;
        //     // return _.pick(b, ['agentId', 'agentNick', 'desp', 'head', 'id', 'nick', 'score']);
        //     // });
        //     d.attrs = JSON.parse(d.attrs);
        //     // d.attrs = _.map(JSON.parse(d.attrs), (b) => {
        //     //     return b;
        //     // });
        // });
        // utils.responseOK(res, data);
    });
});


/**
 * @api {get} room/record/round/detail 某场游戏中,某局游戏的游戏信息
 * @apiGroup room
 * @apiParam {id} id id 某局游戏的记录id
 * @apiSuccessExample
 * {
 *      "actions": [] 全部action数组
 *      "state": {} 起始状态
 * }
 */
router.get('/record/round/detail', (req, res) => {
    let id = parseInt(req.query.id);

    if (!utils.isId(id)) {
        utils.responseError(res);
        return;
    }

    db.find('room_round_record', { id }, (err, row) => {
        if (err || !row) {
            utils.responseError(res);
            return;
        }

        let data = _.pick(row, ['actions', 'state']);
        data.actions = JSON.parse(utils.string.filterEnter(data.actions));
        data.state = JSON.parse(utils.string.filterEnter(data.state));
        utils.responseOK(res, data);
    });
});


/**
 * @api {get} room/record/round/thumbnails 某场游戏中，每局游戏的简要信息
 * @apiGroup room
 * @apiParam {id} recordId recordId 某场游戏的记录id
 * @apiSuccessExample
 * [{
 *      "id": 1 游戏局次id
 *      "recordId": 1 游戏场次id
 *      "round": 1 局数索引
 *      "balance": 当局结算
 *      [{
 *          "id": 1 玩家id
 *          "roundScore": -10 得分
 *      }]
 *      "timestamp": 时间戳 结束时间
 * }]
 */
router.get('/record/round/thumbnails', (req, res) => {
    let recordId = parseInt(req.query.recordId);

    if (!utils.isId(recordId)) {
        utils.responseError(res);
        return;
    }

    db.list('room_round_record', { recordId }, (err, rows) => {
        let data = _.map(rows, (r) => _.pick(r, ['id', 'recordId', 'round', 'balance', 'timestamp']));
        _.each(data, (d) => {
            d.balance = _.map(JSON.parse(utils.string.filterEnter(d.balance)).seats, (b) => {
                return _.pick(b, ['id', 'roundScore']);
            });
        });
        utils.responseOK(res, data);
    });
});


module.exports = router;
const agentManager = require('../app/agent/manager');
const cons = require('../app/common/constants');
const db = require('../app/db');
const model = require('../app/db/model');
const express = require('express');
const fs = require('fs');
const sao = require('../app/server/sao');
const utils = require('../app/utils/utils');
const uuid = require('uuid/v1');
const logger = require('log4js').getLogger('common');
const saop = require('../app/server/saop');

/** ZAPP 商户ID和商户密钥 */
const ZAPP_APPKEY = '2a49b5e58d164e65ab383c3e4bbc2d76';
const ZAPP_APPSECRET = 'f8dbf368ed10494da016854b768ea1c0';

let router = express.Router();

/**
 * @api {get} api/sdk/zapp/item 获取用户当前道具信息
 * @class sdk
 * @param {string} appKey 应用appKey
 * @param {string} userId 玩家id
 * @param {string} goodsCode 开发者在zapp上添加的商品标识符 [金币]b874308ed43e39e5
 * @param {number} timestamp 发起请求的时间戳（5分钟有效）
 * @param {string} nonstr 随机字符
 * @param {string} sign 签名
 * @apiSuccess {json} 返回
{
	"code": "success",          // 必须； 或 error
	"message": "请求成功",       // 必须； 或 错误信息
	"data": {
		"appKey":"xxxxxxx",     // 必须； 应用接入appKey
		"shopCode":"xxxxx",     // 非必须； 开发者应用商品code
		"number":25.5,          // 必须； 用户可兑换的商品数量（剩余数量）
		"timestamp": xxxxx,     // 必须； 数据返回时间戳
		"nonstr":"xxxxx",       // 必须； 签名随机数
		"sign":"xxxxxx"         // 必须； 签名
	}
}
 */
router.get('/zapp/item', async (req, res) => {
    let { appKey, userId, goodsCode, timestamp, nonstr, sign } = req.query;

    if (!utils.isString(userId) ||
        !utils.isString(appKey) ||
        !utils.isString(goodsCode) ||
        !utils.isString(timestamp) ||
        !utils.isString(nonstr) ||
        !utils.isString(sign)) {
        return utils.responseZAPP(res, 'error', '参数错误', {});
    }

    if (appKey !== ZAPP_APPKEY) {
        return utils.responseZAPP(res, 'error', 'appKey 不匹配', {});
    }

    let appSecret = ZAPP_APPSECRET;

    let str = utils.string.toSign({ userId, goodsCode, timestamp, nonstr });
    str += `&${appKey}=${appSecret}`;
    let checkSign = utils.string.md5(str);
    logger.info('zapp sign check:', str, checkSign, sign);

    if (sign.toLocaleLowerCase() !== checkSign) {
        return utils.responseZAPP(res, 'error', '签名不通过，签名不一致', {});
    }

    let itemId = goodsCode === 'b874308ed43e39e5' ? 1 : null;
    if (!itemId) {
        return utils.responseZAPP(res, 'error', '商品标识符不存在', {});
    }

    let item = await model.Item.findOne({ where: { userId, itemId } });
    if (!item) {
        logger.warn('zapp no item', userId, itemId);
    }

    let data = {
        shopCode: goodsCode,
        number: item ? item.count : 0,
        timestamp: new Date().getTime(),
        nonstr
    };

    data.sign = utils.string.md5(utils.string.toSign(data) + `&${appKey}=${appSecret}`);
    data.appKey = appKey;

    utils.responseZAPP(res, 'success', '请求成功', data);
});

/**
 * @api {post} api/sdk/zapp/item/exchange 用户道具兑换
 * @class sdk
 */
router.route('/zapp/item/exchange').post(async (req, res) => {
    let { appKey, orderNo, type, userId, goodsCode, price, number, money, unitName, timestamp, nonstr, sign } = req.body;

    type = parseInt(type);
    price = parseFloat(price);
    number = parseFloat(number);
    money = parseFloat(money);
    timestamp = parseInt(timestamp);

    if (!utils.isString(userId) ||
        !utils.isString(appKey) ||
        !utils.isString(orderNo) ||
        !utils.isNumber(type, 0, 1) ||
        !utils.isString(goodsCode) ||
        !utils.isNumber(price) ||
        !utils.isNumber(number) ||
        !utils.isNumber(money) ||
        !utils.isString(unitName) ||
        !utils.isNumber(timestamp) ||
        !utils.isString(nonstr) ||
        !utils.isString(sign)) {
        return utils.responseZAPP(res, 'error', '参数错误', {});
    }

    if (appKey !== ZAPP_APPKEY) {
        return utils.responseZAPP(res, 'error', 'appKey 不匹配', {});
    }

    let appSecret = ZAPP_APPSECRET;

    let str = utils.string.toSign({ orderNo, type, userId, goodsCode, price, number, money, unitName, timestamp, nonstr });
    str += `&${appKey}=${appSecret}`;
    let checkSign = utils.string.md5(str);
    logger.info('zapp sign check:', str, checkSign, sign);

    if (sign.toLocaleLowerCase() !== checkSign) {
        return utils.responseZAPP(res, 'error', '签名不通过，签名不一致', {});
    }

    let transactionNo = utils.string.toOrderId('Z');

    //TODO: 给用户加钱或者扣钱
    // let p = saop.item.changeItem(userId, itemId, count, {
    //     from: operateid + "",
    //     reason, memo
    // });
    // utils.responseProm(res, p);

    let data = {
        transactionNo,
        orderNo,
        timestamp: new Date().getTime(),
        nonstr
    };

    data.sign = utils.string.md5(utils.string.toSign(data) + `&${appKey}=${appSecret}`);
    data.appKey = appKey;

    utils.responseZAPP(res, 'success', '请求成功', data);
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});


/**
 * @api {post} sdk/audio 上传语音文件
 * @apiGroup sdk
 * @apiSuccessExample
 * id 唯一标志符 通过 {get} audio/{id} 可以拉去语音文件
 */
router.route('/audio')
    .post((req, res) => {
        let data = null;
        req.on('data', (d) => {
            data = (data === null) ? d : Buffer.concat([data, d]);
        });

        req.on('end', () => {
            let id = uuid();
            fs.writeFileSync('./public/audio/' + id, data);
            utils.responseOK(res, id);
        });
    })
    .options((req, res) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
        res.end('');
    });


router.post('/ofb/agent', (req, res) => {
    let no = req.body.MerchantTradeNo;
    let result = req.body.RtnCode;

    if (!utils.isString(no)) {
        res.end();
        return;
    }

    db.call('proc_agent_charge_commit', [no, result === '1' ? 1 : 2], true, (err, r) => {
        if (err) {
            res.end();
            return;
        }

        let { error, agentId, diamond, bindDiamond } = r[0][0];
        if (error) {
            res.end();
            return;
        }

        let agent = agentManager.getAgentById(agentId);
        if (!agent) {
            res.end();
            return;
        }

        agent.changeDiamond(cons.Item.DIAMOND(), diamond, cons.AgentDiamondChangeReason.CHARGE());
        agent.changeDiamond(cons.Item.BIND_DIAMOND(), bindDiamond, cons.AgentDiamondChangeReason.CHARGE());
        res.end('1|OK');
    });
});


router.post('/ofb/user', (req, res) => {
    let no = req.body.MerchantTradeNo;
    let result = req.body.RtnCode;

    if (!utils.isString(no)) {
        res.end();
        return;
    }

    db.call('proc_user_charge_commit', [no, result === '1' ? 1 : 2], true, (err, r) => {
        if (err) {
            res.end();
            return;
        }

        let { error, userId, diamond, bindDiamond } = r[0][0];
        if (error) {
            res.end();
            return;
        }

        let items = {};
        items[cons.Item.DIAMOND()] = diamond;
        items[cons.Item.BIND_DIAMOND()] = bindDiamond;
        sao.item.changeItems(userId, items, cons.ItemChangeReason.BUY());
        res.end('1|OK');
    });
});


module.exports = router;
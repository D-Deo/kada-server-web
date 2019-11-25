const data = require('../app/data');
const express = require('express');
const fs = require('fs');
const sao = require('../app/server/sao');
const utils = require('../app/utils/utils');
const db = require('../app/db');
const cons = require('../app/common/constants');
const logger = require('log4js').getLogger('index');
const ccap = require('ccap');
const captchapng = require('captchapng');
const Geetest = require('gt3-sdk');
const qr = require('qr-image');
const model = require('../app/db/model');
const requestIp = require('request-ip');
const xmlparser = require('express-xml-bodyparser');
const _ = require('underscore');

let captcha = new Geetest({
    geetest_id: 'a5480c8e9f39bf55ebfa153e89e556ce',
    geetest_key: '3daeb4139d7a425f5eecfd3d375f2fcd'
});

let router = express.Router();

router.get('/', function (req, res) {
    res.render('index', { title: 'Express' });
});

router.get('/announcement', function (req, res) {
    utils.responseOK(res, data.announcement);
});

router.get('/config', function (req, res) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", "text/plain");
    delete require.cache[require.resolve("../public/config/index.json")];
    res.end(JSON.stringify(require('../public/config/index.json')));
});

/**
 * @api /vercode/action 获取行为验证的challenge
 * @type get
 * @return  
 *          {
 *              "code": 200,
 *              "msg": {
 *                  "success": 1,
 *                  "challenge": "25405b87136f753dd380fbe21a785dcd",
 *                  "gt": "a5480c8e9f39bf55ebfa153e89e556ce",
 *                  "new_captcha": true
 *              }
 *          }
 */
router.get('/vercode/action', (req, res) => {
    // 向极验申请每次验证所需的challenge
    captcha.register({
        client_type: 'unknown',
        ip_address: utils.ip(requestIp.getClientIp(req))
    }, (err, data) => {
        if (err) {
            console.error(err);
            utils.responseError(res, err);
            return;
        }

        if (!data.success) {
            // 进入 failback，如果一直进入此模式，请检查服务器到极验服务器是否可访问
            // 可以通过修改 hosts 把极验服务器 api.geetest.com 指到不可访问的地址

            // 为以防万一，你可以选择以下两种方式之一：

            // 1. 继续使用极验提供的failback备用方案
            req.session.fallback = true;
            // res.send(data);
            utils.responseOK(res, data);

            // 2. 使用自己提供的备用方案
            // todo

        } else {
            // 正常模式
            req.session.fallback = false;
            // res.send(data);
            utils.responseOK(res, data);
        }
    });
});

/**
 * @api /vercode 获取验证码图片
 */
router.get('/vercode', function (req, res) {
    res.set("Access-Control-Allow-Origin", "*");

    let v = req.query.v;
    if (!utils.isString(v, 1)) {
        res.writeHead(404);
        res.end('');
        return;
    }

    let captcha = ccap();
    let code = captcha.get();
    let txt = code[0];      //验证码文本
    let buf = code[1];      //验证码图形
    utils.addVercode(v, txt);
    res.writeHead(200, {
        'Content-Type': 'image/bmp'
    })
    res.end(buf);
});

/**
 * @api /vercode 获取验证码图片
 */
router.get('/vercodepng', function (req, res) {
    res.set("Access-Control-Allow-Origin", "*");

    let v = req.query.v;
    if (!utils.isString(v, 1)) {
        res.writeHead(404);
        res.end('');
        return;
    }

    let n = parseInt(Math.random() * 9000 + 1000);
    let p = new captchapng(55, 20, n);
    p.color(0, 0, 0, 0);
    p.color(80, 80, 80, 255);
    let img = p.getBase64();
    let imgbase64 = new Buffer(img, 'base64');
    utils.addVercode(v, "" + n);
    res.writeHead(200, {
        'Content-Type': 'image/png'
    });
    res.end(imgbase64);
});

/**
 * @api {get} /qr 显示二维码
 * @apiGroup admin
 */
router.get('/qr', function (req, res) {
    res.set("Access-Control-Allow-Origin", "*");
    var text = req.query.text;
    try {
        var img = qr.image(text, { size: 10 });
        res.writeHead(200, { 'Content-Type': 'image/png' });
        img.pipe(res);
    } catch (e) {
        res.writeHead(414, { 'Content-Type': 'text/html' });
        res.end('<h1>414 Request-URI Too Large</h1>');
    }
});

/**
 * @api {post} /wx 微信支付回调
 */
router.all('/wx', xmlparser({trim: false, explicitArray: false }), (req, res, next) => {
    res.set("Access-Control-Allow-Origin", "*");
	console.log(req.body.xml);
	
    try {
		let ret = req.body.xml;
		
        if (ret.result_code !== "SUCCESS" || ret.return_code !== "SUCCESS") {
			console.error('微信支付失败');
			res.end('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
			return;
		}

		if (!utils.verify(ret)) {
			console.error('微信支付失败，签名验证错误');
			res.end('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
			return;
		}

		const ordernumber = ret.out_trade_no;
		const paymoney = parseInt(ret.total_fee / 100);
        const sysnumber = ret.transaction_id;
        const status = 1;
		
		model.UserPay.find({
			where: { id: ordernumber, money: paymoney }
		}).then(userpay => {
			if (!userpay) {
				res.end('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
				return;
			}
			
			db.call('proc_user_pay_result', [ordernumber, paymoney, sysnumber, status], true, (err) => {
				if (err) {
					console.error(err);
					res.end('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
					return;
				}
				sao.user.payComplete(userpay.userId, ordernumber, paymoney, 0, () => { 
					console.log('微信支付成功');
				});
			});
		}).catch(err => {
			console.error(err);
			res.end('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
		});
    } catch (e) {
        console.error(e);
    }
	
	res.end('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});

/**
* 创建设备号、上级代理、ip
* @api     {post}       /activity/airdrop/submit
* @param   {string}    coin     虚拟币名称
* @param   {number}    phone    手机号
* @return
*/
router.get('/create_device', function (req, res) {
    var ip = req.headers['x-forwarded-for'] ||
        utils.ip(requestIp.getClientIp(req)) ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress || '';
    if (ip.split(',').length > 0) {
        ip = ip.split(',')[0]
    }

    let parentid = req.query.parentid;
    let device_id = req.query.device_id;

    if (!utils.isString(parentid, 1, 50) ||
        !utils.isString(device_id, 1, 50) ||
        !utils.isString(ip, 1, 50)) {
        return utils.responseError(res);
    }

    (async () => {
        var devices = await model.DeviceInfo.findAll({
            where: {
                device_id: device_id,
                ip: ip
            }
        })

        console.log(`find ${devices.length} devices:`);
        if (devices.length == 0) {
            (async () => {
                var dev = await model.DeviceInfo.create({
                    parent_id: parentid,
                    ip: ip,
                    device_id: device_id,
                    created_at: Date.now()
                });
                console.log('created: ' + JSON.stringify(dev));
                utils.responseOK(res);
            })();
        } else {
            //return utils.responseError(res, error);
        }
    })();
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});


/**
 * 提交空投活动信息
 * @api     {post}       /activity/airdrop/submit
 * @param   {string}    coin     虚拟币名称
 * @param   {number}    phone    手机号
 * @return
 */
router.route('/activity/airdrop/submit').post((req, res) => {
    let coin = req.body.coin;
    let phone = req.body.phone;

    if (!utils.isString(coin, 1, 50) ||
        !utils.isString(phone, 1, 50)) {
        return utils.responseError(res);
    }

    db.call('proc_activity_airdop_add', [coin, phone], true, (err, result) => {
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
 * 验证当前空投信息
 * @api {get} activity/airdrop/validate
 * @param {string} coin 虚拟币名称
 * @param {string} phone 手机号
 * @return {object} msg.result 当前空投状态 0表示可领取，1表示不可领取
 */
router.get('/activity/airdrop/validate', (req, res) => {
    let coin = req.query.coin;
    let phone = req.query.phone;

    if (!utils.isString(coin, 1, 50) ||
        !utils.isString(phone, 1, 50)) {
        return utils.responseError(res);
    }

    let sql = `select activity_airdrop.state from activity_airdrop where coin = '${coin}' and phone = '${phone}'`;
    db.query(sql, (err, result) => {
        if (err) {
            logger.error('[DB]', sql, err);
            utils.response(res, cons.ResultCode.DB_ERROR());
            return;
        }
        utils.responseOK(res, { state: result[0][0] ? result[0][0].state : 1 });
    });
});

/**
 * 提交空投活动信息的领取地址
 * @api {post} /activity/airdrop/update
 * @param {string} coin 虚拟币名称
 * @param {string} phone 手机号
 * @param {string} address 领取地址
 * @return
 */
router.route('/activity/airdrop/update').post((req, res) => {
    let coin = req.body.coin;
    let phone = req.body.phone;
    let address = req.body.address;

    if (!utils.isString(coin, 1, 50) ||
        !utils.isString(phone, 1, 50) ||
        !utils.isString(address, 1)) {
        return utils.responseError(res);
    }

    db.call('proc_activity_airdrop_update', [coin, phone, address], true, (err, result) => {
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


module.exports = router;



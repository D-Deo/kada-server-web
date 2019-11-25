const cons = require('../app/common/constants');
const dao = require('../app/db/dao');
const data = require('../app/data');
const db = require('../app/db');
const express = require('express');
const model = require('../app/db/model');
const sao = require('../app/server/sao');
const saop = require('../app/server/saop');
const server = require('../app/server');
const smsManager = require('../app/sms/manager');
const userManager = require('../app/user/manager');
const utils = require('../app/utils/utils');
const adminlog = require('../app/utils/adminlog');
const _ = require('underscore');
const Jimp = require("jimp");
const fs = require("fs");
const formidable = require('formidable');
const QrCode = require('qrcode-reader');
const fileUpload = require('express-fileupload');
const path = require("path");
const moment = require('moment');
const XLSX = require('xlsx')
const redis = require('../app/redis/index');
// const redis = require('redis');
const conf = require(`../config/${process.env.conf}.json`);
const router = express.Router();
const Sequelize = require('sequelize');
const logger = require('log4js').getLogger('admin');

/**
 * @api {get} /settings/level
 */
router.get('/level', (req, res) => {
    db.query('select * from config_level', (err, result) => {
        if (err) {
            return utils.responseError(res);
        }
        let data = _.map(result[0], (r) => {
            return { value: r.id, label: r.name };
        });
        return utils.responseOK(res, data);
    });
});

router.get('/config', (req, res) => {
    redis.get(`WebServer:Setting:Config`, (confs) => {
        if (confs) {
            return utils.responseOK(res, JSON.parse(confs));
        } else {
            db.query('select * from setting', (err, result) => {
                if (err) {
                    return utils.responseError(res);
                }
                let data = {};
                _.each(result[0], (r) => {
                    let regex = /\{(.+?)\}/g;
                    if (regex.test(r.value)) {
                        r.value = JSON.parse(r.value);
                    }
                    data[r.key] = r.value;
                });
                return utils.responseOK(res, data);
            });
        }
    });
});

router.post('/level/add', (req, res) => {
    let name = req.body.name;
    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;
    if (!utils.isString(name, 1)) {
        return utils.responseError(res);
    }
    db.query('insert into config_level (name) values ("' + name + '")', (err) => {
        if (err) {
            return utils.responseBDError(res);
        }

        let params = {};
        params.userId = operateid;
        params.module = '玩家列表';
        params.desc = operateid + '新增分类：' + name + ',成功';
        params.opname = '新增分类';
        adminlog.external(req, params);
        params.ext1 = null;
        params.ext2 = null;
        params.ext3 = null;
        params.columns = [];
        adminlog.logadmin(params);
        return utils.responseOK(res);
    });
});

router.get('/pay/kinds', (req, res) => {
    db.query('select * from config_pay where state = 0', (err, result) => {
        if (err) {
            return utils.responseError(res);
        }
        let data = _.map(result[0], (r) => {
            return { value: r.id, label: r.name };
        });
        return utils.responseOK(res, data);
    });
});

router.get('/pay/channel/kinds', (req, res) => {
    db.query('select * from config_channel', (err, result) => {
        if (err) {
            return utils.responseError(res);
        }
        let data = _.map(result[0], (r) => {
            return { value: r.id, label: r.name };
        });
        return utils.responseOK(res, data);
    });
});

/**
 * @api {get} /settings/game/settting 游戏排序及状态
 */
router.get('/game/setting', (req, res) => {

    db.list('game_manager', { state: 0 }, (err, rows) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        utils.responseOK(res, rows);
    });
});



/**
 * @api {get} /settings/game/change/open 更改游戏状态
 */

router.route('/game/change/open').post((req, res) => {
    let { type, state } = req.body;

    db.update('game_manager', { key: type }, { open: state }, (err, rows) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        db.list('game_manager', { state: 0 }, (err, rows) => {
            if (err) {
                utils.responseError(res);
                return;
            }
            server.postp('inspector/gameopen', { channel: 'default', msg: rows }).then((result) => {
                if (result != 'ok') {
                    return responseError(res);
                }
                utils.responseOK(res);
            });
        });
    });
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});


/**
 * @api {get} /settings/game/change/number 更改游戏序号
 */

router.route('/register/account/commit').post((req, res) => {
    let { type, open } = req.body;

    db.list('game_manager', { state: 0 }, (err, rows) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        utils.responseOK(res, rows);
    });

}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});

/**
 * @api {get} /settings/pay/channels 充值通道列表
 */
router.get('/pay/channels', (req, res) => {
    let channel = req.query.channel;
    let merchantId = req.query.merchantId
    let pay = parseInt(req.query.pay);
    let state = parseInt(req.query.state);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let levels = req.query.level;

    state = utils.isNumber(state) ? state : null;
    pay = utils.isNumber(pay) ? pay : null;
    channel = utils.isString(channel) && channel !== '' ? channel : null;
    levels = utils.isString(levels, 1) ? levels : null;

    db.call('proc_pay_channel_details', [merchantId, null, null, null, null, null, null, null, null, state, pay, null, channel, levels, pindex, psize], true, (err, result) => {
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
 * @api {get} /settings/pay/channels/union 官方充值渠道--银联
 */
router.get('/pay/channels/union', (req, res) => {
    let name = req.query.name;
    let bank = req.query.bank;
    let bankNo = req.query.bankNo;
    let state = parseInt(req.query.state);
    let channel = req.query.channel;
    let levels = parseInt(req.query.levels);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    name = utils.isString(name) ? name : null;
    bank = utils.isString(bank) ? bank : null;
    bankNo = utils.isString(bankNo) ? bankNo : null;
    state = utils.isNumber(state) ? state : null;
    channel = utils.isString(channel) ? channel : null;
    levels = utils.isNumber(levels) ? levels : null;

    db.call('proc_pay_channel_details', [null, name, bank, bankNo, state, null, null, null, null, null, 0, 4, channel, levels, pindex, psize], true, (err, result) => {
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
 * @api {get} /settings/pay/channels/wx 官方充值渠道 -- 微信
 */
router.get('/pay/channels/wx', (req, res) => {
    let wxName = req.query.wxName;
    let wxAccount = req.query.wxAccount;
    let wxUrl = req.query.wxUrl;
    let state = parseInt(req.query.state);
    let levels = req.query.levels;
    console.log('levels:' + levels);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    wxName = utils.isString(wxName) ? wxName : null;
    wxAccount = utils.isString(wxAccount) ? wxAccount : null;
    wxUrl = utils.isString(wxUrl) ? wxUrl : null;
    state = utils.isNumber(state) ? state : null;
    levels = utils.isString(levels, 1) ? levels : null;

    db.call('proc_pay_channel_details', [null, null, null, null, wxName, wxAccount, wxUrl, null, null, state, 0, 1, null, levels, pindex, psize], true, (err, result) => {
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
 * @api {get} /settings/pay/channels/ali 官方充值渠道 -- 支付宝
 */
router.get('/pay/channels/ali', (req, res) => {
    let aliAccount = req.query.aliAccount;
    let aliUrl = req.query.aliUrl;
    let state = parseInt(req.query.state);
    let levels = req.query.levels;
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    aliAccount = utils.isString(aliAccount) ? aliAccount : null;
    aliUrl = utils.isString(aliUrl) ? aliUrl : null;
    state = utils.isNumber(state) ? state : null;
    levels = utils.isString(levels, 1) ? levels : null;

    db.call('proc_pay_channel_details', [null, null, null, null, null, null, null, aliAccount, aliUrl, state, 0, 3, null, levels, pindex, psize], true, (err, result) => {
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
 * @api {post} /settings/pay/channel/union/save 保存充值渠道
 */
router.post('/pay/channel/union/save', (req, res) => {
    let { id, ...params } = req.body;
    console.log(id, params);

    (async () => {
        if (!id) {
            let channel = await model.PayChannel.find({ where: { channelId: params.channelId } });
            if (channel) {
                utils.responseError(res, '你已经添加过此充值渠道，不可重复添加');
                return;
            }

            await model.PayChannel.create(params);
            await model.PayChannelUnion.create(params);
            utils.response(res, { code: 200, msg: '新增成功！' });

            // model.PayChannel.create(params).then(() => {
            //     model.PayChannelUnion.create(params).then(() => {
            //     }).catch(err => {
            //         console.error(err);
            //         utils.responseError(res, '新增失败！');
            //     });;
            // }).catch((err) => {
            //     console.error(err);
            //     utils.responseError(res, '新增失败！');
            // });
        } else {
            if (!utils.isString(params.channelId, 1)) {
                utils.response(res, { code: 200, msg: '参数错误' });
                return;
            }

            model.PayChannel.update(params, { where: { channelId: params.channelId } }).then(() => {
                model.PayChannelUnion.update(params, { where: { channelId: params.channelId } }).then(() => {
                    utils.response(res, { code: 200, msg: '编辑成功！' });
                }).catch((err) => {
                    console.error(err);
                    utils.responseError(res, { code: 200, msg: '编辑失败！' });
                });
            }).catch((err) => {
                console.error(err);
                utils.responseError(res, { code: 200, msg: '编辑失败！' });
            });
        }
    })();
});

/**
 * @api {post} /settings/pay/channel/wx/save 保存充值渠道
 */
router.post('/pay/channel/wx/save', (req, res) => {
    let { id, ...params } = req.body;
    console.log(id, params);

    (async () => {
        if (!id) {
            let p = await model.PayChannel.find({ where: { channelId: params.channelId } });
            if (p) {
                utils.responseError(res, '你已经添加过此充值渠道，不可重复添加');
                return;
            }
            let pwx = await model.PayChannelWx.find({ where: { channelId: params.channelId } });
            if (pwx) {
                utils.responseError(res, '你已经添加过此充值渠道，不可重复添加');
                return;
            }
            params.createTime = utils.dateNow();
            params.updateTime = utils.dateNow();
            console.log('params:');
            console.log(params);
            model.PayChannel.create(params).then(() => {
                model.PayChannelWx.create(params).then(() => {
                    utils.response(res, { code: 200, msg: '新增成功！' });
                }).catch(err => {
                    console.error(err);
                    utils.responseError(res, '新增失败！');
                });;
            }).catch((err) => {
                console.error(err);
                utils.responseError(res, '新增失败！');
            });
        } else {
            if (!utils.isString(params.channelId, 1)) {
                utils.response(res, { code: 200, msg: '参数错误' });
                return;
            }

            model.PayChannel.update(params, { where: { channelId: params.channelId } }).then(() => {
                model.PayChannelWx.update(params, { where: { channelId: params.channelId } }).then(() => {
                    utils.response(res, { code: 200, msg: '编辑成功！' });
                }).catch((err) => {
                    console.error(err);
                    utils.responseError(res, { code: 200, msg: '编辑失败！' });
                });
            }).catch((err) => {
                console.error(err);
                utils.responseError(res, { code: 200, msg: '编辑失败！' });
            });
        }
    })();
});

/**
 * @api {post} /settings/pay/channel/ali/save 保存充值渠道
 */
router.post('/pay/channel/ali/save', (req, res) => {
    let { id, ...params } = req.body;
    console.log(id, params);

    (async () => {
        if (!id) {
            let p = await model.PayChannel.find({ where: { channelId: params.channelId } });
            if (p) {
                utils.responseError(res, '你已经添加过此充值渠道，不可重复添加');
                return;
            }
            let pali = await model.PayChannelAli.find({ where: { channelId: params.channelId } });
            if (pali) {
                utils.responseError(res, '你已经添加过此充值渠道，不可重复添加');
                return;
            }
            params.createTime = utils.dateNow();
            params.updateTime = utils.dateNow();
            console.log('params:');
            console.log(params);
            model.PayChannel.create(params).then(() => {
                model.PayChannelAli.create(params).then(() => {
                    utils.response(res, { code: 200, msg: '新增成功！' });
                }).catch(err => {
                    console.error(err);
                    utils.responseError(res, '新增失败！');
                });;
            }).catch((err) => {
                console.error(err);
                utils.responseError(res, '新增失败！');
            });
        } else {
            if (!utils.isString(params.channelId, 1)) {
                utils.response(res, { code: 200, msg: '参数错误' });
                return;
            }

            model.PayChannel.update(params, { where: { channelId: params.channelId } }).then(() => {
                model.PayChannelAli.update(params, { where: { channelId: params.channelId } }).then(() => {
                    utils.response(res, { code: 200, msg: '编辑成功！' });
                }).catch((err) => {
                    console.error(err);
                    utils.responseError(res, { code: 200, msg: '编辑失败！' });
                });
            }).catch((err) => {
                console.error(err);
                utils.responseError(res, { code: 200, msg: '编辑失败！' });
            });
        }
    })();
});

/**
 * @api {post} settings/pay/edit_channel 编辑充值通道
 */
router.post('/pay/edit_channel', (req, res) => {
    let { id, ...paras } = req.body;
    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;
    paras.createTime = moment().format('YYYY-MM-DD HH:mm:ss');
    paras.updateTime = moment().format('YYYY-MM-DD HH:mm:ss');

    console.log(id, paras);

    (async () => {
        if (!id) {
            let p = await model.PayChannel.findById(id);
            if (p) {
                utils.responseError(res, '你已经添加过此充值渠道，不可重复添加');
                return;
            }
            // let cc = await model.ConfigChannel.findById(paras.channelId);
            await model.PayChannel.create(paras);

            let params = {};
            params.userId = operateid;
            params.module = '充值渠道管理';
            params.desc = operateid + '添加充值渠道 id:' + paras.id + ' 渠道id:' + paras.channelId + ' 渠道显示名称:' + paras.displayName + ' 支持设备:' + paras.devices + ' 开放玩家: ' + JSON.stringify(paras.level) + ' levels:' + paras.levels + ' 渠道最大充值:' + paras.maxpay + ' 渠道最小充值：' + paras.minpay + ' 商户id:' + paras.merchantId + ' 商户密钥:' + paras.merchantSecurity + ' 排序:' + paras.sort + ' 开启状态:' + paras.state + ',成功';
            params.opname = '新增充值渠道';
            adminlog.external(req, params);
            params.ext1 = paras.id;
            params.ext2 = paras.merchantId;
            params.ext3 = paras.merchantSecurity;
            params.columns = [];
            adminlog.logadmin(params);

            utils.response(res, { code: 200, msg: '新增成功！' });
        } else {
            if (!utils.isNumber(id, 1)) {
                utils.response(res, { code: 200, msg: '参数错误' });
                return;
            }

            // await model.ConfigChannel.findById(paras.channelId);
            await model.PayChannel.update(paras, { where: { id } });

            let params = {};
            params.userId = operateid;
            params.module = '充值渠道管理';
            params.desc = operateid + '编辑充值渠道 id:' + paras.id + ' 渠道id:' + paras.channelId + ' 渠道显示名称:' + paras.displayName + ' 支持设备:' + paras.devices + ' 开放玩家: ' + JSON.stringify(paras.level) + ' levels:' + paras.levels + ' 渠道最大充值:' + paras.maxpay + ' 渠道最小充值：' + paras.minpay + ' 商户id:' + paras.merchantId + ' 商户密钥:' + paras.merchantSecurity + ' 排序:' + paras.sort + ' 开启状态:' + paras.state + ',成功';
            params.opname = '新增充值渠道';
            adminlog.external(req, params);
            params.ext1 = paras.id;
            params.ext2 = paras.merchantId;
            params.ext3 = paras.merchantSecurity;
            params.columns = [];
            adminlog.logadmin(params);

            utils.response(res, { code: 200, msg: '编辑成功！' });
        }

        // console.log('商户信息', conf.payapi.name, paras.channelId, paras.merchantId, paras.merchantSecurity);
        redis.mset([
            `${conf.payapi.name}:${paras.channelId}:ID`.toUpperCase(), paras.merchantId,
            `${conf.payapi.name}:${paras.channelId}:KEY`.toUpperCase(), paras.merchantSecurity
        ], (err) => {
            logger.info('商户信息', err, conf.payapi.name, paras.channelId, paras.merchantId, paras.merchantSecurity);
        });
    })();
});

/**
 * @api {post} settings/pay/del_channels 删除充值通道
 */
router.post('/pay/del_channels', (req, res) => {
    let { id } = req.body;

    if (!utils.isNumber(id, 1)) {
        utils.responseError(res);
        return;
    }

    (async () => {
        let channel = await model.PayChannel.find({ where: { id } });
        let channelId = channel.channelId;

        await model.PayChannel.destroy({ where: { channelId } });
        await model.PayChannelAli.destroy({ where: { channelId } });
        await model.PayChannelUnion.destroy({ where: { channelId } });
        await model.PayChannelWx.destroy({ where: { channelId } });

        utils.response(res, { code: 200, msg: '删除成功！' });
    })();
});

router.get('/payinfo', (req, res) => {
    let orderId = req.query.orderid;
    const sequelize = new Sequelize(conf.payinfodb.database, conf.payinfodb.user, conf.payinfodb.password, {
        dialect: 'mysql',
        host: conf.payinfodb.host,
        port: conf.payinfodb.port,
    })

    sequelize.query("SELECT * FROM v_pay where orderId='" + orderId + "'").then(rows => {
        if (rows.length > 0 && rows[0].length > 0)
            res.json(rows[0][0]);
        else
            res.json({});
    })
});

//=====================================================================================================

/**
 * @api {get} withdraw/channels 提现通道列表
 */
router.get('/withdraw/channels', (req, res) => {
    let channel_name = req.query.channel_name;
    let merchant_id = req.query.merchant_id;
    let is_enabled = req.query.is_enabled;
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    let wheres = {
    };

    if (is_enabled !== null && is_enabled >= 0) {
        wheres.is_enabled = is_enabled;
    }

    if (channel_name !== null && channel_name.length > 0) {
        wheres.channel_name = channel_name;
    }

    if (merchant_id !== null && merchant_id.length > 0) {
        wheres.merchant_id = merchant_id;
    }

    let p = model.WithdrawChannel.findAndCountAll({
        attributes: ['id', 'channel_name', 'merchant_id', 'merchant_security', 'is_enabled', 'sort', 'support_devices'],
        where: wheres,
        offset: pindex * psize,
        limit: psize,
        order: [['sort', 'DESC'], ['id', 'DESC']]
    });
    utils.responseProm(res, p);
});


/**
 * @api {post} settings/withdraw/del_channels 删除提现通道
 */
router.post('/withdraw/del_channels', (req, res) => {
    let { id } = req.body;
    console.log('id:' + id);

    if (!utils.isNumber(id, 1)) {
        utils.responseError(res);
        return;
    }

    model.WithdrawChannel.destroy({ where: { id: id } }).then(() => {
        utils.response(res, { code: 200, msg: '删除成功！' });
    }).catch((error) => {
        utils.responseError(res, '删除失败！');
    });
});

/**
 * @api {post} settings/withdraw/edit_channel 编辑提现通道
 */
router.post('/withdraw/edit_channel', (req, res) => {
    let { id, channel_name, merchant_id, merchant_security, is_enabled, sort, support_devices } = req.body;
    console.log('id:' + id);

    if (!id) {
        model.WithdrawChannel.create({ channel_name, merchant_id, merchant_security, is_enabled, sort, support_devices }).then(() => {
            utils.response(res, { code: 200, msg: '新增成功！' });
        }).catch((error) => {
            utils.responseError(res, '新增失败！');
        });
    } else {
        if (!utils.isNumber(id, 0)) {
            utils.response(res, { code: 200, msg: 'id应为数字！' });
            return;
        }

        model.WithdrawChannel.update({ channel_name, merchant_id, merchant_security, is_enabled, sort, support_devices }, { where: { id: id } }).then(() => {
            utils.response(res, { code: 200, msg: '编辑成功！' });
        }).catch((error) => {
            utils.responseError(res, { code: 200, msg: '编辑失败！' });
        });
    }
});

//========================================================================================================
/**
 * @api {get} /settings/settings 参数设置列表
 */
router.get('/settings', (req, res) => {
    let desp = req.query.desp;
    let key = req.query.key;
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    let wheres = {
    };

    if (desp != null && desp.length > 0) {
        wheres.desp = desp;
    }

    if (key != null && key.length > 0) {
        wheres.key = key;
    }

    let p = model.Setting.findAndCountAll({
        attributes: ['id', 'key', 'value', 'desp'],
        where: wheres,
        offset: pindex * psize,
        limit: psize,
        order: [['id', 'DESC']]
    });
    utils.responseProm(res, p);
});


/**
 * @api {post} settings/del_setting 删除参数设置
 */
router.post('/del_setting', (req, res) => {
    let { id } = req.body;
    console.log('id:' + id);

    if (!utils.isNumber(id, 1)) {
        utils.responseError(res);
        return;
    }

    model.Setting.destroy({ where: { id: id } }).then(() => {
        db.query('select * from setting', (err, result) => {
            let datas = {};
            if (!err) {                        
                _.each(result[0], (r) => {
                    let regex = /\{(.+?)\}/g;
                    if (regex.test(r.value)) {
                        r.value = JSON.parse(r.value);
                    }
                    datas[r.key] = r.value;
                });
            }                   

            redis.set(`WebServer:Setting:Config`, JSON.stringify(datas));
        });
        utils.response(res, { code: 200, msg: '删除成功！' });
    }).catch((error) => {
        utils.responseError(res, '删除失败！');
    });
});

/**
 * @api {post} settings/edit_setting 编辑提现通道
 */
router.post('/edit_setting', (req, res) => {
    let { id, key, value, desp } = req.body;
    console.log('id:' + id);
    console.log('req.sessionID:');
    console.log(req.sessionID);

    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    if (!id) {
        model.Setting.create({ key, value, desp }).then(() => {
            db.query('select * from setting', (err, result) => {
                let datas = {};
                if (!err) {                    
                    _.each(result[0], (r) => {
                        let regex = /\{(.+?)\}/g;
                        if (regex.test(r.value)) {
                            r.value = JSON.parse(r.value);
                        }
                        datas[r.key] = r.value;
                    });
                }                   

                redis.set(`WebServer:Setting:Config`, JSON.stringify(datas));
            });
            utils.response(res, { code: 200, msg: '新增成功！' });
        }).catch((error) => {
            utils.responseError(res, '新增失败！');
        });
    } else {
        if (!utils.isNumber(id, 0)) {
            utils.response(res, { code: 200, msg: 'id应为数字！' });
            return;
        }

        model.Setting.find({ where: { id: id } }).then((e) => {
            let valueBefore = e.value;
            let despBefore = e.desp;
            model.Setting.update({ value, desp }, { where: { id: id } }).then(() => {

                db.query('select * from setting', (err, result) => {
                    let datas = {};
                    if (!err) {                        
                        _.each(result[0], (r) => {
                            let regex = /\{(.+?)\}/g;
                            if (regex.test(r.value)) {
                                r.value = JSON.parse(r.value);
                            }
                            datas[r.key] = r.value;
                        });
                    }                   
    
                    redis.set(`WebServer:Setting:Config`, JSON.stringify(datas));
                });

                let params = {};
                params.userId = operateid;
                params.module = '平台参数设置';
                params.desc = '平台参数设置修改' + key;
                params.opname = '系统操作';
                adminlog.external(req, params);
                params.ext1 = null;
                params.ext2 = null;
                params.ext3 = null;
                params.columns = [
                    {
                        "table": "setting",
                        "column": "value",
                        "key": id,
                        "before": valueBefore,
                        "after": value
                    },
                    {
                        "table": "setting",
                        "column": "desp",
                        "key": id,
                        "before": despBefore,
                        "after": desp
                    }
                ];
                adminlog.logadmin(params);

                utils.response(res, { code: 200, msg: '编辑成功！' });
            }).catch((error) => {
                utils.responseError(res, { code: 200, msg: '编辑失败！' });
            });
        }).catch((error) => {
            utils.responseError(res, { code: 200, msg: '编辑失败！' });
        });


    }
});

router.get('/tuiguanghost', (req, res) => {
    model.Setting.find({ where: { key: 'tuiguang' } }).then(data => {
        utils.response(res, { code: 200, msg: data.value });
        return req.sessionID;
    }).catch(err => {
        console.error(err);
        return Promise.reject(cons.ResultCode.ERROR);
    });
});

router.post('/addvalue', (req, res) => {
    if (!req.files)
        return res.status(400).send('No files were uploaded.');
    let f = req.files.file;
    let ext = path.extname(req.files.file.name);

    let p = path.resolve('./');
    p += '/excel' + ext;
    console.log('p:' + p);

    f.mv(p, function (err) {
        if (err)
            return res.status(500).send(err);
        var workbook = XLSX.readFile(p);
        var first_worksheet = workbook.Sheets[workbook.SheetNames[0]];
        var data = XLSX.utils.sheet_to_json(first_worksheet, { header: 1 });
        res.write(JSON.stringify(data));
        res.end();
    });
});

/**
 * @api {post} settings/qr 
 */
router.post('/qr', (req, res) => {
    if (!req.files)
        return res.status(400).send('No files were uploaded.');
    let f = req.files.file;
    let ext = path.extname(req.files.file.name);

    let p = path.resolve('./');
    p += '/qr' + ext;
    console.log('p:' + p);

    // Use the mv() method to place the file somewhere on your server
    f.mv(p, function (err) {
        if (err)
            return res.status(500).send(err);

        var buffer = fs.readFileSync(p);
        Jimp.read(buffer, function (err, image) {
            if (err) {
                console.error(err);
            }
            var qr = new QrCode();
            qr.callback = function (err, value) {
                if (err) {
                    console.error(err);
                    // TODO handle error
                    res.write('error');
                    res.end();
                }
                console.log(value.result);
                console.log(value);

                fs.exists(p, function (exists) {
                    if (exists) {
                        fs.unlink(p);
                    }
                });

                res.write(value.result);
                res.end();
            };
            qr.decode(image.bitmap);
        });
    });
});

module.exports = router;
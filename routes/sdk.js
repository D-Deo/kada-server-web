const agentManager = require('../app/agent/manager');
const cons = require('../app/common/constants');
const db = require('../app/db');
const express = require('express');
const fs = require('fs');
const sao = require('../app/server/sao');
const utils = require('../app/utils/utils');
const uuid = require('uuid/v1');


let router = express.Router();


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

    if( !utils.isString(no)) {
        res.end();
        return;
    }

    db.call('proc_agent_charge_commit', [no, result === '1' ? 1 : 2], true, (err, r) => {
        if(err) {
            res.end();
            return;
        }

        let {error, agentId, diamond, bindDiamond} = r[0][0];
        if(error) {
            res.end();
            return;
        }

        let agent = agentManager.getAgentById(agentId);
        if(!agent) {
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

    if( !utils.isString(no)) {
        res.end();
        return;
    }

    db.call('proc_user_charge_commit', [no, result === '1' ? 1 : 2], true, (err, r) => {
        if(err) {
            res.end();
            return;
        }

        let {error, userId, diamond, bindDiamond} = r[0][0];
        if(error) {
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
const async = require('async');
const db = require('../db');
const log4js = require('log4js');
const fs = require('fs');
const mysql = require('mysql');
const utils = require('../utils/utils');
const _ = require('underscore');


// time
let beginTime = utils.date.dateBegin(utils.date.lastDate());
let endTime = utils.date.dateEnd(utils.date.lastDate());
let logFileName = utils.date.formatYYMMDD(beginTime) + ".log";


// logger
log4js.configure({
    appenders: {
        std: {type: "stdout"},
        file: {type: "file", filename: logFileName}
    },

    categories: {
        default: { appenders: [ 'std', 'file' ], level: 'info' }
    }
});
let logger = log4js.getLogger();



let agentIdMap = {};
let userIdMap = {};
let userAgentMap = {};


function loadAgents(cb) {
    db.call('proc_daily_agent_details', [beginTime.toLocaleString(), endTime.toLocaleString()], true, (err, result) => {
        if(err) {
            logger.error('代理数据记载错误: ' + err);
            cb(err);
            return;
        }

        _.each(result[0], (r) => {
            let a = _.pick(r, ['id', 'binds', 'unbinds']);
            agentIdMap[a.id] = a;
        });

        logger.info('代理数据加载完成: ', _.size(agentIdMap));
        cb();
    });
}


function loadUsers(cb) {
    db.call('proc_daily_user_details', [beginTime.toLocaleString(), endTime.toLocaleString()], true, (err, result) => {
        if(err) {
            logger.error('玩家数据记载错误: ' + err);
            cb(err);
            return;
        }

        _.each(result[0], (r) => {
            let a = _.pick(r, ['id', 'agentId', 'diamond', 'bindDiamond']);
            userIdMap[a.id] = a;

            if(a.agentId) {
                userAgentMap[a.agentId] = userAgentMap[a.agentId] || {};
                userAgentMap[a.agentId][a.id] = a;
            }
        });

        logger.info('玩家数据记载完成: ', _.size(userIdMap));
        cb();
    });
}


function reset(cb) {
    db.call('proc_daily_reset', [beginTime.toLocaleString()], false, (err) => {
        if(err) {
            logger.error('清理旧数据错误: ' + err);
            cb(err);
            return;
        }

        logger.info('清理旧数据完成');
        cb();
    });
}


function dailyAgent(cb) {
    async.eachSeries(agentIdMap, (a, cb2) => {
        let d = {};
        d.agentId = a.id;
        d.timestamp = beginTime.toLocaleString();
        d.binds = a.binds;
        d.unbinds = a.unbinds;
        d.total = _.size(userAgentMap[a.id]);
        db.insert('agent_daily', d, (err) => {
            if(err) {
                logger.error('插入代理数据错误: ' + err);
                cb2(err);
                return;
            }

            cb2();
        });
    }, (err) => {
        if(err) {
            logger.error('代理数据计算错误: ' + err);
            cb(err);
            return;
        }

        logger.info('代理数据计算完成');
        cb();
    });
}


function dailyUser(cb) {
    async.eachSeries(userIdMap, (u, cb2) => {
        let d = {};
        d.userId = u.id;
        d.timestamp = beginTime.toLocaleString();
        d.agentId = u.agentId;
        d.diamond = u.diamond;
        d.bindDiamond = u.bindDiamond;
        db.insert('user_daily', d, (err) => {
            if(err) {
                logger.error('插入玩家数据错误: ' + err);
                cb2(err);
                return;
            }

            cb2();
        });
    }, (err) => {
        if(err) {
            logger.error('玩家数据计算错误: ' + err);
            cb(err);
            return;
        }

        logger.info('玩家数据计算完成');
        cb();
    });
}


logger.info('数据库每日统计开始');
async.waterfall([
    loadAgents,
    loadUsers,
    reset,
    dailyAgent,
    dailyUser
], (err) => {
    logger.info('数据库每日统计结束');
});
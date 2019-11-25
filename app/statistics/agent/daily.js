const async = require('async');
const db = require('../../db');
const fs = require('fs');
const utils = require('../../utils/utils');
const _ = require('underscore');


let agents = {};
let from = new Date('2018-03-01 00:00:00');
let to = new Date();
let dates = utils.date.spanDates(from, to);


function loadAgents(cb) {
    db.list('agent', {}, (err, rows) => {
        if(err) {
            utils.invokeCallback(cb, err);
            return;
        }

        _.each(rows, (row) => {
            let agent = _.pick(row, ['id', 'nick']);
            agents[agent.id] = agent;
        });
        console.log(agents);
        utils.invokeCallback(cb);
    });
}


function cal(cb) {
    async.eachSeries(agents, (agent, cb) => {
        calAgent(agent.id, cb);
    }, cb);
}


function calAgent(id, cb) {
    console.log('calAgent begin: ', id);

    let timer = _.now();
    async.eachSeries(dates, (date, cb2) => {
        calAgent_Daily(id, date, cb2);
    }, () => {
        console.log('calAgent end: ', id, ' ', _.now() - timer);
        utils.cb(cb);
    });
}


function calAgent_Daily(id, date, cb) {
    console.log(`[${utils.date.formatYYMMDD(date)}]calAgent_Daily begin: `, id);

    let timer = _.now();
    let from = utils.date.dateBegin(date);
    let to = utils.date.dateEnd(date);

    let agent = agents[id];
    let data = {};
    agent.data = agent.data || {};
    agent.data[utils.date.formatYYMMDD(date)] = data;
    db.call('proc_agent_user_details', [id, from.toLocaleString(), to.toLocaleString()], true, (err, result) => {
        console.log(`[${utils.date.formatYYMMDD(date)}]calAgent_Daily end: `, id, ' ', _.now() - timer);

        if(err) {
            utils.invokeCallback(cb, err);
            return;
        }

        data.diamond = _.reduce(result[0], (m, r) => {
            return m + r.diamond;
        }, 0);
        data.bindDiamond = _.reduce(result[0], (m, r) => {
            return m + r.bindDiamond;
        }, 0);
        data.dau = _.reduce(result[0], (m, r) => {
            return m + (r.login > 0 ? 1 : 0);
        }, 0);
        data.bind = _.reduce(result[0], (m, r) => {
            return m + (utils.date.isBetween(from, to, r.agentTime) > 0 ? 1 : 0);
        }, 0);
        utils.invokeCallback(cb);
    });
}


console.log('statistics.agent.daily begin');
async.waterfall([
    loadAgents,
    cal
], () => {
    fs.writeFileSync('./daily.json', JSON.stringify(agents));
    console.log('statistics.agent.daily end');
});
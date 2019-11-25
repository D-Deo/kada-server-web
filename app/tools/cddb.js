const async = require('async');
const mysql = require('mysql');
const utils = require('../utils/utils');
const _ = require('underscore');
const configuration = require(`../../config/${process.env.conf}.json`);


let agentCdDb = mysql.createPool(_.extend(configuration.db, {database: 'tw_chess_agent'}));
let gameCdDb = mysql.createPool(_.extend(configuration.db, {database: 'tw_mj'}));
let vpDb = mysql.createPool(_.extend(configuration.db, {database: 'vpserver2'}));


let agents = {};
let users = {};
let items = {};


function loadAgents(cb) {
    agentCdDb.query(`
        SELECT  ac.invite_code AS id,
                agent.login_id AS account,
                agent.contact AS address,
                agent.place AS area,
                agent.description AS desp,
                agent.normalcard AS diamond,
                agent.giftcard AS bindDiamond,
                2 AS level,
                agent.name AS nick,
                agent.password AS password,
                bc.invite_code AS recommender,
                10 AS type,
                agent.time AS \`timestamp\`
        FROM agent 
        LEFT JOIN invite_code AS ac ON agent.id = ac.agent_id
        LEFT JOIN invite_code AS bc ON agent.parent_id = bc.agent_id
        WHERE agent.password IS NOT NULL;
    `, (err, rows) => {
        // console.log(err, rows);

        _.each(rows, (r) => {
            let agent = _.pick(r, ['id', 'area', 'desp', 'diamond', 'bindDiamond', 'level', 'nick', 'password', 'type']);
            agent.id = parseInt(agent.id);
            if(!utils.isNumber(agent.id)) {
                return;
            }

            agent.account = r.account.split('@')[1];
            agent.line = r.address;
            agent.recommender = r.recommender ? parseInt(r.recommender) : null;
            agent.timestamp = (new Date(r.timestamp)).toLocaleString();
            agent.userId = parseInt(r.account.split('@')[0]);
            agent.userId = utils.isNumber(agent.userId) ? agent.userId : null;
            agents[agent.id] = agent;
        });
        cb();
    });
}


function loadUsers(cb) {
    gameCdDb.query(`
        SELECT  tb_acc.Id AS id,
                tb_acc.acc_name AS account,
                tb_player.agentId AS agentId,
                tb_player.stateExtend AS desp,
                tb_player.playerTx AS head,
                tb_player_confirm.playerName AS name,
                tb_player.playerName AS nick,
                tb_player_confirm.phoneNum AS phone,
                0 AS sex,
                tb_acc.reg_time AS \`timestamp\`,
                2 AS type,
                tb_player.roomCardNum AS diamond,
                tb_player.giveCard AS bindDiamond
        FROM tb_acc 
        LEFT JOIN tb_player ON tb_acc.Id = tb_player.id
        LEFT JOIN tb_player_confirm ON tb_acc.Id = tb_player_confirm.playerId;
    `, (err, rows) => {
        // console.log(err, rows);

        _.each(rows, (r) => {
            let user = _.pick(r, ['id', 'account', 'agentId', 'desp', 'head', 'name', 'nick', 'phone', 'sex', 'timestamp', 'type']);
            user.agentId = parseInt(user.agentId);
            user.agentId = utils.isNumber(user.agentId) ? user.agentId : null;
            user.head = (!user.head || user.head === '0') ? null : user.head;
            user.timestamp = (new Date(user.timestamp)).toLocaleString();
            users[user.id] = user;
            items[user.id] = [{userId: user.id, itemId: 2, count: r.diamond}, {userId: user.id, itemId: 3, count: r.bindDiamond}];
        });
        cb();
    });
}


function transformId(id) {
    if(!id) {
        return id;
    }


    let str = id + '';

    if(str.length >= 6) {
        return id;
    }

    return id * Math.pow(10, 6 - str.length);
}


function transformAgentId() {
    _.each(agents, (agent) => {
        agent.id = transformId(agent.id);
        agent.recommender = transformId(agent.recommender);
    });

    _.each(users, (user) => {
        user.agentId = transformId(user.agentId);
    });
}


function insertAgents() {
    let sql = '';
    _.each(agents, (agent) => {
        if(sql.length !== 0) {
            sql += ';';
        }
        sql += utils.sql.toInsertSql('agent', agent);
    });
    vpDb.query(sql, (err) => {
        console.log(err);
    });
}


function insertUsers() {
    let sql = '';
    _.each(users, (agent) => {
        if(sql.length !== 0) {
            sql += ';';
        }
        sql += utils.sql.toInsertSql('user', agent);
    });
    vpDb.query(sql, (err) => {
        console.log(err);
    });
}


function insertItems() {
    let sql = '';
    _.each(items, (is) => {
        _.each(is, (item) => {
            if(sql.length !== 0) {
                sql += ';';
            }
            sql += utils.sql.toInsertSql('item', item);
        });
    });
    vpDb.query(sql, (err) => {
        console.log(err);
    });
}


async.waterfall([
    loadAgents,
    loadUsers
], () => {
    transformAgentId();
    insertAgents();
    insertUsers();
    insertItems();
});
const Agent = require('../agent/agent');
const cons = require('../common/constants');
const db = require('../db');
const utils = require('../utils/utils');
const _ = require('underscore');


class AgentManager {
    constructor() {
        this.accountMap = {};
        this.idMap = {};
        this.idcardMap = {};
        this.lineMap = {};
        this.sessionMap = {};
        this.userIdMap = {};
    }

    addAgent(agent) {
        this.accountMap[agent.getAttr('account')] = agent;
        this.idMap[agent.getId()] = agent;

        let idcard = agent.getAttr('idcard');
        if(idcard) {
            this.idcardMap[idcard] = agent;
        }

        let line = agent.getAttr('line');
        if(line) {
            this.lineMap[line] = agent;
        }

        let userId = agent.getAttr('userId');
        if(userId) {
            this.userIdMap[userId] = agent;
        }
    }

    createAgent(attrs) {
        let id = utils.number.randomUniqueId(this.idMap, cons.AGENT_ID_LENGTH());
        let agent = new Agent(id);
        agent.loadAttrs(attrs);
        db.insert('agent', agent.toJson_Create());
        this.addAgent(agent);
        return agent;
    }

    getAgentByAccount(account) {
        return this.accountMap[account];
    }

    getAgentById(id) {
        return this.idMap[id];
    }

    getAgentByIdcard(idcard) {
        return this.idcardMap[idcard];
    }

    getAgentByLine(line) {
        return this.lineMap[line];
    }

    getAgentBySession(session) {
        return this.sessionMap[session];
    }

    getAgentByUserId(userId) {
        return this.userIdMap[userId];
    }

    bindSession(agent, session) {
        this.unbindSession(agent);

        agent.bindSession(session);
        this.sessionMap[session] = agent;
    }

    unbindSession(agent) {
        let session = agent.getSession();
        if(!session) {
            return;
        }

        delete this.sessionMap[session];
    }

    load() {
        return Promise.resolve(1);
        // db.list('agent', {}, (err, rows) => {
        //     let tree = {};
        //
        //     _.each(rows, (row) => {
        //         let agent = new Agent(row.id);
        //         agent.loadAttrs(row);
        //         this.addAgent(agent);
        //
        //         let recommender = agent.getAttr('recommender');
        //         if(!recommender) {
        //             return;
        //         }
        //         tree[recommender] = tree[recommender] || [];
        //         tree[recommender].push(agent);
        //     });
        //
        //     _.each(this.idMap, (agent) => {
        //         agent.init(tree[agent.getId()]);
        //     });
        //
        //     utils.cbOK(cb);
        // });
    }
}


module.exports = new AgentManager();
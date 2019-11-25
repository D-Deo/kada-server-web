const cons = require('../common/constants');
const model = require('../db/model');
const User = require('./user');
const data = require('../data');
const db = require('../db');
const _ = require('underscore');
const logger = require('log4js').getLogger('admin');
const Op = require('sequelize').Op;

class Manager {
    constructor() {
        this.accountMap = {};
        this.agentIdMap = {};
        this.idMap = {};
        this.sessionMap = {};
    }

    bindAgent(id, agentId) {
        let user = this.getUserById(id) || this.createUser({ id, agentId });
        let from = user.getAttr('agentId');
        user.bindAgent(agentId);
        this.remapUserByAgentId(id, from);
    }

    bindSession(id, session) {
        let user = this.getUserById(id);
        if (!user) {
            return;
        }

        console.log('delete sessionMap');
        delete this.sessionMap[user.getSession()];
        this.sessionMap[session] = user;
        user.bindSession(session);
    }

    addUser(user) {
        let agentId = user.getAttr('agentId');
        if (agentId) {
            this.agentIdMap[agentId] = this.agentIdMap[agentId] || {};
            this.agentIdMap[agentId][user.getId()] = user;
        }

        this.accountMap[user.getAttr('account')] = user;
        this.idMap[user.getId()] = user;
    }

    createUser(attrs) {
        let user = new User(attrs);
        this.addUser(user);
        return user;
    }

    getUserById(id) {
        return this.idMap[id];
    }

    getUserByAccount(account) {
        return this.accountMap[account];
    }

    getUserByAgentId(id, agentId) {
        if (!this.agentIdMap[agentId]) {
            return null;
        }

        return this.agentIdMap[agentId][id];
    }

    getUserBySession(session) {
        return this.sessionMap[session];
    }

    getUserCountByAgentId(agentId) {
        return _.size(this.agentIdMap[agentId]);
    }

    async loadUserById(id) {
        let user = this.getUserById(id);
        if (user) {
            return user;
        }

        let attrs = await model.User.find({ where: { id, state: { [Op.or]: [0, 12] } } });
        if (!attrs) {
            return null;
        }

        return this.createUser(attrs);
    }

    async loadUserByAccount(account) {
        let user = this.getUserByAccount(account);
        if (user) {
            return user;
        }

        let attrs = await model.User.find({ where: { account, state: { [Op.or]: [0, 12] } } });
        if (!attrs) {
            return null;
        }

        return this.createUser(attrs);
    }

    async loadRecommender(id) {
        let user = await this.loadUserById(id);
        let recommender = user.getAttr('recommender');
        if (!recommender) {
            return null;
        }

        return await this.loadUserById(recommender);
    }

    remapUserByAgentId(id, from) {
        let user = this.getUserById(id);
        if (from) {
            delete this.agentIdMap[from][id];
        }

        let to = user.getAttr('agentId');
        if (to) {
            this.agentIdMap[to] = this.agentIdMap[to] || {};
            this.agentIdMap[to][id] = user;
        }
    }

    load(cb) {
        return new Promise((resolve, reject) => {
            // 初始化权限配置
            let permissions = {
                menus: []
            };
            db.query('SELECT id, name, icon, path, menu, type, permissions FROM admin_permission', (err, rows) => {
                if (err != null) {
                    return reject(err);
                }
                _.each(rows[0], (row) => {
                    let ps = row.permissions.split(',');
                    row.permissions = [];
                    ps.forEach((d, i, a) => {
                        row.permissions.push(+d);
                    });
                    if (row.menu == 0) {
                        permissions.menus.push(row);
                    } else {
                        let parent = _.find(permissions.menus, (m) => {
                            return m.id == row.menu;
                        });
                        if (parent !== undefined) {
                            if (parent.children == null) parent.children = [];
                            parent.children.push(row);
                        }
                    }
                });
                logger.info('Permission Data:', JSON.stringify(permissions));
                data.permission = permissions;
                return resolve(1);
            });
        });
    }
}


module.exports = new Manager();
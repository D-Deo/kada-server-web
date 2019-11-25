const cons = require('../common/constants');
const data = require('../data');
const db = require('../db');
const userManager = require('../user/manager');
const utils = require('../utils/utils');
const _ = require('underscore');


class Agent {
    constructor(id) {
        this.id = id;
        this.attrs = {};
        this.session = null;
        this.parent = null;
        this.children = [];
    }

    bindSession(session) {
        this.session = session;
    }

    changeDiamond(itemId, count, reason, from = '', memo) {
        if(count === 0) {
            return;
        }

        let key = (itemId === cons.Item.DIAMOND() ? 'diamond' : 'bindDiamond');
        let value = this.getAttr(key) + count;
        this.setAttr(key, value);
        db.insert('agent_diamond_record', {agentId: this.getId(), from, itemId, count, reason, timestamp: utils.date.timestamp(), memo});
        return value;
    }

    getDiamond(itemId) {
        if(!itemId) {
            return this.getAttr('diamond') + this.getAttr('bindDiamond');
        }

        switch(itemId) {
            case cons.Item.DIAMOND():
                return this.getAttr('diamond');

            case cons.Item.BIND_DIAMOND():
                return this.getAttr('bindDiamond');

            default:
                return 0;
        }
    }

    haveEnoughDiamond(itemId, count) {
        return this.getDiamond(itemId) >= count;
    }

    commit(pass) {
        this.setAttr('type', pass ? cons.Agent.AGENT() : cons.Agent.AGENT_REFUSED());
    }

    getSession() {
        return this.session;
    }

    getAttr(key) {
        return this.attrs[key];
    }

    setAttr(key, value) {
        this.attrs[key] = value;
        db.update('agent', {id: this.id}, _.pick(this.attrs, [key]));
    }

    setAttrs(attrs) {
        _.each(attrs, (value, key) => this.attrs[key] = value);
        db.update('agent', {id: this.id}, attrs);
    }

    getId() {
        return this.id;
    }

    getParent() {
        return this.parent;
    }

    setParent(parent) {
        this.parent = parent || null;
    }

    getChildren() {
        return this.children;
    }

    getChildrenCount() {
        return this.children.length;
    }

    getRecommenderLevel() {
        if(!this.parent) {
            return 1;
        }

        return this.parent.getRecommenderLevel() + 1;
    }

    init(children) {
        this.children = children || [];
        _.each(this.children, (c) => c.setParent(this));
    }

    isAdmin() {
        return this.getAttr('type') === cons.Agent.ADMIN();
    }

    loadAttrs(attrs) {
        this.attrs.id = this.id;
        this.attrs.account = attrs.account;
        this.attrs.address = attrs.address || null;
        this.attrs.area = attrs.area || null;
        this.attrs.bankAccount = attrs.bankAccount || null;
        this.attrs.bankBranch = attrs.bankBranch || null;
        this.attrs.bankCode = attrs.bankCode || null;
        this.attrs.desp = attrs.desp || null;
        this.attrs.diamond = attrs.diamond || 0;
        this.attrs.bindDiamond = attrs.bindDiamond || 0;
        this.attrs.idcard = attrs.idcard || null;
        this.attrs.idcardAddress = attrs.idcardAddress || null;
        this.attrs.level = attrs.level || null;
        this.attrs.line = attrs.line || null;
        this.attrs.nick = attrs.nick;
        this.attrs.password = attrs.password;
        this.attrs.recommender = attrs.recommender || null;
        this.attrs.timestamp = attrs.timestamp || null;
        this.attrs.type = attrs.type || cons.Agent.AGENT();
        this.attrs.userId = attrs.userId || null;
    }

    toJson_Apply() {
        let json = _.pick(this.attrs, [
            'account',
            'address',
            'id',
            'idcard',
            'idcardAddress',
            'line',
            'nick',
            'recommender',
            'timestamp'
        ]);
        json.users = userManager.getUserCountByAgentId(this.id);
        return json;
    }

    toJson_Charge() {
        let json = _.pick(this.attrs, ['account', 'diamond', 'bindDiamond', 'id', 'level', 'nick']);
        json.packages = data.chargePackage[this.getAttr('level')];
        return json;
    }

    toJson_Create() {
        return this.attrs;
    }

    toJson_Diamond() {
        let json = {};
        json.diamond = this.getDiamond(cons.Item.DIAMOND());
        json.bindDiamond = this.getDiamond(cons.Item.BIND_DIAMOND());
        return json;
    }

    toJson_Login() {
        let json = {};
        json.id = this.getId();
        json.account = this.getAttr('account');
        json.name = this.getAttr('nick');
        json.nick = this.getAttr('nick');
        json.menus = data.getPermission(this.getAttr('type'));
        json.permissions = json.menus;
        json.session = this.session;
        json.token = json.session;
        json.type = this.getAttr('type');
        return json;
    }

    toJson_Register() {
        return _.pick(this.attrs, [
            'account',
            'address',
            'bankAccount',
            'bankBranch',
            'bankCode',
            'line',
            'idcard',
            'idcardAddress',
            'nick',
            'userId'
        ]);
    }
}


module.exports = Agent;
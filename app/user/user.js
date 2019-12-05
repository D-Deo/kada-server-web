const data = require('../data');
const db = require('../db');
const constants = require('../common/constants');
const _ = require('underscore');


class User {
    static create(attrs) {
        return new User(attrs);
    }

    constructor(attrs) {
        this.attrs = attrs;
        this.session = null;
    }

    bindAgent(agentId) {
        this.setAttr('agentId', agentId);
        db.call('proc_user_bind', [this.getId(), agentId], true);
    }

    bindToken(token, qrcode) {
        this.setAttr('token', token);
        this.setAttr('qrcode', qrcode);
        db.update('user', { id: this.getId() }, { token, qrcode });
    }

    bindSession(session) {
        this.session = session;
    }

    getSession() {
        return this.session;
    }

    getAttr(key) {
        return this.attrs[key];
    }

    setAttr(key, value) {
        this.attrs[key] = value;
    }

    getId() {
        return this.getAttr('id');
    }

    getInviteCode() {
        return this.getId() + "" + this.getAttr('timestamp')
    }

    isSuperAdmin() {
        return this.getAttr('role') === constants.Role.SUPER_ADMIN();
    }

    isAdmin() {
        return this.getAttr('type') === constants.Role.ADMIN();
    }

    isSuspended() {
        return this.getAttr('state') === constants.UserState.SUSPENDED();
    }

    toJson_Login() {
        let json = _.pick(this.attrs, ['id', 'account', 'nick', 'sex']);
        json.menus = data.getPermission(this.getAttr('role'));
        //json.permissions = json.menus;
        json.session = this.session;
        json.token = json.session;
        json.role = this.getAttr('role');
        json.type = this.getAttr('type');
        return json;
    }
}


module.exports = User;
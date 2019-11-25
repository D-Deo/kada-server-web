const server = require('./index');
const utils = require('../utils/utils');

let user = module.exports = {};

user.changeRole = (userId, role, type, inviteCode, cb) => {
    server.post('user/attrs', { userId, attrs: { role, type, inviteCode } }, cb);
};

user.bindAgent = (userId, agentId, agentNick, reward) => {
    server.post('user/agent', { userId, agentId, agentNick, reward });
};

user.bindAgentWithIP = (agentid, userip) => {
    server.post('user/agent/userip', { agentid, userip });
};

user.password = (account, password, cb) => {
    server.post('user/password', { account, password }, cb);
};

user.password2 = (account, password, cb) => {
    server.post('user/password2', { account, password }, cb);
};

user.resetpwd = (account, password, password2, cb) => {
    server.post('user/resetpwd', { account, password, password2 }, cb);
};

user.attr = (userId, attrs, cb) => {
    server.post('user/attrs', { userId, attrs }, null);
};

user.resetname = (userId, name, nick, cb) => {
    server.post('user/resetname', { userId, name, nick }, cb);
};

user.register = (account, device, ip, nick, password, recommender, role, type, sex, agentId, deviceid, cb) => {
    server.post('user/register', { account, device, ip, nick, password, recommender, role, type, sex, agentId, deviceid }, cb);
};

user.payComplete = (account, orderId, money, commit, cb) => {
    server.post('user/pay/complete', { account, orderId, money, commit }, cb);
};

user.withdraw = (userId, coin, name, bank, bankNo, cb) => {
    server.post('user/withdraw/submit', { userId, coin, name, bank, bankNo }, cb);
};

user.withdrawComplete = (account, orderId, money, cb) => {
    server.post_json('user/withdraw/complete', { account, orderId, money }, cb);
};

user.withdrawRefuse = (account, orderId, money, cb) => {
    server.post_json('user/withdraw/refuse', { account, orderId, money }, cb);
};
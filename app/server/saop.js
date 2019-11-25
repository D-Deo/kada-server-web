const cons = require('../common/constants');
const server = require('./index');
const utils = require('../utils/utils');


let saop = module.exports = {};


saop.item = {};


saop.item.changeItem = (userId, itemId, count, exts) => {
    return saop.item.changeItems(userId, utils.item.toItems(itemId, count), exts);
};


saop.item.changeItem_Gold = (userId, count, exts) => {
    return saop.item.changeItems(userId, utils.item.toItems(cons.Item.GOLD(), count), exts);
};


saop.item.changeItems = (userId, items, exts) => {
    return server.postp('item/change', {userId, items, exts});
};


saop.item.useItem = (userId, itemId, count, exts) => {
    return saop.item.useItems(userId, utils.item.toItems(itemId, count), exts);
};


saop.item.useItem_Gold = (userId, count, exts) => {
    return saop.item.useItem(userId, cons.Item.GOLD(), count, exts);
};


saop.item.useItems = (userId, items, exts) => {
    return server.postp('item/use', {userId, items, exts});
};


saop.user = {};


saop.user.password = (account, password) => {
    return server.postp('user/password', {account, password});
};

saop.user.password2 = (account, password) => {
    return server.postp('user/password2', {account, password});
};
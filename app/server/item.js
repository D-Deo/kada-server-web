const cons = require('../common/constants');
const server = require('./index');
const utils = require('../utils/utils');


let item = module.exports = {};


item.changeItem = (userId, itemId, count, exts, cb) => {
    item.changeItems(userId, utils.item.toItems(itemId, count), exts, cb);
};


item.changeItem_Gold = (userId, count, exts, cb) => {
    item.changeItem(userId, cons.Item.GOLD(), count, exts, cb);
};


item.changeItems = (userId, items, exts, cb) => {
    server.post('item/change', {userId, items, exts}, cb);
};


item.useItem = (userId, itemId, count, exts, cb) => {
    item.useItems(userId, utils.item.toItems(itemId, count), exts, cb);
};


item.useItems = (userId, items, exts, cb) => {
    server.post('item/use', {userId, items, exts}, cb);
};


item.chargeDiamond = (userId, itemId, count, exts, cb) => {
    server.post('item/diamond/charge', {userId, itemId, count, exts}, cb);
};


item.useDiamond = (userId, count, reason, bind, cb) => {
    server.post('item/diamond/use', {userId, count, reason, bind}, cb);
};
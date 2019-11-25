const cons = require('../common/constants');
const data = require('../data');
const _ = require('underscore');


let util = module.exports = {};


util.descItem = (itemId, count) => {
    return '【' + data.getItemName(itemId) + '】' + 'x' + count
};


util.descItems = (items, sp = '') => {
    let str = '';
    _.each(items, (count, itemId) => {
        if(str.length > 0) {
            str += sp;
        }

        str += ('【' + data.getItemName(itemId) + '】' + 'x' + count);
    });
    return str;
};


util.isDiamond = (id, bind = true) => {
    if(id === cons.Item.DIAMOND()) {
        return true;
    }

    if(bind && (id === cons.Item.BIND_DIAMOND())) {
        return true;
    }

    return false;
};


util.toItems = (id, count) => {
    let items = {};
    items[id] = count;
    return items;
};
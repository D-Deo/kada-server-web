const db = require('./index');
const utils = require('../utils/utils');


let item = module.exports = {};


item.getItemCount = (userId, itemId, cb) => {
    db.find('item', {userId, itemId}, (err, row) => {
        utils.cb(cb, row ? row.count : 0);
    });
};
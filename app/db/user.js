const db = require('./index');
const utils = require('../utils/utils');


let user = module.exports = {};


user.feedback = (userId, content) => {
    db.insert('user_feedback', {userId, content, state: 0, timestamp: utils.date.timestamp()});
};


user.isUser = (id, cb) => {
    db.find('user', {id}, (err, data) => {
        utils.cb(cb, !!data);
    });
};


user.order = (userId, type, money, item, count) => {
    let no = utils.date.no(userId);
    db.insert('user_order', {userId, no, type, money, item, count, state: 1, timestamp: utils.date.timestamp()});
    return no;
};


user.roundabout = (userId, type, cost, itemId, count, state, cb) => {
    db.call('proc_user_roundabout', [userId, type, cost, itemId, count, state], true, (err, res) => {
        if(err) {
            utils.cbError(cb);
            return;
        }

        let error = res[0][0].error;
        if(error) {
            utils.cbError(cb, error);
            return;
        }

        utils.cbOK(cb);
    });
};
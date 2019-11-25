const model = require('../../app/db/model');
const utils = require('../../app/utils/utils');

let permission = module.exports = {
};

permission.isAgent = (userId, callback, res) => {
    if (!userId) {
        callback(false);
    } else {
        model.User.findById(userId).then((user) => {
            if (!user) {
                callback(false);
                return;
            }
            if (user.role == 3) {
                callback(true);
            } else {
                callback(false);
            }
        }).catch(e => {
            console.log(e);
            callback(false);
        });
    }
};
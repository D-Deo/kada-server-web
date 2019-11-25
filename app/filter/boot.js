const cons = require('../common/constants');
const utils = require('../utils/utils');


module.exports = (req, res, next) => {
    if(req.app.disabled('booted')) {
        utils.response(res, cons.ResultCode.BOOTING());
        return;
    }

    next();
};
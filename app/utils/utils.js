const constants = require('../common/constants');
const _ = require('underscore');
const crypto = require('crypto');
const logger = require('log4js').getLogger('admin');
const utility = require('utility');
const moment = require('moment');
const events = require('events');

let utils = module.exports = {
    vercodes: {}
};

utils.date = require('./date');
utils.item = require('./item');
utils.number = require('./number');
utils.sql = require('./sql');
utils.string = require('./string');


utils.getEventEmitter = () => {
    if (!utils.eventEmitter) {
        var eventEmitter = new events.EventEmitter();
        utils.eventEmitter = eventEmitter;
    }
    return utils.eventEmitter;
};

utils.addVercode = (v, vercode) => {
    vercode = vercode.toLowerCase();
    let md5 = crypto.createHash('md5');
    let token = md5.update("" + v + vercode).digest('hex').toLocaleUpperCase();
    utils.vercodes[token] = vercode;
    console.log('addVercode', v, vercode, token);
};

utils.checkVercode = (v, vercode) => {
    vercode = vercode.toLowerCase();
    let md5 = crypto.createHash('md5');
    let token = md5.update("" + v + vercode).digest('hex').toLocaleUpperCase();
    console.log('checkVercode', v, vercode, token, utils.vercodes[token]);
    if (!_.has(utils.vercodes, token)) {
        return false;
    }
    if (utils.vercodes[token] == vercode) {
        utils.vercodes[token] = null;
        delete utils.vercodes[token];
        return true;
    }
    return false;
};

utils.cb = (cb, err, msg) => {
    cb && cb(err || null, err ? null : (_.isUndefined(msg) ? null : msg));
};


utils.cbs = (cbs, err, msg) => {
    _.each(cbs, (cb) => {
        utils.cb(cb, err, msg);
    });
};


utils.cbError = (cb, msg) => {
    utils.cb(cb, constants.ResultCode.ERROR(), msg);
};


utils.cbOK = (cb, msg) => {
    utils.cb(cb, null, msg);
};


utils.cr = (res, code) => {
    return res.code === code.code;
};


utils.crOK = (res) => {
    return utils.cr(res, constants.ResultCode.OK());
};


utils.invokeCallback = function (cb) {
    if (!cb) {
        return;
    }

    cb.apply(null, _.rest(arguments));
};


utils.isArray = (arr, i, a) => {
    if (!_.isArray(arr)) {
        return false;
    }

    return utils.isBetween(arr.length, i, a);
};


utils.isBetween = (n, i, a) => {
    if (!_.isNull(i) && !_.isUndefined(i) && n < i) {
        return false;
    }
    return !(!_.isNull(a) && !_.isUndefined(a) && n > a);
};


utils.isDate = (v) => {
    return utils.isNumber(Date.parse(v));
};


utils.isId = (n) => {
    return utils.isNumber(n, 1);
};


utils.isNumber = (n, i, a) => {
    if (_.isNaN(n)) {
        return false;
    }

    if (!_.isNumber(n)) {
        return false;
    }

    return utils.isBetween(n, i, a);
};


utils.isObject = (obj, ...keys) => {
    if (!_.isObject(obj)) {
        return false;
    }

    for (let i = 0; i < keys.length; ++i) {
        if (!_.has(obj, keys[i])) {
            return false;
        }
    }

    return true;
};


utils.isOK = (res) => {
    return res.code === constants.ResultCode.OK().code;
};


utils.isString = (str, min, max) => {
    if (!_.isString(str)) {
        return false;
    }

    return utils.isBetween(str.length, min, max);
};


utils.randomArray = (arr) => {
    return arr[_.random(0, arr.length - 1)];
};


utils.randomObject = (obj) => {
    return obj[utils.randomArray(_.keys(obj))];
};


utils.response = (res, code, msg) => {
    res.header("Content-Type", "text/plain");
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Cache-Control", "no-cache, no-store, must-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", 0);
    code = _.isNumber(code) ? { code } : (code || constants.ResultCode.OK());
    msg = (_.isUndefined(msg) || _.isNull(msg)) ? code.msg : msg;
    let obj = { code: code.code, msg: msg };
    logger.info('RESP', obj);
    res.json({ code: code.code, msg: msg });
    res.end();
};


utils.responseError = (res, msg) => {
    utils.response(res, constants.ResultCode.ERROR(), msg);
};


utils.responseBDError = (res, msg) => {
    logger.error('[DB] error:', msg);
    utils.response(res, constants.ResultCode.DB_ERROR(), msg);
};


utils.responseSessionError = (res, msg) => {
    utils.response(res, constants.ResultCode.SESSION_ERROR(), msg);
};


utils.responseOK = (res, msg) => {
    utils.response(res, constants.ResultCode.OK(), msg);
};


utils.responseProm = (res, prom) => {
    prom.catch(e => logger.error(e));

    prom.then(d => {
        utils.responseOK(res, d);
    }, e => {
        utils.response(res, e);
    });
};

utils.ip = (ip) => {
    return ip.replace('::ffff:', '').replace('::1', '');
};

utils.dateNow = (timestamp) => {
    let now = null;
    if (!timestamp)
        now = moment().format('YYYY-MM-DD HH:mm:ss');
    else
        now = moment(timestamp).format('YYYY-MM-DD HH:mm:ss');
    return now;
}

utils.md5 = (data) => {
    let str = "";
    _.each(_.sortBy(_.keys(data)), (key) => {
        if (!_.isEmpty(str)) {
            str += "&";
        }
        str += key + "=" + data[key];
    });
    let md5 = crypto.createHash('md5');
    return md5.update(str + "&key=FB430AE48ECFD7436B90C312D36CC9CA").digest('hex').toLocaleUpperCase();
};

utils.verify = (data) => utils.md5(_.omit(data, 'sign')) === data.sign;

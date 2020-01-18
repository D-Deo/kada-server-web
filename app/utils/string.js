const _ = require('underscore');
const crypto = require('crypto');

module.exports.filterEnter = (str) => {
    if (!str) {
        return str;
    }

    return str.replace(/\n/g, "");
};

module.exports.filterNick = (nick) => {
    let ret = '';
    _.map(nick, (c) => ret += (/[a-zA-Z0-9]/.test(c) || /[\u4e00-\u9fa5]/.test(c)) ? c : "*");
    return ret;
};

module.exports.randomId = (length) => {
    let id = _.random(0, Math.pow(10, length) - 1) + '';
    _.times(length - id.length, () => id = id + '0');
    return id;
};

module.exports.toHttpQuery = (params) => {
    let query = '';
    _.each(params, (value, key) => {
        if (query.length !== 0) {
            query += '&';
        }
        query += (key + '=' + encodeURIComponent(value));
    });
    return query;
};

/**
 * 返回一个待签名字串，根据object的key排序，uriparams的拼接方式组合
 */
module.exports.toSign = (data) => {
    let str = "";
    _.each(_.sortBy(_.keys(data)), (key) => {
        if (!_.isEmpty(str)) {
            str += "&";
        }
        str += key + "=" + data[key];
    });
    return str;
};

/**
 * MD5加密
 * @param {string} 待加密字串
 * @param {boolean} 是否大写，默认小写
 */
module.exports.md5 = (str, upper) => {
    let md5 = crypto.createHash('md5');
    let ret = md5.update(str).digest('hex');
    return upper ? ret.toLocaleUpperCase() : ret.toLocaleLowerCase();
};

/**
 * 创建一个唯一编码的订单号
 * @param {string} 订单类型
 */
module.exports.toOrderId = (orderType) => {
    return `${orderType}${_.now()}${_.random(1000, 9999)}`;
};

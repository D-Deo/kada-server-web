const _ = require('underscore');


let util = module.exports = {};


util.filterEnter = (str) => {
    if(!str) {
        return str;
    }

    return str.replace(/\n/g, "");
};


util.filterNick = (nick) => {
    let ret = '';
    _.map(nick, (c) => ret += (/[a-zA-Z0-9]/.test(c) || /[\u4e00-\u9fa5]/.test(c)) ? c : "*");
    return ret;
};


util.randomId = (length) => {
    let id = _.random(0, Math.pow(10, length) - 1) + '';
    _.times(length - id.length, () => id = id + '0');
    return id;
};


util.toHttpQuery = (params) => {
    let query = '';
    _.each(params, (value, key) => {
        if(query.length !== 0) {
            query += '&';
        }
        query += (key + '=' + encodeURIComponent(value));
    });
    return query;
};
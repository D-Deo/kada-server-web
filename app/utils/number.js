const _ = require('underscore');


let util = module.exports = {};


util.randomId = (length) => {
    let min = Math.pow(10, length - 1);
    let max = Math.pow(10, length) - 1;
    return _.random(min, max);
};


util.randomUniqueId = (tracer, length) => {
    while(true) {
        let id = util.randomId(length);
        if(!tracer[id]) {
            return id;
        }
    }
};


util.toString = (n, l, p = '0') => {
    let s = n + '';
    if(s.length > l) {
        return s.substr(0, l);
    }

    while(s.length < l) {
        s = p + s;
    }

    return s;
};

const numberUtil = require('./number');
const _ = require('underscore');


let util = module.exports = {};


util.dateBegin = (t) => {
    let d = new Date(t || _.now());
    d.setHours(0);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d;
};


util.dateEnd = (t) => {
    let d = new Date(t || _.now());
    d.setHours(23);
    d.setMinutes(59);
    d.setSeconds(59);
    d.setMilliseconds(999);
    return d;
};


util.formatYYMMDD = (t, sp = '-') => {
    let date = new Date(t);
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    return `${year}${sp}${numberUtil.toString(month, 2)}${sp}${numberUtil.toString(day, 2)}`;
};


util.formatHHMM = (t, sp = ':') => {
    let date = new Date(t);
    let hours = date.getHours();
    let minutes = date.getMinutes();
    return `${numberUtil.toString(hours, 2)}${sp}${numberUtil.toString(minutes, 2)}`;
};


util.formatHHMMSS = (t, sp = ':') => {
    let date = new Date(t);
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let seconds = date.getSeconds();
    return `${numberUtil.toString(hours, 2)}${sp}${numberUtil.toString(minutes, 2)}${sp}${numberUtil.toString(seconds, 2)}`;
};


util.formatYYMMDDHHMMSS = (t) => {
    return util.formatYYMMDD(t) + ' ' + util.formatHHMMSS(t);
};


util.formatHHMMSSMM = (t, sp = ':') => {
    let date = new Date(t);
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let seconds = date.getSeconds();
    let ms = date.getMilliseconds();
    return `${numberUtil.toString(hours, 2)}${sp}${numberUtil.toString(minutes, 2)}${sp}${numberUtil.toString(seconds, 2)}${sp}${numberUtil.toString(ms, 3)}`;
};


util.isBetween = (from, to, t) => {
    from = new Date(from);
    to = new Date(to);
    t = new Date(t);
    return (t.getTime() >= from.getTime()) && (t.getTime() <= to.getTime());
};


util.isExpired = (timestamp, interval) => {
    return (_.now() - timestamp) >= interval;
};


util.lastDate = (t) => {
    let d = new Date(t || _.now());
    return new Date(d.getTime() - 24 * 60 * 60 * 1000);
};


util.lastHour = (t) => {
    let d = new Date(t || _.now());
    return new Date(d.getTime() - 60 * 60 * 1000);
};

util.no = (id, timestamp) => {
    timestamp = timestamp || _.now();
    return util.formatYYMMDD(timestamp, '') + util.formatHHMMSSMM(timestamp, '') + numberUtil.toString(_.random(0, 999), 3);
};


util.remain = (timestamp, interval, to) => {
    to = to || _.now();
    return interval - (to - timestamp);
};


util.spanDates = (from, to) => {
    from = util.dateBegin(from);
    from = from.getTime();
    to = util.dateBegin(to);
    to = to.getTime();

    let dates = [];
    let iterator = from;
    while (iterator <= to) {
        dates.push(iterator);
        iterator += (24 * 60 * 60 * 1000);
    }
    return dates;
};


util.timestamp = (fmt = 'yyyy-MM-dd hh:mm:ss.S') => {
    var d = new Date();
    var o = {
        "M+": d.getMonth() + 1,                     //月份
        "d+": d.getDate(),                          //日
        "h+": d.getHours(),                         //小时
        "m+": d.getMinutes(),                       //分
        "s+": d.getSeconds(),                       //秒
        "q+": Math.floor((d.getMonth() + 3) / 3),   //季度
        "S": d.getMilliseconds()                   //毫秒
    };

    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (d.getFullYear() + "").substr(4 - RegExp.$1.length));
    }

    for (var k in o) {
        if (new RegExp("(" + k + ")").test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        }
    }
    return fmt;

    // return (new Date()).toLocaleString();
};


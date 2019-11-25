const cons = require('../common/constants');
const sms = require('../sdk/sms');
const utils = require('../utils/utils');
const _ = require('underscore');


class SmsManager {
    constructor() {
        this.codes = {};
        this.ips = {};
    }

    isExpired(type, phone, interval) {
        if(!_.has(this.codes, type)) {
            return true;
        }

        if(!_.has(this.codes[type], phone)) {
            return true;
        }

        return utils.date.isExpired(this.codes[type][phone].timestamp, interval);
    }

    send(type, phone) {
        if(!this.isExpired(type, phone, cons.SMS.SEND_INTERVAL())) {
            return this.codes[type][phone];
        }

        let code = cons.Debug.SMS_CODE() || utils.string.randomId(cons.SMS.LENGTH());
        let timestamp = _.now();
        this.codes[type] = this.codes[type] || {};
        this.codes[type][phone] = {code, timestamp};

        sms.sendCode(phone, type, code);
        return this.codes[type][phone];
    }

    commit(type, phone, code) {
        if(this.isExpired(type, phone, cons.SMS.COMMIT_INTERVAL())) {
            return false;
        }

        return (code === this.codes[type][phone].code);
    }

    checkIp(ip) {
        if(!_.has(this.ips, ip)) {
            this.ips[ip] = _.now();
            return true;
        }

        let lastTime = this.ips[ip];
        let b = utils.date.isExpired(lastTime, cons.SMS.SEND_INTERVAL());
        if (!b) {
            return false;
        }

        this.ips[ip] = _.now();
        return true;
    }
}


module.exports = new SmsManager();
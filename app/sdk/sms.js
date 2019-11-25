const cons = require('../common/constants');
const sms253 = require('./sms_253');

let sdk = module.exports = {};

sdk.sendCode = (phone, type, code) => {
    if (!cons.Debug.SMS_SEND()) {
        return;
    }

    let content = cons.SMSContent[type];
    if (!content) {
        return;
    }

    content = content.replace(/%code%/, code);
    sms253.send(phone, content);
};

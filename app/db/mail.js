const db = require('./index');
const utils = require('../utils/utils');


let mail = module.exports = {};


mail.createMail = (userId, caption, content, items = {}) => {
    db.insert('mail', {
        userId,
        caption,
        content,
        items: JSON.stringify(items),
        timestamp: utils.date.timestamp()
    });
};


mail.createMail_Roundabout = (userId, itemId, count) => {
    mail.createMail(userId, '轉盤獎勵', `恭喜您在幸運轉盤中抽中${utils.item.descItem(itemId, count)}，請聯系客服領取或兌換房卡。`);
};

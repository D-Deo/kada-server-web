const cons = require('../common/constants');
const model = require('../db/model');


let dao = module.exports = {};


dao.ether = {};


dao.ether.isCharged = async (id) => {
    let c = await model.EtherMoneyRecord.count({where: {
        etherId: id,
        type: cons.Ether.Money.WALLET(),
        reason: cons.Ether.MoneyChangeReason.PUSH()
    }});
    return c > 0;
};
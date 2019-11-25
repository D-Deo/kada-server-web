const server = require('./index');
const utils = require('../utils/utils');

let jackpot = module.exports = {};

jackpot.chargeScore = (game, area, score, cb) => {
    server.post('room/chargeScore', { game, area, score }, cb);
};

jackpot.chargeSettings = (game, area, enabled, minJackpot, maxJackpot, minBet, prob, winRate, jackpotRate, winGoldRate, loseGoldRate, winGold, loseGold, cb) => {
    server.post('room/chargeSettings', { game, area, enabled, minJackpot, maxJackpot, minBet, prob, winRate, jackpotRate, winGoldRate, loseGoldRate, winGold, loseGold }, cb);
};

jackpot.updateBlackList = (game, userId, isadd, cb) => {
    server.post('room/updateBlackList', { game, userId, isadd }, cb);
};
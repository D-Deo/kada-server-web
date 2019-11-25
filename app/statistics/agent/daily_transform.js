const fs = require('fs');
const _ = require('underscore');


let data = require('./daily.json');


_.each(data, (agent) => {
    _.each(agent.data, (d, t) => {
        d.timestamp = t;
    });

    agent.data = _.map(agent.data, (d) => {
        let r = {};
        r['日期'] = d.timestamp;
        r['房卡消耗'] = d.diamond;
        r['绑定房卡消耗'] = d.bindDiamond;
        r['总消耗'] = d.diamond + d.bindDiamond;
        r['dau'] = d.dau;
        r['新增绑定'] = d.bind;
        return r;
    });
    fs.writeFileSync('./daily_' + agent.id + '_' + agent.nick + '.json', JSON.stringify(agent.data));
});
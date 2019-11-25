const fs = require('fs');
const _ = require('underscore');


let data = module.exports = {};
// data.announcement = _.map(fs.readdirSync('./app/data/announcement'), (file) => {
//     let path = './app/data/announcement' + '/' + file;
//     let name = file.substr(0, file.indexOf("."));
//     return {name: name, content: fs.readFileSync(path, "utf-8")};
// });
data.api = require('./api');
data.chargePackage = require('./chargePackage.json');
data.item = require('./item');
data.mall = require('./mall');
// data.permission = require('./permission.json');
data.rebate = require('./rebate');
data.role = require('./role');
data.roundabout = require('./roundabout.json');


data.getMall = (id) => {
    return _.find(data.mall, (d) => d.id === id);
};


data.getItem = (id) => {
    return data.item[id];
};


data.getItemName = (id) => {
    let item = data.getItem(id);
    return item ? item.name : '';
};


data.getPermission = (type) => {
    function filter(menu) {
        if(!_.has(menu, 'permissions')) {
            return null;
        }

        if(!_.contains(menu.permissions, type)) {
            return null;
        }

        let ret = _.pick(menu, ['icon', 'name', 'path']);
        ret.children = _.compact(_.map(menu.children, (c) => filter(c)));
        return ret;
    }

    return _.compact(_.map(data.permission.menus, (m) => filter(m)));
};


data.getRebate = (count) => {
    let rate = data.getRebateRate(count);
    let rebate =  parseInt(count * rate);
    return [rate, rebate];
};


data.getRebateRate = (count) => {
    let i = _.findIndex(data.rebate, r => r.count > count);
    if(i < 0) {
        return _.last(data.rebate).rate;
    }

    i -= 1;
    if(i < 0) {
        return 0;
    }

    return data.rebate[i].rate;
};


data.getRole = (type) => {
    return _.find(data.role, (r) => r.type === type);
};


data.randomRoundabout = (type) => {
    let roundabout = data.roundabout[type];
    if(!roundabout) {
        return null;
    }

    let weight = _.reduce(roundabout, (m, d) => m + d.weight, 0);
    let rand = _.random(1, weight);
    return _.find(roundabout, (d) => {
        rand -= d.weight;
        return rand <= 0;
    });
};

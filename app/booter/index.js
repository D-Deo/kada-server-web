const cons = require('../common/constants');
const utils = require('../utils/utils');


let booting = true;


async function loadComponents() {
    let components = [
        { name: 'agent', file: require('../agent/manager') },
        { name: 'user', file: require('../user/manager') },
        { name: 'precache', file: require('./precache') }
    ];

    for (let i = 0; i < components.length; ++i) {
        console.log('booting start', components[i].name);
        await components[i].file.load();
        console.log('booting finish', components[i].name);
    }
}


module.exports.boot = () => {
    booting = true;

    console.log('booting startup');
    loadComponents().then(() => {
        console.log('booting finish all');
        booting = false;
    }).catch(e => console.log(e));

    return (req, res, next) => {
        if (booting) {
            utils.response(res, cons.ResultCode.BOOTING());
            return;
        }
        next();
    };
};
const redis = require('../redis/index')
const db = require('../db');
const _ = require('underscore');

class PreCache {
    constructor() {
    }

    load(cb) {
        return new Promise((resolve, reject) => {
            db.query('select * from setting', (err, result) => {
                if (err) {
                    return reject(err);
                }
                let data = {};
                _.each(result[0], (r) => {
                    let regex = /\{(.+?)\}/g;
                    if (regex.test(r.value)) {
                        r.value = JSON.parse(r.value);
                    }
                    data[r.key] = r.value;
                });

                redis.set(`WebServer:Setting:Config`, JSON.stringify(data));
                
                return resolve(1);
            });
        });
    }
}


module.exports = new PreCache();
const Redis = require('redis');
const conf = require(`../../config/${process.env.conf}.json`);
const { promisify } = require('util');

let opts = {
    host: conf.redis.host || '127.0.0.1',
    port: conf.redis.port || 6379,
}
if (conf.redis.auth) {
    opts.password = conf.redis.auth;
}

let redis = module.exports = {};
redis.client = Redis.createClient(opts);

redis.async = {};
redis.async.get = promisify(redis.client.get).bind(redis.client);
redis.async.incrby = promisify(redis.client.incrby).bind(redis.client);
redis.async.keys = promisify(redis.client.keys).bind(redis.client);
redis.async.mget = promisify(redis.client.mget).bind(redis.client);
redis.async.incrby = promisify(redis.client.incrby).bind(redis.client);

redis.get = (key, cb) => {
    redis.client.get(key, (err, reply) => {
        if (err) {
            return console.error(err);
        }
        if (cb) cb(reply);
    });
};

redis.mget = (keys, cb) => {
    redis.client.mget(keys, (err, reply) => {
        if (err) {
            return console.error(err);
        }
        if (cb) cb(reply);
    });
}

redis.set = (key, value) => {
    redis.client.set(key, value);
};


redis.mset = (data, cb) => {
    redis.client.mset(data, (err, reply) => {
        if (err) {
            return console.error(err);
        }
        if (cb) cb(reply);
    });
}


redis.expire = (key, time) => {
    redis.client.expire(key, time);
}

redis.del = (key, cb) => {
    redis.client.del(key, (error, reply) => {
        if (error) {
            return console.error(error);
        }
        if (cb) cb(reply);
    });
}



redis.incrby = (key, value) => {
    redis.client.incrby(key, value);
}

redis.decrby = (key, value) => {
    redis.client.decrby(key, value);
}

redis.sadd = (key, value, cb) => {
    redis.client.sadd(key, value, (err, reply) => {
        if (err) {
            return console.error(err);
        }
        if (cb) cb(reply);
    });
}

redis.smembers = (key, cb) => {
    redis.client.smembers(key, (err, reply) => {
        if (err) {
            return console.error(err);
        }
        if (cb) cb(err, reply);
    });
}

redis.select = (db) => {
    redis.client.select(db);
}

redis.lpush = (key, value, cb) => {
    redis.client.lpush(key, value, (err, reply) => {
        if (err) {
            return console.error(err);
        }
        if (cb) cb(reply);
    });
}

redis.lrange = (key, cb) => {
    redis.client.lrange(key, 0, -1, (err, reply) => {
        if (err) {
            return console.error(err);
        }
        if (cb) cb(reply);
    });
}

redis.lset = (key, index, value, cb) => {
    redis.client.lset(key, index, value, (reply) => {
        if (cb) cb(reply);
    })
}

redis.lrem = (key, value, cb) => {
    redis.client.lrem(key, 0, value, (reply) => {
        if (cb) cb(reply);
    })
}
const constants = require('../common/constants');
const http = require('http');
const utils = require('../utils/utils');
const _ = require('underscore');
const axios = require('axios');
const conf = require(`../../config/${process.env.conf}.json`);

class Server {
    constructor() {
        this.host = conf.server.host;
        this.port = conf.server.port;
        this.path = 'http://' + this.host + ':' + this.port + '/';
    }

    get(route, params, cb, path = null) {
        let query = '';
        _.each(params, (v, k) => { query += (query === '' ? '' : '&') + k + '=' + v; });
        http.get((path || this.path) + route + (query === '' ? '' : '?') + encodeURI(query), (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                cb && cb(JSON.parse(body));
            });
            res.on("error", (err) => {
                console.error(err);
                res.destory();
            });
        });
    }

    getp(route, params) {
        return new Promise((resolve, reject) => {
            this.get(route, params, (result) => {
                utils.crOK(result) ? resolve(result.msg) : reject(result);
            });
        });
    }

    post(route, params = {}, cb) {
        const data = JSON.stringify(params);
        const options = {
            hostname: this.host,
            port: this.port,
            path: '/' + route,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        let req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => cb && cb(JSON.parse(body)));
            res.on("error", (err) => {
                console.error(err);
                res.destory();
            });
        });
        req.on('error', (err) => {
            console.error('req', err);
            utils.cbError(cb, err);
        });
        req.write(data);
        req.end();
    }

    post_json(route, params = {}, cb) {
        const data = JSON.stringify(params);
        var url = 'http://' + this.host + ':' + this.port + '/' + route;
        console.log('post data:' + data);
        console.log('post url:' + url);
        axios.post(url, params).then(function (response) {
            console.log('post response.data:' + JSON.stringify(response.data));
            cb(response.data);
        }).catch(function (error) {
            console.log('post error:' + error);
            cb(error);
        });
    }

    postp(route, params) {
        return new Promise((resolve, reject) => {
            this.post(route, params, (result) => {
                utils.crOK(result) ? resolve(result.msg) : reject(result);
            });
        });
    }
}


module.exports = new Server();
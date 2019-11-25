const db = require('../db');


module.exports.request = () => {
    return (req, res, next) => {
        // let ip = req.ip;
        // let path = req.path;
        // let query = JSON.stringify(req.query);
        // let timestamp = (new Date()).toLocaleString();
        // db.insert('web_request_record', {ip, path, query, timestamp});
        next();
    };
};

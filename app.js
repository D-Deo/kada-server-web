/**
 * Module dependencies.
 */

// 获取第一个参数，并设置为平台名称
const args = process.argv.splice(2);
process.env.conf = args[0] ? `configuration_${args[0]}` : 'configuration';

console.warn('当前平台配置表：', process.env.conf);

const conf = require(`./config/${process.env.conf}.json`);
const async = require('async');
const booter = require('./app/booter');
const permission = require('./app/permission');
const operate = require('./app/operate');
const recorder = require('./app/recorder');
const utils = require('./app/utils/utils');
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const session = require('express-session');
const bodyParser = require('body-parser');
const compression = require('compression');
const fileUpload = require('express-fileupload');
const debug = require('debug')('web:server');
const http = require('http');
const request = require('request');

// const https = require('https');
// const fs = require('fs');

//for cc atack
const log4js = require('log4js');
log4js.configure(conf.logger);

let app = express();

//for cc atack
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'jade');

//for cc atack
app.use(log4js.connectLogger(log4js.getLogger('common'), { level: log4js.levels.INFO }));     //for cc atack

app.use(compression());
app.use(booter.boot());
app.use(recorder.request());
//app.use(morgan('dev'));  //for cc atack
app.use(bodyParser.json());                             // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));     // for parsing application/x-www-form-urlencoded
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: function (res) {
        res.header("Access-Control-Allow-Origin", "*");
    }
}));
app.use(fileUpload());

app.use(session({
    // cookie: { maxAge: 1000 * 60 * 60 * 24 * 365 },
    cookie: { maxAge: null },
    resave: true,
    saveUninitialized: true,
    secret: 'com.forseone.vp.web.server'
}));
app.use(permission.session());

//app.use(operate.before());//操作执行前

app.use('/api/', require('./routes/index'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/overview', require('./routes/overview'));
app.use('/api/room', require('./routes/room'));
app.use('/api/sdk', require('./routes/sdk'));
app.use('/api/user', require('./routes/user'));
app.use('/api/nn', require('./routes/nn'));
app.use('/api/finace', require('./routes/finace'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/statistics', require('./routes/statistics'));

//app.use(operate.after());//操作执行后

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    let err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function (err, req, res, next) {
    console.log(err);
    err.status = 404;
    utils.responseError(res, err);
});

// const options = {
//     key: fs.readFileSync('./ssl/2509.pem', 'utf8'),
//     cert: fs.readFileSync('./ssl/25091.pem', 'utf8')
// };

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || conf.development.port || '80');
const sslPort = normalizePort(conf.development.sslPort || '443');

app.set('port', port);

/**
 * Create HTTP server.
 */

const server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port, () => {
    console.log('http on port: ', port);
});
server.on('error', onError);
server.on('listening', onListening);

/**
 * Create HTTP SSL server.
 */

// const httpsServer = https.createServer(options, app);
// httpsServer.listen(sslPort, () => {
//     console.log('https on port: ', sslPort);
// });

/**
 * Create Socket.IO server.
 */

/*const io = require('socket.io')(server);

io.on('connection', function (socket) {
    console.log('new client connect ...');
    socket.on('disconnect', function () {
        console.log('disconnect');
        socket.emit('user_disconnected');
    });
});*/

const emitter = utils.getEventEmitter();
emitter.on('newOrder', (data) => {
    console.log('newOrder', data);
    //log4js.getLogger('common').debug(data);
    //io.emit('newOrder', data);
    var sbody = JSON.stringify(data);
    //log4js.getLogger('common').debug("string of newOrder body:"+sbody);

    request({
        url: 'http://' + conf.notifyWebSocket.host,
        method: "POST",
        headers: {
            "Content-Type": "application/json;charset=UTF-8",
        },
        body: sbody
    }, (err, resp, body) => {
        console.debug('newOrder msg send: ', body);
    });
});

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    debug('Listening on ' + bind);
}
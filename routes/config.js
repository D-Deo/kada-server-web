const cons = require('../app/common/constants');
const dao = require('../app/db/dao');
const data = require('../app/data');
const db = require('../app/db');
const express = require('express');
const model = require('../app/db/model');
const sao = require('../app/server/sao');
const saop = require('../app/server/saop');
const smsManager = require('../app/sms/manager');
const userManager = require('../app/user/manager');
const utils = require('../app/utils/utils');
const _ = require('underscore');


let router = express.Router();


router.get('/genter/game', (req, res) => {

});


model.exports = router;

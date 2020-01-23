const Sequelize = require('sequelize');
const sequelize = require('./sequelize');

let model = module.exports = {};

model.UserWithdraw = sequelize.define('user_withdraw', {
    id: { type: Sequelize.STRING, unique: true, primaryKey: true },
    userId: Sequelize.INTEGER,
    money: Sequelize.BIGINT,
    coin: Sequelize.INTEGER,
    name: { type: Sequelize.STRING, defaultValue: Sequelize.NONE },
    bank: { type: Sequelize.STRING, defaultValue: Sequelize.NONE },
    bankNo: { type: Sequelize.STRING, defaultValue: Sequelize.NONE },
    state: { type: Sequelize.INTEGER, defaultValue: 0 },
    reason: Sequelize.TEXT,
    adminId: { type: Sequelize.INTEGER, defaultValue: Sequelize.NONE },
    lock: { type: Sequelize.INTEGER, defaultValue: 0 },
    memo: Sequelize.TEXT,
    createTime: { type: Sequelize.DATE, defaultValue: Sequelize.NONE },
    updateTime: { type: Sequelize.DATE, defaultValue: Sequelize.NONE }
}, { tableName: 'user_withdraw' });

model.UserPay = sequelize.define('user_pay', {
    id: { type: Sequelize.STRING, unique: true, primaryKey: true },
    userId: Sequelize.INTEGER,
    money: Sequelize.BIGINT,
    state: { type: Sequelize.INTEGER, defaultValue: 0 },
    stateMsg: Sequelize.TEXT,
    push: Sequelize.INTEGER,
    type: Sequelize.INTEGER,
    channelId: Sequelize.INTEGER,
    rate: Sequelize.INTEGER,
    createTime: { type: Sequelize.DATE, defaultValue: Sequelize.NONE },
    updateTime: { type: Sequelize.DATE, defaultValue: Sequelize.NONE },
    order: Sequelize.STRING,
    name: { type: Sequelize.STRING, defaultValue: Sequelize.NONE },
    commit: Sequelize.INTEGER,
    adminId: { type: Sequelize.INTEGER, defaultValue: Sequelize.NONE }
}, { tableName: 'user_pay' });

model.ConfigChannel = sequelize.define('config_channel', {
    id: { type: Sequelize.STRING, unique: true, primaryKey: true },
    name: Sequelize.STRING,
    pay: Sequelize.INTEGER,
    type: Sequelize.INTEGER,
    api: { type: Sequelize.STRING, defaultValue: null }
}, { tableName: 'config_channel' });

model.PayChannel = sequelize.define('pay_channel', {
    id: { type: Sequelize.INTEGER, unique: true, primaryKey: true },
    channelId: Sequelize.STRING,
    merchantId: { type: Sequelize.STRING, defaultValue: Sequelize.NONE },
    merchantSecurity: { type: Sequelize.STRING, defaultValue: Sequelize.NONE },
    state: Sequelize.INTEGER,
    sort: Sequelize.INTEGER,
    devices: Sequelize.STRING,
    displayName: { type: Sequelize.STRING, defaultValue: Sequelize.NONE },
    levels: Sequelize.INTEGER,
    reason: Sequelize.STRING,
    minpay: Sequelize.INTEGER,
    maxpay: Sequelize.INTEGER
}, { tableName: 'pay_channel' });

model.PayChannelUnion = sequelize.define('pay_channel_union', {
    id: { type: Sequelize.INTEGER, unique: true, primaryKey: true },
    channelId: Sequelize.STRING,
    name: Sequelize.STRING,
    bank: Sequelize.STRING,
    bankNo: Sequelize.STRING,
    displayName: Sequelize.STRING,
}, { tableName: 'pay_channel_union' });

model.PayChannelWx = sequelize.define('pay_channel_wx', {
    id: { type: Sequelize.INTEGER, unique: true, primaryKey: true },
    channelId: Sequelize.STRING,
    name: Sequelize.STRING,
    account: Sequelize.STRING,
    qrcode: Sequelize.STRING,
    displayName: Sequelize.STRING,
}, { tableName: 'pay_channel_wx' });

model.PayChannelAli = sequelize.define('pay_channel_ali', {
    id: { type: Sequelize.INTEGER, unique: true, primaryKey: true },
    channelId: Sequelize.STRING,
    account: Sequelize.STRING,
    qrcode: Sequelize.STRING,
    displayName: Sequelize.STRING,
}, { tableName: 'pay_channel_ali' });

model.WithdrawChannel = sequelize.define('withdraw_channel', {
    id: { type: Sequelize.INTEGER, unique: true, primaryKey: true },
    channel_name: Sequelize.STRING,
    merchant_id: {
        type: Sequelize.STRING
    },
    merchant_security: Sequelize.STRING,
    is_enabled: Sequelize.TINYINT,
    sort: Sequelize.INTEGER,
    support_devices: Sequelize.STRING
}, { tableName: 'withdraw_channel' });

model.DeviceInfo = sequelize.define('device_info', {
    id: { type: Sequelize.BIGINT, unique: true, primaryKey: true, autoIncrement: true },
    parent_id: Sequelize.BIGINT,
    ip: Sequelize.STRING,
    device_id: Sequelize.STRING,
    created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
}, { tableName: 'device_info' });

model.Problem = sequelize.define('problem', {
    id: { type: Sequelize.BIGINT, unique: true, primaryKey: true, autoIncrement: true },
    reporterId: Sequelize.INTEGER,
    type: Sequelize.INTEGER,
    msg: Sequelize.STRING,
    status: Sequelize.INTEGER,
    msg: Sequelize.STRING,
    feedback: Sequelize.STRING
}, { tableName: 'problem' });

model.ItemRecord = sequelize.define('item_record', {
    id: { type: Sequelize.BIGINT, unique: true, primaryKey: true, autoIncrement: true },
    uid: Sequelize.INTEGER,
    itemid: Sequelize.INTEGER,
    count: Sequelize.INTEGER,
    remain: Sequelize.INTEGER,
    game: Sequelize.TEXT,
    guildid: Sequelize.INTEGER,
    from: Sequelize.TEXT,
    reason: Sequelize.INTEGER,
    timestamp: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    }
}, { tableName: 'item_record' });


model.Item = sequelize.define('item', {
    userId: Sequelize.INTEGER,
    itemId: Sequelize.INTEGER,
    count: Sequelize.INTEGER
}, { tableName: 'item' });


model.User = sequelize.define('user', {
    id: { type: Sequelize.INTEGER, unique: true, primaryKey: true },
    account: Sequelize.STRING(64),
    agentId: Sequelize.INTEGER,
    desp: Sequelize.STRING(255),
    head: Sequelize.TEXT,
    name: Sequelize.STRING(255),
    nick: Sequelize.STRING(255),
    password: Sequelize.STRING(255),
    recommender: Sequelize.STRING(255),
    sex: Sequelize.INTEGER,
    state: Sequelize.INTEGER,
    timestamp: Sequelize.DATE,
    type: Sequelize.INTEGER,
    role: Sequelize.INTEGER,
    token: Sequelize.STRING(255),
    inviteCode: Sequelize.STRING(64)
}, { tableName: 'user' });

model.Setting = sequelize.define('setting', {
    id: { type: Sequelize.INTEGER, unique: true, primaryKey: true, autoIncrement: true },
    key: Sequelize.STRING,
    value: Sequelize.STRING,
    desp: Sequelize.STRING
}, { tableName: 'setting' });

model.UserPayUnion = sequelize.define('user_pay_union', {
    id: { type: Sequelize.INTEGER, unique: true, primaryKey: true, autoIncrement: true },
    name: Sequelize.STRING,
    bank: Sequelize.STRING,
    bankNo: Sequelize.STRING,
    orderTime: Sequelize.TEXT
}, { tableName: 'user_pay_union' });

model.UserPayExt = sequelize.define('user_pay_ext', {
    id: { type: Sequelize.INTEGER, unique: true, primaryKey: true, autoIncrement: true },
    user_pay_id: Sequelize.STRING,
    platform_id: Sequelize.INTEGER,
    unionpay_card_no: Sequelize.STRING,
    alipay_name: Sequelize.STRING,
    alipay: Sequelize.STRING,
    phone: Sequelize.STRING,
    realname: Sequelize.STRING,
    create_time: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    }
}, { tableName: 'user_pay_ext' });

model.AdminPayBank = sequelize.define('admin_pay_bank', {
    id: { type: Sequelize.INTEGER, unique: true, primaryKey: true, autoIncrement: true },
    name: Sequelize.STRING,
    bank: Sequelize.STRING,
    bankNo: Sequelize.STRING,
    state: Sequelize.INTEGER,
    reason: { type: Sequelize.STRING, defaultValue: Sequelize.NONE }
}, { tableName: 'admin_pay_bank' });

model.AdminPayWx = sequelize.define('admin_pay_wx', {
    id: { type: Sequelize.INTEGER, unique: true, primaryKey: true, autoIncrement: true },
    account: { type: Sequelize.STRING, defaultValue: Sequelize.NONE },
    qrcode: { type: Sequelize.STRING, defaultValue: Sequelize.NONE },
    state: Sequelize.INTEGER,
    reason: { type: Sequelize.STRING, defaultValue: Sequelize.NONE }
}, { tableName: 'admin_pay_wx' });

model.AdminPermission = sequelize.define('AdminPermission', {
    id: { type: Sequelize.INTEGER, unique: true, primaryKey: true, autoIncrement: false },
    name: Sequelize.STRING,
    icon: Sequelize.STRING,
    path: Sequelize.STRING,
    menu: Sequelize.INTEGER,
    type: Sequelize.INTEGER,
    permissions: Sequelize.STRING
}, { tableName: 'admin_permission' });

model.ZappExchangeRecord = sequelize.define('zapp_exchange_record', {
    id: { type: Sequelize.INTEGER, unique: true, primaryKey: true, autoIncrement: true },
    transactionNo: Sequelize.STRING,
    transactionType: Sequelize.INTEGER,
    transactionNumber: Sequelize.BIGINT,
    userId: Sequelize.INTEGER,
    itemId: Sequelize.INTEGER,
    openId: Sequelize.STRING,
    orderNo: Sequelize.STRING,
    goodsCode: Sequelize.STRING,
    price: Sequelize.DECIMAL,
    money: Sequelize.DECIMAL,
    unitName: Sequelize.STRING,
    timestamp: Sequelize.BIGINT,
    nonstr: Sequelize.STRING,
}, { tableName: 'zapp_exchange_record' });
const i18n = require('../i18n');


let _ = require('underscore');


/**
 * @apiDefine Constants
 * 常量定义
 */


/**
 * @apiDefine Json
 * 数据结构
 */
let constants = module.exports = {};



constants.AGENT_ID_LENGTH = _.constant(6);
constants.USER_BIND_AGENT_REWARD = _.constant(5);

/**
 * @api {enum} role 玩家身份
 * @apiGroup Constants
 * @apiParam (enum) 1 超级管理员
 * @apiParam (enum) 2 管理员
 * @apiParam (enum) 3 代理
 * @apiParam (enum) 4 运营
 * @apiParam (enum) 11 玩家
 * @apiParam (enum) 12 测试
 * @apiParam (enum) 1000 机器人
 */
constants.Role = {
    SUPER_ADMIN: _.constant(1),
    ADMIN: _.constant(2),
    AGENT: _.constant(3),
    BUSINESS: _.constant(4),
    USER: _.constant(11),
    TEST: _.constant(12),
    ROBOT: _.constant(1000),
};

/**
 * @api {enum} type 玩家类型
 * @apiGroup Constants
 * @apiParam (enum) 1 管理员
 * @apiParam (enum) 3 代理
 * @apiParam (enum) 10 游客
 * @apiParam (enum) 11 授权账号
 * @apiParam (enum) 1000 机器人
 */
constants.UserType = {
    ADMIN: _.constant(1),
    AGENT: _.constant(3),
    GUEST: _.constant(10),
    AUTH: _.constant(11),
    ROBOT: _.constant(1000),
};

/**
 * @api {enum} AccountState 帐号状态
 * @apiGroup Constants
 * @apiParam (enum) 0 正常
 * @apiParam (enum) 1 冻结
 */
constants.AccountState = {
    IDLE: _.constant(0),
    LOCK: _.constant(1),
};



/**
 * @api {enum} PermissionType 权限类型
 * @apiGroup Constants
 * @apiParam (enum) 0 功能
 * @apiParam (enum) 1 菜单
 */
constants.PermissionType = {
    FUNC: _.constant(0),
    MENU: _.constant(1),
};



/**
 * @api {enum} agent 代理类型
 * @apiGroup Constants
 * @apiParam (enum) 1 管理员
 * @apiParam (enum) 10 审核通过的正常代理
 * @apiParam (enum) 11 审核中的代理
 * @apiParam (enum) 12 审核失败的代理
 */
constants.Agent = {
    ADMIN: _.constant(1),
    AGENT: _.constant(10),
    AGENT_APPLYING: _.constant(11),
    AGENT_REFUSED: _.constant(12),
};



constants.AgentCharge = {
    ALIPAY: _.constant(1),
    WECHAT: _.constant(2),
    OFB: _.constant(3),
};



constants.AgentDiamondChangeReason = {
    CHARGE: _.constant(1),
    SELL: _.constant(2),
    ADMIN: _.constant(3),
};



constants.Debug = {
    LOGIN_VALID: _.constant(false),
    SMS_CODE: _.constant('111111'),
    SMS_SEND: _.constant(false)
};



/**
 * @api {enum} item 物品类型
 * @apiGroup Constants
 * @apiParam {enum} 1 (GOLD) 金币
 * @apiParam {enum} 2 (DIAMOND) 非绑定钻
 * @apiParam {enum} 3 (BIND_DIAMOND) 绑定钻
 */
constants.Item = {
    GOLD: _.constant(1),
    DIAMOND: _.constant(2),
    BIND_DIAMOND: _.constant(3),
};



constants.ItemChangeReason = {
    UNKNOWN: _.constant(0),
    PLAY: _.constant(1),
    DEPOSIT: _.constant(2),
    UNDEPOSIT: _.constant(3),
    MAIL: _.constant(4),
    ROUNDABOUT: _.constant(5),
    BIND_AGENT: _.constant(6),
    BIND_PHONE: _.constant(7),
    ADMIN: _.constant(8),
    AGENT: _.constant(9),
    BUY: _.constant(10),
    ROUNDABOUT_COST: _.constant(11),
    NEW_USER: _.constant(12),
    PLAY_ROUND_COST: _.constant(13),
    FROM_ETHER: _.constant(14),
    TO_ETHER: _.constant(15),
    RECOMMENDER_BIND: _.constant(16),
    RECOMMENDER_CHARGE: _.constant(17),
    RECOMMENDER_PLAY: _.constant(18),
    TO_WFEE: _.constant(19),
};



/**
 * @api {enum} ResultCode 错误码
 * @apiGroup Constants
 * @apiParam {enum} 200 (OK)
 * @apiParam {enum} 400 (ERROR) 通用错误
 * @apiParam {enum} 401 (BOOTING) 服务器启动中
 * @apiParam {enum} 402 (SESSION_ERROR) 无效会话 需要重新登录
 * @apiParam {enum} 11000 (MAIL_ERROR) 邮件错误
 */
constants.ResultCode = {
    OK: _.constant({ code: 200, msg: 'ok' }),
    ERROR: _.constant({ code: 400, msg: 'error' }),
    BOOTING: _.constant({ code: 401, msg: '服务器启动中' }),
    DB_ERROR: _.constant({ code: 403, msg: "处理失败" }),
    SESSION_ERROR: _.constant({ code: 402, msg: "无效会话，请重新登录" }),
    COMMITED_AGENT: _.constant({ code: 10001, msg: '已审核代理' }),
    UNKNOWN_AGENT: _.constant({ code: 10002, msg: '未知代理' }),
    UNKNOWN_INVITE_CODE: _.constant({ code: 10002, msg: '邀请码错误或不存在' }),
    USED_PHONE: _.constant({ code: 10003, msg: '手机号码已注册' }),
    USED_IDCARD: _.constant({ code: 10004, msg: '身份证号已注册' }),
    USED_LINE: _.constant({ code: 10005, msg: 'line已注册' }),
    USED_USER_ID: _.constant({ code: 10006, msg: '玩家已注册' }),
    CODE_ERROR: _.constant({ code: 10007, msg: '验证码错误' }),
    UNKNOWN_USER: _.constant({ code: 10009, msg: "未知用户" }),
    BINDED_INVITE_CODE: _.constant({ code: 10010, msg: "玩家不能重复绑定邀请码" }),
    BINDED_USER_AGENT: _.constant({ code: 10010, msg: "玩家不能重复绑定代理" }),
    BINDED_USER_PHONE: _.constant({ code: 10011, msg: "玩家不能重复绑定手机号码" }),
    NOT_ENOUGH_DIAMOND: _.constant({ code: 10012, msg: "剩余钻石不足" }),
    UNBIND_USER: _.constant({ code: 10013, msg: "未绑定用户" }),
    USER_SUSPENDED: _.constant({ code: 10014, msg: "账号已冻结" }),
    SAMEIP_USERS_OVERED: _.constant({ code: 10015, msg: "相同IP下用户数超限额" }),
    SAME_DEVICEID: _.constant({ code: 10016, msg: "相同设备号下用户数超限额" }),
    WITHDRAW_ERROR: _.constant({ code: 10017, msg: "提现失败，请联系客服询问" }),

    MAIL_ERROR: _.constant({ code: 11000, msg: "邮件错误" }),
    MAIL_DEL_ERROR: _.constant({ code: 11001, msg: "邮件删除错误" }),
    AGENT_ERROR: _.constant({ code: 12000, msg: "代理错误" }),
    AGENT_CHARGE_ERROR: _.constant({ code: 12100, msg: "代理充值错误" }),
    USER_ERROR: _.constant({ code: 13000, msg: "玩家错误" }),
    USER_ACCOUNT_USED: _.constant({ code: 13001, msg: "玩家账号已注册" }),
    USER_UNKNOWN: _.constant({ code: 13002, msg: "未知玩家" }),
    USER_PASSWORD_ERROR: _.constant({ code: 13003, msg: "密码错误" }),
    USER_TOKEN_ERROR: _.constant({ code: 13004, msg: "未绑定Google验证码" }),
    USER_VALID_ERROR: _.constant({ code: 13005, msg: "Google验证码不匹配" }),
    USER_VALID_UNKNOWN: _.constant({ code: 13006, msg: "已绑定Google验证码，请使用验证码登录" }),
    ETHER_ERROR: _.constant({ code: 14000, msg: "钱包错误" }),
    ETHER_UNKNOWN: _.constant({ code: 14001, msg: "钱包未生成" }),
    ETHER_REGENERATE: _.constant({ code: 14002, msg: "钱包重复生成" }),
    ETHER_MONEY_NOT_ENOUGH: _.constant({ code: 14003, msg: "钱包余额不足" }),
    ETHER_POLL_ADDRESS_ERROR: _.constant({ code: 14004, msg: "提取地址错误" }),
    ORDER_UNKNOWN: _.constant({ code: 19001, msg: "订单不存在" }),
    UNKNOWN_ADMIN: _.constant({ code: 19002, msg: "未知操作员" }),

    // 管理中心 
    ADMIN_PERMISSION_ERROR: _.constant({ code: 15001, msg: "权限角色不存在或格式不正确" }),
    ADMIN_PERMISSION_COMMIT_ERROR: _.constant({ code: 15002, msg: "权限保存失败" }),
    ADMIN_PERMISSION_CREATE_ERROR: _.constant({ code: 15003, msg: "权限创建失败" }),
    ADMIN_PERMISSION_DELETE_ERROR: _.constant({ code: 15004, msg: "权限删除失败" }),

    USER_BANK_DELETE_ERROR: _.constant({ code: 16000, msg: "玩家银行卡删除失败" }),

    USER_LEVEL_UPDATE_ERROR: _.constant({ code: 17000, msg: "玩家分类修改失败" }),
    USER_LEVEL_DELETE_ERROR: _.constant({ code: 17001, msg: "玩家分类删除失败" }),
    USER_LEVEL_CANT_DELETE_ERROR: _.constant({ code: 17001, msg: "玩家分类使用中，不能删除" }),

    REDIRECT: _.constant({ code: 500, msg: 'redirect' }),
    VERCODE_ERROR: _.constant({ code: 501, msg: '验证码不匹配' }),
    VERCODE_SAME_IP_ERROR: _.constant({ code: 502, msg: '同IP访问请求次数过多，请稍后再试' }),
    BINDED_AGENT: _.constant({ code: 10010, msg: "代理不能重复绑定游戏用户" }),
    NOT_AGENT: _.constant({ code: 10011, msg: "未知代理" }),
    BINDED_PLAYER: _.constant({ code: 10012, msg: "已绑定游戏用户" }),
    NOT_IN_GUILD: _.constant({ code: 10013, msg: "非公会成员，无法查看" }),
    UNBINDED_AGENT: _.constant({ code: 10014, msg: "没有绑定游戏账号" }),
    UNBINDED_AGENT_CAN_NOT_CHARGE: _.constant({ code: 10015, msg: "代理未绑定游戏账号, 无法充值" }),
    INVALID_ACCOUNT: _.constant({ code: 10016, msg: "账号包含非法字符" }),
    INVALID_PASSWORD: _.constant({ code: 10017, msg: "密码包含非法字符" }),
    NOT_ENOUGH_REBATE: _.constant({ code: 10018, msg: "返利不足, 无法体现" }),
    NOPERMISSION: _.constant({ code: 99999, msg: "没有权限" }),
    NOACCOUNT: _.constant({ code: 10019, msg: "查无此号信息" }),
    NOOLDACCOUNT: _.constant({ code: 10020, msg: "输入旧账户错误" }),
    NEWACCOUNTREPET: _.constant({ code: 10021, msg: "输入新账号已被注册" }),
    ACCOUNTERROR: _.constant({ code: 10022, msg: "账号长度必须大于6位" }),
    NOTHISGUIDE: _.constant({ code: 10023, msg: "查无此公会" }),
    NOADMINACCOUNT: _.constant({ code: 10024, msg: "账号不存在" }),
    ERRORPASSWORD: _.constant({ code: 10025, msg: "密码错误" }),
    SAVEFAILD: _.constant({ code: 10027, msg: "存入失敗" }),
    MAILFAILED: _.constant({ code: 11000, msg: "未知邮件" }),
    NOTIMES: _.constant({ code: 10028, msg: "抽奖次数不足" }),
    SAVEITEMFAILD: _.constant({ code: 10029, msg: "添加物品失败" }),
    TOKENMISS: _.constant({ code: 10030, msg: "验证码已过期" }),
    CODEERROR: _.constant({ code: 10031, msg: "验证码错误" }),
    RECEIVEFAIL: _.constant({ code: 10032, msg: "领取失败" }),
    INVALIDPARAMS: _.constant({ code: 10033, msg: "参数包含非法字符" }),
    LOADFILEFAILED: _.constant({ code: 10034, msg: "加载文件失败" }),
    DELETEFAILED: _.constant({ code: 10035, msg: "请先领取邮件物品" }),
    NOPASS: _.constant({ code: 10036, msg: "您的账户未审核通过" }),
    PARAMSERROR: _.constant({ code: 10037, msg: "参数错误" }),
    BINDE: _.constant({ code: 10038, msg: "您的账户已绑定手机号" }),
    AGENTREPETR: _.constant({ code: 10039, msg: "代理不能绑定自己" }),
};



constants.Roundabout = {
    FREE: _.constant(1),
    DIAMOND: _.constant(2),
};



constants.RoundaboutCost = {
    FREE: _.constant(4),
    DIAMOND: _.constant(3),
};



constants.Sex = {
    MALE: _.constant(1),
    FEMALE: _.constant(2),
};



constants.SMS = {
    AGENT_REGISTER: _.constant('AgentRegister'),
    COMMIT_INTERVAL: _.constant(600000),
    LENGTH: _.constant(4),
    SEND_INTERVAL: _.constant(60000),
    USER_BIND_PHONE: _.constant('UserBindPhone'),
    USER_PASSWORD: _.constant('UserPassword'),
    USER_PASSWORD2: _.constant('UserPassword'),
    USER_POLL: _.constant('UserPoll'),
    USER_REGISTER: _.constant('UserRegister'),
};



constants.SMSContent = {
    AgentRegister: i18n.__('SMSContent_AgentRegister'),
    UserBindPhone: i18n.__('SMSContent_UserBindPhone'),
    UserPassword: i18n.__('SMSContent_UserPassword'),
    UserPoll: i18n.__('SMSContent_UserPoll'),
    UserRegister: i18n.__('SMSContent_UserRegister'),
};



constants.PurposeCode = {
    REGISTER: _.constant(0),
    PASSWORD: _.constant(1),
    BIND: _.constant(2),
};



constants.AgentState = {
    NOREAD: _.constant(0),
    PASSD: _.constant(1),
    CONFUSED: _.constant(2),
};


constants.UserPayPush = {
    UNPUSH: _.constant(0),
    SUCCESS: _.constant(1),
};


constants.UserPayState = {
    UNPAY: _.constant(0),
    SUCCESS: _.constant(1),
    CANCEL: _.constant(2),
    INGORE: _.constant(3),
};



constants.AgentOrder = {
    ALIPAY: _.constant(1),
    WECHAT: _.constant(2),
    ADMIN: _.constant(3),
    SERVICE: _.constant(4),
};


constants.UserCharge = {
    ALIPAY: _.constant(1),
    WECHAT: _.constant(2),
    SERVICE: _.constant(3),
    ADMIN: _.constant(4),
    AGENT: _.constant(5),
    IAP: _.constant(6),
    OFB: _.constant(7),
};


constants.UserState = {
    NORMAL: _.constant(0),
    SUSPENDED: _.constant(11),
};


constants.Ether = {
    // COLD_WALLET: _.constant('0xd29726aec1b672b7f3151dcc26537de8b45e0f2a'),
    COLD_WALLET: _.constant('0xE4D098Eb2184Fd275F031A7f73F6080043Be36cd'),
    MINER_SCHEDULE_INTERVAL: _.constant(30000),
    RECOMMENDER_CHARGE_REWARD: _.constant(200),
};


constants.Ether.Money = {
    WALLET: _.constant(1),
    PUSH: _.constant(2),
    POLL: _.constant(3),
};


constants.Ether.MoneyChangeReason = {
    POLL: _.constant(1),
    PUSH: _.constant(2),
    TO_GOLD: _.constant(3),
    FROM_GOLD: _.constant(4),
    POLL_CANCEL: _.constant(5),
};


constants.Ether.Token = {
    ETH: _.constant('eth'),
    WFEE: _.constant('wfee'),
    UPG: _.constant('upg')
};


constants.Ether.TokenChangeReason = {
    POLL: _.constant(1),
    PUSH: _.constant(2),
    TO_GOLD: _.constant(3),
    FROM_GOLD: _.constant(4),
    POLL_RETURN: _.constant(5)
};


constants.Ether.Transaction = {

    USER_PUSH: _.constant(1),
    USER_POLL: _.constant(2),
    ASSEMBLER: _.constant(3),
    GAS: _.constant(4)
};


constants.Ether.TransactionState = {

    ERROR: _.constant(-1),
    INIT: _.constant(0),
    READY: _.constant(1),
    WAIT: _.constant(2),
    SEND: _.constant(3),
    CONFIRM: _.constant(4),
    WAIT_COMMIT: _.constant(11),
    WAIT_POLL: _.constant(12)
};


constants.Jackpot = {
    ENABLED: _.constant('enabled'),
    MINJACKPOT: _.constant('minJackpot'),
    MAXJACTPOT: _.constant('maxJackpot'),
    MINBET: _.constant('minBet'),
    JACKPOT: _.constant('jackpot'),
    PROB: _.constant('prob'),
    WIN_RATE: _.constant('winRate'),
    JACKPOT_RATE: _.constant('jackpotRate'),
    WIN_GOLD_RATE: _.constant('winGoldRate'),
    LOSE_GOLD_RATE: _.constant('loseGoldRate'),
    WIN_GOLD: _.constant('winGold'),
    LOSE_GOLD: _.constant('loseGold')
};
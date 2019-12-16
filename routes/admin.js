const agentManager = require('../app/agent/manager');
const cons = require('../app/common/constants');
const data = require('../app/data');
const db = require('../app/db');
const express = require('express');
const fs = require('fs');
const model = require('../app/db/model');
const sao = require('../app/server/sao');
const saop = require('../app/server/saop');
const server = require('../app/server');
const jackpot = require('../app/server/jackpot');
const userManager = require('../app/user/manager');
const utils = require('../app/utils/utils');
const _ = require('underscore');
const redis = require('../app/redis');
const async = require('async');
const permission = require('../app/utils/permission');
const adminlog = require('../app/utils/adminlog');
const utility = require('utility');
const requestIp = require('request-ip');
const libqqwry = require('lib-qqwry');
const logger = require('log4js').getLogger('admin');

let router = express.Router();

/**
 * @api {get} admin/accounts 获取帐号列表
 * @class admin
 * @param {number} status            全部(-1) 正常(0) 冻结(11)
 * @param {number} roleId            全部(0) 管理员(1) 客服(2) 代理(3) 玩家(11) 机器人(1000)
 * @param {number} pindex            分页索引
 * @param {number} psize             分页大小
 * @param {string}  search           搜索id
 * @param {date}   create_time       创建时间
 * @param {string} column            排序的列 null 不排序 否则传对应的数据名
 * @param {string} order             排序类型 null 不排序 desc 降序 asc 升序
 * @return 返回
 * [{
 *  "id": 帐号ID
 *  "account": 帐号名称
 *  "state": 帐号状态 0-正常 11-锁定
 *  "type": 帐号类型（角色身份）：0-未知 1-管理员 2-客服 11-玩家 1000-机器人
 *  "timestamp": 创建时间
 * }]
 */
router.get('/accounts', (req, res) => {
    // let admin = userManager.getUserBySession(req.sessionID);
    let admin = req.admin;
    if (!admin) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }

    let { status = -1, roleId = 0, search = null, create_time = null, start = null, end = null, column = 'role', order = 'ASC' } = req.query;

    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    if (admin.isSuperAdmin()) {
        db.call('proc_admin_details_admin', [status, roleId, search, start, end, pindex, psize, column, order], true, (err, result) => {
            if (err) {
                utils.responseError(res);
                return;
            }

            let data = result[0];
            let total = result[1][0].total;
            utils.responseOK(res, { data, total });
        });
    } else {
        db.call('proc_admin_details', [status, roleId, search, start, end, pindex, psize, column, order], true, (err, result) => {
            if (err) {
                utils.responseError(res);
                return;
            }

            let data = result[0];
            let total = result[1][0].total;
            utils.responseOK(res, { data, total });
        });
    }

});

/**
 * @api {post} admin/accounts/add 添加帐号
 * @class admin
 * @param {string} account 帐号
 * @param {string} password 帐号密码
 * @param {number} role 角色类型 0-未知 1-管理员 2-客服 3-代理
 * @param {number} type 玩家身份 0-未知 1-管理员 3-代理 10-游客 11-授权账号 
 */
router.post('/accounts/add', (req, res) => {
    let { account, password, role, type } = req.body;

    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    if (!utils.isString(account) ||
        !utils.isString(password) ||
        !utils.isNumber(role, 0) ||
        !utils.isNumber(type, 0) ||
        !utils.isId(operateid)) {
        utils.responseError(res);
        return;
    }

    sao.user.register(account, 'web', utils.ip(requestIp.getClientIp(req)), account, password, null, role, type, 0, null, null, (result) => {
        let params = {};
        params.userId = operateid;
        params.module = '帐号管理';
        let sUser = '';
        switch (role) {
            case 1:
                sUser = '管理员';
                break;
            case 2:
                sUser = '客服';
                break;
            case 3:
                sUser = '代理';
                break;
            case 4:
                sUser = '管理员';
                break;
            case 11:
                sUser = '玩家';
                break;
            case 1000:
                sUser = '机器人';
                break;
            default:
                sUser = '未知';
                break;
        }
        params.desc = `${operateid} 新增 ID:${sUser} 账号:${account} 角色:${role} 类型:${type}, 成功`;
        params.opname = '新增用户';
        adminlog.external(req, params);
        params.ext1 = account;
        params.ext2 = role;
        params.ext3 = null;
        params.columns = [];
        adminlog.logadmin(params);
        utils.response(res, result);
    });
});


/**
 * @api {post} admin/accounts/permission 修改玩家类型
 * @param {number} id 玩家ID
 * @param {string} permission 玩家类型
 */
router.post('/accounts/permission', (req, res) => {
    let { id, permission, type } = req.body;

    if (!utils.isId(id) ||
        !utils.isNumber(permission, 0)) {
        utils.responseError(res);
        return;
    }

    let admin = userManager.getUserBySession(req.sessionID);
    if (!admin) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }

    let operateid = admin.attrs.id;
    let operaterole = admin.attrs.role;

    if (operaterole != 1 && permission == 1) {
        utils.response(res, { code: 200, msg: '管理员不能执行提升超级管理员操作' });
        return;
    }

    let params = { role: permission };
    if (type) {
        params.type = type;
    }

    if (permission == cons.Role.AGENT()) {
        params.inviteCode = utils.md5(admin.getId() + "" + admin.getAttr('timestamp'));
    }

    model.User.update(params, { where: { id } }).then(result => {
        console.log(result);
        if (permission == cons.Role.AGENT()) {
            let params = {};
            params.userId = operateid;
            params.module = '玩家列表';
            params.desc = operateid + '提升' + id + '成为代理成功';
            params.opname = '提升代理';
            adminlog.external(req, params);
            params.ext1 = id;
            params.ext2 = null;
            params.ext3 = null;
            params.columns = [];
            adminlog.logadmin(params);
        } else if (permission == cons.Role.TEST()) {
            let params = {};
            params.userId = operateid;
            params.module = '玩家列表';
            params.desc = operateid + '转换' + id + '成为测试,成功';
            params.opname = '转为测试';
            adminlog.external(req, params);
            params.ext1 = id;
            params.ext2 = null;
            params.ext3 = null;
            params.columns = [];
            adminlog.logadmin(params);
        }

        let user = userManager.getUserById(id);
        if (user) {
            user.setAttr('role', permission);
            user.setAttr('inviteCode', params.inviteCode);
        }

        sao.user.changeRole(id, permission, type, params.inviteCode);
        utils.responseOK(res);
    }).catch(err => {
        logger.error(err);
        utils.responseBDError(res);
    });
});

/**
 * @api {get} admin/permission 获取权限配置列表
 * @apiSuccessExample 返回
 * [{
 *  "id": 1, 权限ID
 *  "name": '', 权限名称
 *  "icon": '', 权限图标
 *  "path": '', 前端页面路径
 *  "menu": '0', 菜单所属：0-没有所属（1级菜单）
 *  "type": '1', 权限类型：0-功能 1-菜单
 *  "permissions": '1,2,11', 权限分配：int数组形式的字符串，数字编号等于角色类型，1-管理员 2-客服 11-玩家
 * }]
 */
router.get('/permission', (req, res) => {
    console.log(req.sessionID);
    db.query('SELECT id, name, icon, path, menu, type, permissions FROM admin_permission', (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        utils.responseOK(res, result[0]);
    });
});

/** 
 * @api {post} admin/permission/add 添加权限
 * @class admin
 * @param {number} id 权限ID
 * @param {string} name 权限名称
 * @param {string} icon 图标
 * @param {string} path 前端路径
 * @param {number} menu 权限所属
 * @param {number} type 权限类型
 * @param {string} permissions 权限角色分配（注意格式）
 */
router.post('/permission/add', (req, res) => {
    let { id, name, icon, path, menu, type, permissions } = req.body;

    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    if (!utils.isNumber(id) ||
        !utils.isString(name) ||
        !utils.isString(icon) ||
        !utils.isString(path) ||
        !utils.isNumber(menu) ||
        !utils.isNumber(type, cons.PermissionType.FUNC(), cons.PermissionType.MENU()) ||
        !utils.isString(permissions)) {
        utils.responseError(res);
        return;
    }

    // 检测权限角色分配的字段格式是否正确
    let ps = permissions.split(',');
    if (ps.length == 0) {
        return utils.responseError(res, cons.ResultCode.ADMIN_PERMISSION_ERROR());
    }

    // 检测权限分配的角色是否存在
    let ret = _.some(ps, (p) => {
        let pn = parseInt(p);
        return !utils.isNumber(pn, cons.Role.ADMIN(), cons.Role.USER());
    });
    if (ret) {
        return utils.responseError(res, cons.ResultCode.ADMIN_PERMISSION_ERROR());
    }

    db.call('proc_admin_permission_add', [id, name, icon, path, menu, type, permissions], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let error = result[0][0].error;
        if (error) {
            utils.response(res, cons.ResultCode.ADMIN_PERMISSION_CREATE_ERROR(), error);
            return;
        }

        //==============================================================
        //操作日志
        let params = {};
        params.userId = operateid;
        params.module = '权限管理';
        params.desc = '新增权限' + name;
        params.opname = '系统操作';
        adminlog.external(req, params);
        params.ext1 = null;
        params.ext2 = null;
        params.ext3 = null;
        params.columns = [
            {
                "table": "admin_permission",
                "column": "id",
                "key": id,
                "before": null,
                "after": id
            },
            {
                "table": "admin_permission",
                "column": "name",
                "key": id,
                "before": null,
                "after": name
            },
            {
                "table": "admin_permission",
                "column": "icon",
                "key": id,
                "before": null,
                "after": icon
            },
            {
                "table": "admin_permission",
                "column": "icon",
                "key": id,
                "before": null,
                "after": path
            },
            {
                "table": "admin_permission",
                "column": "menu",
                "key": id,
                "before": null,
                "after": menu
            },
            {
                "table": "admin_permission",
                "column": "type",
                "key": id,
                "before": null,
                "after": type
            },
            {
                "table": "admin_permission",
                "column": "permissions",
                "key": id,
                "before": null,
                "after": permissions
            }
        ];
        adminlog.logadmin(params);
        //==============================================================

        let row = {
            id: id,
            name: name,
            icon: icon,
            path: path,
            menu: menu,
            type: type,
            permissions: permissions
        }

        let ps = row.permissions.split(',');
        row.permissions = [];
        ps.forEach((d, i, a) => {
            row.permissions.push(+d);
        });
        if (row.menu == 0) {
            data.permission.menus.push(row);
        } else {
            let parent = _.find(data.permission.menus, (m) => {
                return m.id == row.menu;
            });
            if (parent !== undefined) {
                if (parent.children == null) parent.children = [];
                parent.children.push(row);
            }
        }

        utils.responseOK(res);
    });
});

/** 
 * @api {post} admin/permission/commit 设置权限
 * @class admin
 * @param {number} id 权限ID（要修改的权限ID，但ID本身不能被修改）
 * @param {string} name 权限名称
 * @param {string} icon 图标
 * @param {string} path 前端路径
 * @param {number} menu 权限所属
 * @param {number} type 权限类型
 * @param {string} permissions 权限角色分配（注意格式）
 */
router.post('/permission/commit', (req, res) => {
    let { id, name, icon, path, menu, type, permissions } = req.body;

    if (!utils.isNumber(id) ||
        !utils.isString(name) ||
        (icon && !utils.isString(icon)) ||
        (path && !utils.isString(path)) ||
        !utils.isNumber(menu) ||
        !utils.isNumber(type, cons.PermissionType.FUNC(), cons.PermissionType.MENU()) ||
        !utils.isString(permissions)) {
        utils.responseError(res);
        return;
    }

    // 检测权限角色分配的字段格式是否正确
    let ps = permissions.split(',');
    ps.forEach((d, i, a) => {
        ps[i] = +d;
    });
    if (ps.length == 0) {
        return utils.responseError(res, cons.ResultCode.ADMIN_PERMISSION_ERROR());
    }

    // 检测权限分配的角色是否存在
    // let ret = _.some(ps, (p) => {
    //     let pn = parseInt(p);
    //     return !utils.isNumber(pn, cons.Role.ADMIN(), cons.Role.USER());
    // });
    // if (ret) {
    //     return utils.responseError(res, cons.ResultCode.ADMIN_PERMISSION_ERROR());
    // }

    db.call('proc_admin_permission_commit', [id, name, icon, path, menu, type, permissions], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let error = result[0][0].error;
        if (error) {
            utils.response(res, cons.ResultCode.ADMIN_PERMISSION_COMMIT_ERROR(), error);
            return;
        }

        let childPermission = null;
        let permission = _.find(data.permission.menus, (menu) => {
            if (menu.id == id) return true;
            if (_.has(menu, 'children') && menu.children.length > 0) {
                childPermission = _.find(menu.children, (child) => {
                    return child.id == id;
                });
                return childPermission !== undefined
            }
            return false;
        });

        if (childPermission !== undefined) {
            permission = childPermission;
        }

        if (permission !== undefined && permission !== null) {
            permission.name = name;
            permission.icon = icon;
            permission.path = path;
            permission.menu = menu;
            permission.type = type;
            permission.permissions = ps;
        }

        utils.responseOK(res);
    });
});

/** 
 * @api {post} admin/permission/del 删除权限
 * @class admin
 * @param {number} id 权限ID（要删除的权限ID）
 */
router.post('/permission/del', (req, res) => {
    let id = req.body.id;

    if (!utils.isNumber(id)) {
        utils.responseError(res);
        return;
    }

    db.delete('admin_permission', { id: id }, (err) => {
        if (err) {
            utils.response(res, cons.ResultCode.ADMIN_PERMISSION_DELETE_ERROR());
            return;
        }
        _.find(data.permission.menus, (v, k) => {
            _.isMatch(v, { id: id }) ? data.permission.menus.splice(k, 1) : false;
            if (_.has(v, 'children') && v.children.length > 0) {
                _.find(v.children, (n, m) => {
                    _.isMatch(n, { id: id }) ? v.children.splice(m, 1) : false;
                })
            }
        });
        return utils.responseOK(res);
    });
});

/**
 * @api {get} admin/role                获取角色列表
 * @class admin
 * @param {number} pindex            分页索引
 * @param {number} psize             分页大小
 * @return (分页)
 * [{
 *  "id": ID
 *  "roleId": 角色ID
 *  "name": 帐号状态 0-正常 11-锁定
 *  "create_time": 创建时间
 * }]
 * @return (列表)
 * [{
 *  "roleId": 角色ID
 *  "name": 帐号状态 0-正常 11-锁定
 * }]
 */
router.get('/role', (req, res) => {
    let { pindex = 0, psize = 0 } = req.query;
    pindex = parseInt(pindex);
    psize = parseInt(psize);
    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    let sql = 'proc_admin_role_details';
    if (req.admin && req.admin.isSuperAdmin()) {
        sql += '_admin';
    }
    db.call(sql, [pindex, psize], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let data = result[0];
        let total = result[1][0].total;
        utils.responseOK(res, { data, total });
    });
});


/**
 * @api {post} admin/role/add   添加角色
 * @class admin
 * @param {number} roleId    角色Id
 * @param {string} name      角色名称
 */
router.post('/role/add', (req, res) => {
    let { roleId, name } = req.body;
    if (!utils.isNumber(roleId) ||
        !utils.isString(name)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_admin_role_add', [roleId, name], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let error = result[0][0].error;
        if (error) {
            utils.response(res, cons.ResultCode.ADMIN_PERMISSION_CREATE_ERROR(), error);
            return;
        }
        utils.responseOK(res);
    });
});

/**
 * @api {post} admin/role/update   角色修改
 * @class admin
 * @param {id} arId      数据Id
 * @param {number} roleId    角色Id
 * @param {string} name      角色名称
 */
router.post('/role/update', (req, res) => {
    let { arId, roleId, name } = req.body;
    if (!utils.isId(arId) ||
        !utils.isNumber(roleId) ||
        !utils.isString(name)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_admin_role_update', [arId, roleId, name], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let error = result[0][0].error;
        if (error) {
            utils.response(res, cons.ResultCode.ADMIN_PERMISSION_CREATE_ERROR(), error);
            return;
        }
        utils.responseOK(res);
    });
});

/** 
 * @api {post} admin/role/del 删除角色
 * @class admin
 * @param {id} arId 角色数据ID（要删除的角色数据ID）
 */
router.post('/role/del', (req, res) => {
    let arId = req.body.arId;

    if (!utils.isId(arId)) {
        utils.responseError(res);
        return;
    }

    db.delete('admin_role', { id: arId }, (err) => {
        if (err) {
            utils.response(res, cons.ResultCode.ADMIN_PERMISSION_DELETE_ERROR());
            return;
        }
        return utils.responseOK(res);
    });
});


/**
 * @api {post} admin/agent/register 代理注册
 * @class admin
 * @param {string} account 账号 - 手机号码
 * @param {string} address 通讯地址
 * @param {string} bankAccount 银行账号
 * @param {string} bankBranch 银行分行
 * @param {string} bankCode 银行代码
 * @param {string} idcard 身份证
 * @param {string} idcardAddress 户籍地址
 * @param {string} line line
 * @param {string} nick 昵称
 * @param {string} password 密码
 * @param {id} userId 玩家id
 */
router.post('/agent/register', (req, res) => {
    let { account, address, bankAccount, bankBranch, bankCode, idcard, idcardAddress, line, nick, password, userId } = req.body;
    let level = 2;
    let name = nick;
    let type = cons.Agent.AGENT_APPLYING();

    if (!utils.isString(account, 1) ||
        !utils.isString(idcard, 1) ||
        !utils.isString(line, 1) ||
        !utils.isString(nick, 1) ||
        !utils.isString(password, 1) ||
        !utils.isNumber(userId, 1)) {
        utils.responseError(res);
        return;
    }

    db.find('user', { id: userId }, (err, data) => {
        if (err || !data) {
            utils.response(res, cons.ResultCode.UNKNOWN_USER());
            return;
        }

        let user = userManager.getUserById(userId);
        let recommender = user ? user.getAttr('agentId') : null;
        if (!user || !recommender) {
            utils.response(res, cons.ResultCode.UNBIND_USER());
            return;
        }

        if (agentManager.getAgentByAccount(account)) {
            utils.response(res, cons.ResultCode.USED_PHONE());
            return;
        }

        if (agentManager.getAgentByIdcard(idcard)) {
            utils.response(res, cons.ResultCode.USED_IDCARD());
            return;
        }

        if (agentManager.getAgentByLine(line)) {
            utils.response(res, cons.ResultCode.USED_LINE());
            return;
        }

        if (agentManager.getAgentByUserId(userId)) {
            utils.response(res, cons.ResultCode.USED_USER_ID());
            return;
        }

        let attrs = { account, address, bankAccount, bankBranch, bankCode, idcard, idcardAddress, line, level, nick, name, password, recommender, timestamp: utils.date.timestamp(), type, userId };
        agentManager.createAgent(attrs);
        utils.responseOK(res);
    });
});


/**
 * @api {post} admin/agent/level 代理等级设置
 * @class admin
 * @param {id} agentId 代理id
 * @param {number} level 金(0) 银(1) 授权(2)
 */
router.post('/agent/level', (req, res) => {
    let agentId = req.body.agentId;
    let level = req.body.level;

    if (!utils.isId(agentId, 1) ||
        !utils.isNumber(level, 1, 3)) {
        utils.responseError(res);
        return;
    }

    let agent = agentManager.getAgentById(agentId);
    if (!agent) {
        utils.response(res, cons.ResultCode.UNKNOWN_AGENT());
        return;
    }

    agent.setAttr('level', level);
    utils.responseOK(res);
});


/**
 * @api {post} admin/charge/agent 给代理充值
 * @class admin
 * @param {id} id 代理id
 * @param {enum} itemId 物品id => 物品类型
 * @param {number} count 物品数量 => 正+ 负-
 * @apiSuccessExample 返回
 * {
 *  "diamond": 10, 修改后的钻石数
 *  "bindDiamond": 10, 修改后的绑定钻石数
 * }
 */
router.post('/charge/agent', (req, res) => {
    let id = req.body.id;
    let itemId = req.body.itemId;
    let count = req.body.count;
    let memo = req.body.memo;

    let agent = agentManager.getAgentById(id);
    if (!agent ||
        !utils.isNumber(itemId, cons.Item.DIAMOND(), cons.Item.BIND_DIAMOND()) ||
        !utils.isNumber(count) ||
        count === 0) {
        utils.responseError(res);
        return;
    }

    // if(count < 0 && !agent.haveEnoughDiamond(itemId, -count)) {
    //     utils.response(res, cons.ResultCode.NOT_ENOUGH_DIAMOND());
    //     return;
    // }

    agent.changeDiamond(itemId, count, cons.AgentDiamondChangeReason.ADMIN(), req.agent.getId() + '', memo);
    utils.responseOK(res, agent.toJson_Diamond());
});


/**
 * @api {post} admin/charge/user 给玩家充值
 * @class admin
 * @param {id} id 玩家id
 * @param {enum} itemId 物品id => 物品类型
 * @param {number} count 物品数量 => 正+ 负-
 * @apiSuccessExample 返回
 * {
 *  "diamond": 10, 修改后的钻石数
 *  "bindDiamond": 10, 修改后的绑定钻石数
 * }
 */
router.post('/charge/user', async (req, res) => {
    if (!req.admin) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }

    let { id, account, itemId, count, reason, memo } = req.body;

    id = parseInt(id) || null;
    if ((id && !utils.isId(id)) ||
        (account && !utils.isString(account, 6)) ||
        !utils.isId(itemId) ||
        !utils.isNumber(reason) ||
        !utils.isNumber(count)) {
        return utils.responseError(res);
    }

    let user = null;
    if (id) {
        user = await userManager.loadUserById(id);
    }

    if (!user && account) {
        user = await userManager.loadUserByAccount(account);
    }

    if (!user) {
        return utils.response(res, cons.ResultCode.UNKNOWN_USER());
    }

    if (req.admin.isAgent()) {
        if (user.getAttr('agentId') != req.admin.getId()) {
            return utils.response(res, cons.ResultCode.UNKNOWN_USER());
        }

        let item = await model.Item.findOne({ where: { userId: req.admin.getId(), itemId } });
        if (!item || item.count < count) {
            return utils.response(res, cons.ResultCode.NOT_ENOUGH_DIAMOND());
        }

        let ret = await saop.item.changeItem2(req.admin.getId(), itemId, -count, { from: req.admin.getId(), reason, memo });
        if (ret.code != cons.ResultCode.OK().code) {
            return utils.responseError(res, ret.msg);
        }
    }

    let p = saop.item.changeItem(user.getId(), itemId, count, { from: req.admin.getId(), reason, memo });
    utils.responseProm(res, p);

    let params = {};
    params.userId = req.admin.getId();
    params.module = '玩家充值';
    params.desc = '给玩家' + id + (count < 0 ? '扣钱:' : '加钱:') + count + ',' + memo;
    params.opname = '后台' + (count < 0 ? '扣钱' : '加钱');
    adminlog.external(req, params);
    params.ext1 = count;
    params.ext2 = id;
    params.ext3 = itemId;
    params.columns = [];
    adminlog.logadmin(params);
});


router.post('/charge/order/commit', (req, res) => {
    let no = req.body.no;
    let commit = req.body.commit;

    if (!utils.isString(no, 1) ||
        !utils.isNumber(commit, 1, 2)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_agent_charge_commit', [no, commit], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let error = result[0][0].error;
        if (error) {
            utils.response(res, cons.ResultCode.AGENT_CHARGE_ERROR(), error);
            return;
        }

        if (commit !== 1) {
            utils.responseOK(res);
            return;
        }

        let agentId = result[0][0].agentId;
        let agent = agentManager.getAgentById(agentId);
        if (!agent) {
            utils.responseOK(res);
            return;
        }

        let diamond = result[0][0].diamond;
        let bindDiamond = result[0][0].bindDiamond;
        agent.changeDiamond(cons.Item.DIAMOND(), diamond, cons.AgentDiamondChangeReason.CHARGE(), no);
        agent.changeDiamond(cons.Item.BIND_DIAMOND(), bindDiamond, cons.AgentDiamondChangeReason.CHARGE(), no);
        utils.responseOK(res);
    });
});


router.post('/charge/order/details', (req, res) => {
    let pindex = parseInt(req.body.page);
    let psize = parseInt(req.body.skip);
    let search = req.body.condition || null;
    let state = parseInt(req.body.state);

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 5) ||
        !utils.isNumber(state, -1, 2)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_admin_charge_details', [pindex, psize, search, state], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let data = result[0];
        let total = result[1][0].total;
        utils.responseOK(res, { data, total });
    });
});


router.get('/charge/package', (req, res) => {
    utils.responseOK(res, data.chargePackage);
});


/**
 * @api {post} admin/charge/package 修改套餐信息
 * @class admin
 * @param {number} level 套餐等级
 * @param {json} package 套餐数据
 */
router.post('/charge/package', (req, res) => {
    if (!_.has(data.chargePackage, req.body.level)) {
        utils.responseError(res);
        return;
    }

    if (!utils.isArray(req.body.package, 5, 5)) {
        utils.responseError(res);
        return;
    }

    let error = _.some(req.body.package, (d) => {
        if (!utils.isObject(d, 'money', 'diamond', 'bindDiamond')) {
            return true;
        }

        return (!utils.isNumber(d.money, 0, 10000) ||
            !utils.isNumber(d.diamond, 0, 10000) ||
            !utils.isNumber(d.bindDiamond, 0, 10000));
    });

    if (error) {
        utils.responseError(res);
        return;
    }

    data.chargePackage[req.body.level] = _.map(req.body.package, (d) => _.pick(d, ['money', 'diamond', 'bindDiamond']));
    fs.writeFile('./app/data/chargePackage.json', JSON.stringify(data.chargePackage), (err) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        utils.responseOK(res, data.chargePackage);
    });
});


/**
 * @api {post} admin/roundabout/commit 大转盘兑换
 * @class admin
 * @param {id} id id
 */
router.post('/roundabout/commit', (req, res) => {
    let id = req.body.id;

    if (!utils.isId(id)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_admin_roundabout_commit', [id], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let { error } = result[0];
        if (error) {
            utils.responseError(res, error);
            return;
        }

        utils.responseOK(res);
    });
});


/**
 * @api {post} admin/roundabout/details 大转盘抽奖列表
 * @class admin
 * @param {number} type 免费版(1) 钻石版(2)
 * @param {number} page 分页索引
 * @param {number} skip 分页大小
 */
router.post('/roundabout/details', (req, res) => {
    let type = req.body.type;
    let state = req.body.state;
    let pindex = req.body.page;
    let psize = req.body.skip;
    let search = req.body.search;

    if (!utils.isNumber(type) ||
        !utils.isNumber(state) ||
        !utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 5)) {
        utils.responseError(res);
        return;
    }

    if (search && !utils.isString(search)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_admin_roundabout_details', [type, state, search, pindex, psize], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let data = result[0];
        let total = result[1][0].total;
        utils.responseOK(res, { data, total });
    });
});


/**
 * @api {post} admin/survey/agent/charge 代理概况-充值列表
 * @class admin
 * @param {id} agentId 代理id
 * @param {number} page 分页索引
 * @param {number} skip 分页大小
 * @apiSuccessExample 返回
 * [{
 *  "money": 1, 充值金额
 *  "diamond": 1, 充值房卡数
 *  "bindDiamond": 1, 充值绑定房卡数
 *  "timestamp": "2018-1-1 00:00:00", 时间戳
 * }]
 */
router.post('/survey/agent/charge', (req, res) => {
    let agentId = req.body.agentId;
    let pindex = parseInt(req.body.page);
    let psize = parseInt(req.body.skip);

    if (!utils.isId(agentId) ||
        !utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 5)) {
        utils.responseError(res);
        return;
    }

    let agent = agentManager.getAgentById(agentId);
    if (!agent) {
        utils.response(res, cons.ResultCode.UNKNOWN_AGENT());
        return;
    }

    db.call('proc_agent_charge_details', [agentId, null, null, pindex, psize], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let data = result[0];
        let total = result[1][0].total;
        utils.responseOK(res, { data, total });
    });
});

/**
 * @api {post} admin/survey/agent/sell 代理概况-销售列表
 * @class admin
 * @param {id} agentId 代理id
 * @param {number} page 分页索引
 * @param {number} skip 分页大小
 * @apiSuccessExample 返回
 * [{
 *  "userId": 1, 充值金额
 *  "itemId": 2, 物品id
 *  "count": 1, 数量
 *  "timestamp": "2018-1-1 00:00:00", 时间戳
 * }]
 */
router.post('/survey/agent/sell', (req, res) => {
    let agentId = req.body.agentId;
    let pindex = parseInt(req.body.page);
    let psize = parseInt(req.body.skip);

    if (!utils.isId(agentId) ||
        !utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 5)) {
        utils.responseError(res);
        return;
    }

    let agent = agentManager.getAgentById(agentId);
    if (!agent) {
        utils.response(res, cons.ResultCode.UNKNOWN_AGENT());
        return;
    }

    db.call('proc_agent_sell_details', [agentId, null, null, pindex, psize], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let data = result[0];
        let total = result[1][0].total;
        utils.responseOK(res, { data, total });
    });
});


/**
 * @api {post} admin/survey/agent/thumbnail 代理概况-简要信息
 * @class admin
 * @param {id} agentId 代理id
 * @apiSuccessExample 返回
 * {
 *  "money": 1, 总充值金额
 *  "diamond": 1, 总充值房卡数
 *  "bindDiamond": 1, 总充值绑定房卡数
 * }
 */
router.post('/survey/agent/thumbnail', (req, res) => {
    let agentId = req.body.agentId;

    if (!utils.isId(agentId)) {
        utils.responseError(res);
        return;
    }

    let agent = agentManager.getAgentById(agentId);
    if (!agent) {
        utils.response(res, cons.ResultCode.UNKNOWN_AGENT());
        return;
    }

    db.call('proc_agent_charge_sum', [agentId, null, null], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        utils.responseOK(res, result[0]);
    });
});


/**
 * @api {post} admin/survey/user/historys 用户概况-战绩列表
 * @class admin
 * @param {id} userId 玩家Id
 * @param {number} page 分页索引
 * @param {number} skip 分页大小
 * @apiSuccessExample 返回
 * [{
 *  "roomId": "123456", 房间id
 *  "rounds": 10, 局数
 *  "diamond": -1, 消耗钻石
 *  "timestamp": "2018-1-1 00:00:00", 时间戳
 * }]
 */
router.post('/survey/user/historys', (req, res) => {
    let userId = req.body.userId;
    let pindex = parseInt(req.body.page);
    let psize = parseInt(req.body.skip);

    if (!utils.isId(userId) ||
        !utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 5)) {
        utils.responseError(res);
        return;
    }

    db.find('user', { id: userId }, (err, data) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        if (!data) {
            utils.response(res, cons.ResultCode.UNKNOWN_USER());
            return;
        }

        db.call('proc_user_survey_historys', [userId, pindex, psize], true, (err, result) => {
            if (err) {
                utils.responseError(res);
                return;
            }

            let data = result[0];
            let total = result[1][0].total;
            data = _.map(data, (d) => {
                let r = _.pick(d, ['timestamp', 'roomId', 'rounds']);
                let b = JSON.parse(utils.string.filterEnter(d.balance));
                b = _.find(b, (c) => c.id === userId);
                r.diamond = b ? -b.diamond : 0;
                return r;
            });
            utils.responseOK(res, { data, total });
        });
    });
});


/**
 * @api {post} admin/survey/user/thumbnail 用户概况-简要信息
 * @class admin
 * @param {id} userId 玩家id
 * @apiSuccessExample 返回
 * {
 *  "chargeDiamond": 1, 总充值房卡数
 *  "chargeBindDiamond": 1, 总充值绑定房卡数
 *  "diamond": 1, 剩余房卡数
 *  "bindDiamond": 1, 剩余绑定房卡数
 * }
 */
router.post('/survey/user/thumbnail', (req, res) => {
    let userId = req.body.userId;

    if (!utils.isId(userId)) {
        utils.responseError(res);
        return;
    }

    db.find('user', { id: userId }, (err, data) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        if (!data) {
            utils.response(res, cons.ResultCode.UNKNOWN_USER());
            return;
        }

        db.call('proc_user_survey_thumbnail', [userId], true, (err, result) => {
            if (err) {
                utils.responseError(res);
                return;
            }

            utils.responseOK(res, result[0]);
        });
    });
});

/**
 * @api {get} admin/user/find 按照id 或者 账号查询代理信息，优先ID
 * @class user
 * @param {id} id 玩家id
 * @param {string} account 账号
 * @apiSuccessExample 返回
 * {
 *  "account": "1", 账号
 *  "gold": 1, 剩余金币数
 *  "diamond": 1, 剩余钻石数
 *  "bindDiamond": 1, 剩余绑定钻石数
 *  "id": 1, id
 *  "nick": "1", 昵称
 * }
 */
router.get('/user/find', async (req, res) => {
    if (!req.admin) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }

    let { id, account } = req.query;
    id = parseInt(id) || null;
    account = account || null;

    if ((!id || !utils.isId(id)) && (!account || !utils.isString(account, 1))) {
        return utils.responseError(res, '参数错误');
    }

    if (req.admin && req.admin.isAgent()) {
        let user = await model.User.findById(id);
        if (!user || (user.agentId != req.admin.getId())) {
            return utils.response(res, cons.ResultCode.UNKNOWN_USER());
        }
    }

    db.call('proc_user_find', [id, account], true, (err, result) => {
        if (err) {
            return utils.responseError(res);
        }
        utils.responseOK(res, result[0][0] || null);
    });
});

/**
 * @api {post} admin/user/bind/agent 玩家绑定代理
 * @class user
 * @param {number} agentId 代理id
 * @param {number} userId 玩家id
 */
router.post('/user/bind/agent', (req, res) => {
    let agentId = req.body.agentId;
    let userId = req.body.userId;

    if (!utils.isId(userId)) {
        utils.responseError(res);
        return;
    }

    let agent = agentManager.getAgentById(agentId);
    if (agentId && !agent) {
        utils.response(res, cons.ResultCode.UNKNOWN_AGENT());
        return;
    }

    db.find('user', { id: userId }, (err, data) => {
        if (!data) {
            utils.response(res, cons.ResultCode.UNKNOWN_USER());
            return;
        }

        agentId = agent ? agent.getId() : null;
        let agentNick = agent ? agent.getAttr('nick') : null;
        userManager.bindAgent(userId, agent ? agent.getId() : null);
        sao.user.bindAgent(userId, agentId, agentNick, { 2: 0 });
        utils.responseOK(res);
    });
});

/**
 * @api {post} admin/user/bank/list 玩家银行卡
 */
router.post('/user/bank/list', (req, res) => {
    let { userId } = req.body;

    if (!utils.isId(userId)) {
        return utils.responseError(res);
    }

    db.call('proc_user_bank_details', [userId], true, (err, data) => {
        if (err) {
            utils.responseBDError(res);
            return;
        }

        utils.responseOK(res, data[0]);
    });
});

/**
 * @api {post} admin/user/details 玩家列表
 * @class admin
 * @param {number} page 分页索引
 * @param {number} skip 分页大小
 */
router.post('/user/details', (req, res) => {
    let level = req.body.level;
    let type = req.body.type;
    let models = req.body.models;
    let pindex = req.body.page;
    let psize = req.body.skip;
    let search = req.body.search || null;
    let startTime = req.body.startTime;
    let endTime = req.body.endTime;
    let userId = req.body.userId || null;
    let minMoney = parseInt(req.body.minMoney);
    let maxMoney = parseInt(req.body.maxMoney);
    let sort = parseInt(req.body.sort);
    let ip = req.body.ip;

    if ((pindex && !utils.isNumber(pindex, 0)) ||
        (psize && !utils.isNumber(psize, 5)) ||
        (search && !utils.isString(search)) ||
        (ip && !utils.isString(ip)) ||
        (userId && !utils.isString(userId, 1) && !utils.isNumber(userId, 1)) ||
        (level && !utils.isNumber(level, 0)) ||
        (type && !utils.isNumber(type, 0)) ||
        (startTime && !utils.isDate(startTime)) ||
        (endTime && !utils.isDate(endTime))) {
        return utils.responseError(res);
    }

    if (utils.isString(models, 1)) {
        models = models.split(',');
    }

    minMoney = utils.isNumber(minMoney) ? minMoney : null;
    maxMoney = utils.isNumber(maxMoney) ? maxMoney : null;
    sort = utils.isNumber(sort) ? sort : 0;

    permission.isAgent(userId, (isAgent) => {
        endTime = endTime ? endTime : null;
        userId = isAgent ? userId : null;

        let offline = null;
        let online = null;
        let bank = null;

        if (models && models.length > 0)
            _.each(models, (m) => {
                switch (m) {
                    case "1":
                        offline = 1;
                        break;
                    case "2":
                        online = 1;
                        break;
                    case "3":
                        bank = 1;
                        break;
                }
            });

        db.call('proc_admin_user_details_new3', [startTime, endTime, offline, online, level, type, bank, pindex, psize, search, userId, minMoney, maxMoney, ip, sort], true, (err, result) => {
            if (err) {
                utils.responseError(res);
                return;
            }

            var qqwry = libqqwry.init(); //初始化IP库解析器
            qqwry.speed(); //启用急速模式 比不开启效率率快非常多 但多占10M左右内存;

            let data = result[0];
            _.each(data, (row) => {
                try {
                    if (row.ip) {
                        var ip = qqwry.searchIP(utils.ip(row.ip)); //查询IP信息
                        row.ip = row.ip + '(' + ip.Country + ip.Area + ')';
                        row.ip = row.ip.replace(/ CZ88.NET/g, "");
                    }
                } catch (e) {
                    console.log(e);
                }
            });

            // return utils.responseOK(res, { data });

            if (!pindex && !psize) {
                return utils.responseOK(res, { data });
            }

            let total = result[1][0].total;
            // utils.responseOK(res, { data, total });

            let count = result[1][0].wallet;
            let tzze = result[1][0].cost;
            let zjze = result[1][0].score;
            let csze = result[1][0].fee;
            let czze = result[1][0].pay;
            let txze = result[1][0].withdraw;
            let yk = tzze - zjze;
            // let info = result[5];

            // /*let total = result[1][0].total;
            // let tzze = result[2][0].cost;
            // let zjze = result[2][0].score;
            // let csze = result[2][0].fee;
            // let czze = result[3][0].pay;
            // let txze = result[4][0].withdraw;
            // let count = parseInt(result[5][0].wallet) + parseInt(result[5][0].bank);
            // let yk = tzze - zjze;
            // let info = result[5];*/

            utils.responseOK(res, { data, total, count, tzze, czze, txze, csze, yk, zjze });
        });
    }, res);
});

router.post('/user/stat_pay_win', (req, res) => {
    let startTime = null;
    let endTime = null;
    db.call('proc_user_stat_pay_win', [startTime, endTime], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let r = result[0][0];
        let userId = r ? r.userId : '';
        let money = r ? r.money : '';
        let rwin = result[1][0];
        let userIdWin = rwin ? rwin.userId : '';
        let win = rwin ? rwin.win : '';
        utils.responseOK(res, { "pay": { userId, money }, "win": { userIdWin, win } });
    });
});

/**
 * @api {post} admin/user/details/addup 玩家列表统计
 * @class admin
 * @param {number} page 分页索引
 * @param {number} skip 分页大小
 */
router.post('/user/details/addup', (req, res) => {
    let level = req.body.level;
    let type = req.body.type;
    let models = req.body.models;
    let pindex = req.body.page;
    let psize = req.body.skip;
    let search = req.body.search || null;
    let startTime = req.body.startTime;
    let endTime = req.body.endTime;
    let userId = req.body.userId || null;
    let minMoney = parseInt(req.body.minMoney);
    let maxMoney = parseInt(req.body.maxMoney);
    let sort = parseInt(req.body.sort);
    let ip = req.body.ip;

    if ((pindex && !utils.isNumber(pindex, 0)) ||
        (psize && !utils.isNumber(psize, 5)) ||
        (search && !utils.isString(search)) ||
        (ip && !utils.isString(ip)) ||
        (userId && !utils.isString(userId, 1) && !utils.isNumber(userId, 1)) ||
        (level && !utils.isNumber(level, 0)) ||
        (type && !utils.isNumber(type, 0)) ||
        (startTime && !utils.isDate(startTime)) ||
        (endTime && !utils.isDate(endTime))) {
        return utils.responseError(res);
    }

    if (utils.isString(models, 1)) {
        models = models.split(',');
    }

    minMoney = utils.isNumber(minMoney) ? minMoney : null;
    maxMoney = utils.isNumber(maxMoney) ? maxMoney : null;
    sort = utils.isNumber(sort) ? sort : 0;

    permission.isAgent(userId, (isAgent) => {
        endTime = endTime ? endTime : null;
        userId = isAgent ? userId : null;

        let offline = null;
        let online = null;
        let bank = null;

        if (models && models.length > 0)
            _.each(models, (m) => {
                switch (m) {
                    case "1":
                        offline = 1;
                        break;
                    case "2":
                        online = 1;
                        break;
                    case "3":
                        bank = 1;
                        break;
                }
            });

        db.call('proc_admin_user_details_statistics', [startTime, endTime, offline, online, level, type, bank, pindex, psize, search, userId, minMoney, maxMoney, ip, sort], true, (err, result) => {
            if (err) {
                utils.responseError(res);
                return;
            }

            let r = result[0][0];
            // let total = r.total;
            let count = parseInt(r.wallet) + parseInt(r.bank);
            let tzze = r.cost;
            let zjze = r.score;
            let csze = r.fee;
            let czze = r.pay;
            let txze = r.withdraw;
            let yk = tzze - zjze;
            let info = result[5];
            utils.responseOK(res, { count, info, tzze, czze, txze, csze, yk, zjze });
        });
    }, res);
});


/**
 * @api {post} admin/user/suspend/commit 玩家封禁操作
 * @class admin
 * @param {number} commit 解除(0) 删除(1) 冻结(11) 黑名单（12）
 * @param {string} desp 描述
 * @param {number} userId 玩家id
 */
router.post('/user/suspend/commit', (req, res) => {
    let commit = req.body.commit;
    let desp = req.body.desp;
    let userId = req.body.userId;

    if (!utils.isNumber(commit, 0) ||
        !utils.isString(desp, 0, 100) ||
        !utils.isId(userId)) {
        utils.responseError(res);
        return;
    }

    server.post('user/' + (commit === 0 ? 'unsuspend' : 'suspend'), { userId, state: commit }, (result) => {
        if (!utils.isOK(result)) {
            utils.response(res, result);
            return;
        }

        db.insert('user_suspend_record', {
            agentId: req.admin ? req.admin.getId() : 0,
            desp,
            type: commit,
            userId: userId,
            timestamp: utils.date.timestamp()
        });

        // userManager.loadUserById(userId).then((user) => {
        //     user.setAttr('state', ((commit === 1) ? 11 : 0));
        // });

        utils.responseOK(res);
    });
});

/**
 * @api {post} admin/user/suspend/details 玩家冻结列表
 * @class admin
 * @param {id} userId 玩家ID null-全部
 * @param {number} type 冻结状态 null-全部 0-解冻 1-冻结
 * @param {number} pindex 分页索引
 * @param {number} psize 分页大小
 * @apiSuccessExample 返回
 * [{
 *      agentAccount: '1', 操作人账号
 *      agentId: 1, 操作人id
 *      agentNick: '1', 操作人昵称
 *      userAccount: '1', 玩家账号
 *      userId: 1, 玩家id
 *      userNick: '1', 玩家昵称
 *      desp: '1', 描述
 *      timestamp: '2018-1-1 0:0:0', 操作时间
 *      type: 0, 冻结状态
 * }]
 */
router.post('/user/suspend/details', (req, res) => {
    let pindex = req.body.pindex;
    let psize = req.body.psize;
    let userId = req.body.userId;
    let type = req.body.type;

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 5)) {
        utils.responseError(res);
        return;
    }

    type = utils.isNumber(type, 0, 1) ? type : null;
    userId = utils.isId(userId, 1) ? userId : null;

    db.call('proc_user_suspend_details', [pindex, psize, type, userId], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let data = result[0];
        let total = result[1][0].total;
        utils.responseOK(res, { data, total });
    });
});


/**
 * @api {post} admin/user/password/commit 重置玩家密码
 * @class admin
 * @param {number} userId 玩家id
 * @param {string} password 新密码
 */
router.post('/user/password/commit', async (req, res) => {
    let admin = userManager.getUserBySession(req.sessionID);
    if (!admin) {
        return utils.response(res, { code: 402, msg: '登录失效！' });
    }

    let userId = req.body.userId;
    let password = req.body.password;
    let password2 = req.body.password2;

    if ((userId && !utils.isId(userId))
        || (password && !utils.isString(password, 1, 32))
        || (password2 && !utils.isString(password2, 1, 32))) {
        return utils.responseError(res);
    }

    if (!password && !password2) {
        return utils.response(res, { code: 400, msg: '登录密码和银行密码不能同时为空' });
    }

    if (!userId) {
        userId = admin.getId();
    }

    let user = await userManager.loadUserById(userId);
    if (!user) {
        utils.response(res, { code: 402, msg: '未知用户' });
        return;
    }

    if (password) {
        user.setAttr('password', utility.md5(password).toUpperCase());
    }

    if (password2) {
        user.setAttr('password2', utility.md5(password2).toUpperCase());
    }

    sao.user.resetpwd(user.getAttr('account'), password, password2, (result) => {
        if (!utils.crOK(result)) {
            utils.response(res, result);
            return;
        }

        // if (password) {
        //     pword = utility.md5(password).toUpperCase();
        //     db.update('user', { id: userId }, { password: pword }, (err) => {
        //         if (err) {
        //             console.error(err);
        //         }
        //     });
        // }

        // if (password2) {
        //     pword2 = utility.md5(password2).toUpperCase();
        //     db.update('user', { id: userId }, { password2: pword2 }, (err) => {
        //         if (err) {
        //             console.error(err);
        //         }
        //     });
        // }

        let params = {};
        params.userId = admin.getId();
        params.module = '重置密码';
        params.desc = admin.getId() + '重置玩家' + userId + '的密码,成功';
        params.opname = '重置密码';
        adminlog.external(req, params);
        params.ext1 = userId;
        params.ext2 = password;
        params.ext3 = password2;
        params.columns = [];
        adminlog.logadmin(params);
        utils.responseOK(res, result);
    });
});

/**
 * @api {post} admin/user/level/change 修改玩家分类
 */
router.post('/user/level/change', (req, res) => {
    let userId = req.body.userId;
    let level = req.body.level;
    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    if (!utils.isId(userId) ||
        !utils.isNumber(level, 0)) {
        return utils.responseError(res);
    }

    db.update('user', { id: userId }, { level }, (err) => {
        if (err) {
            console.error(err);
            return utils.responseBDError(res);
        }

        let params = {};
        params.userId = operateid;
        params.module = '玩家列表';
        params.desc = operateid + '给玩家' + userId + '修改分类：' + level + ',成功';
        params.opname = '修改分类';
        adminlog.external(req, params);
        params.ext1 = userId;
        params.ext2 = level;
        params.ext3 = null;
        params.columns = [];
        adminlog.logadmin(params);
        return utils.responseOK(res);
    });
});

/**
 * @api {post} admin/user/edit 修改玩家信息
 */
router.post('/user/edit', (req, res) => {
    let userId = req.body.userId;
    let agentId = req.body.agentId;
    let password = req.body.password;
    let password2 = req.body.password2;
    let state = req.body.state;
    let name = req.body.name;
    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    /*if (!utils.isId(userId) || !utils.isNumber(state) ||
        !utils.isString(name, 1) ||
        !utils.isString(bankId, 1)) {
        return utils.responseError(res);
        }*/
    let parms = {};
    if (utils.isString(agentId, 1)) {
        parms.agentId = agentId;
    }
    if (utils.isString(name, 1)) {
        parms.name = name;
    }
    if (utils.isNumber(state)) {
        parms.state = state;
    }

    db.update('user', { id: userId }, parms, (err) => {
        if (err) {
            console.log('err:');
            console.error(err);
            return utils.response(res, err);
        }

        if (state == 1 || state == 0) {
            sao.user.attr(userId, { state: state }, (result) => {
                if (!utils.crOK(result)) {
                    return;
                }
            });
        }

        let params = {};
        params.userId = operateid;
        params.module = '玩家列表';
        params.desc = operateid + '修改玩家' + userId + ' 修改姓名：' + name + ',成功';
        params.opname = '修改玩家';
        adminlog.external(req, params);
        params.ext1 = userId;
        params.ext2 = name;
        params.ext3 = null;
        params.columns = [];
        adminlog.logadmin(params);
        let r = false;

        utils.responseOK(res, "代理ID等修改成功");

        db.update('user_withdraw', { userId: userId, state: 0 }, { name: name }, (err) => {
        });

        db.find('user', { id: userId }, (err, data) => {
            if (err) {
                console.error(err);
                return utils.responseBDError(res);
            }

            if (name && name != '') {
                sao.user.resetname(userId, name, null, (result) => {
                    //utils.responseOK(res, "姓名等修改成功");
                    r = true;
                    //if (r1 && r2)
                    //    utils.response(res, result.code, result.msg);
                });
            }

            if (!data) {
                utils.response(res, cons.ResultCode.UNKNOWN_USER());
                return;
            }

            if (password || password2) {
                sao.user.resetpwd(data.account, password, password2, (result) => {
                    if (!utils.crOK(result)) {
                        //utils.response(res, result);
                        return;
                    }

                    if (password) {
                        pword = utility.md5(password).toUpperCase();
                        db.update('user', { id: userId }, { password: pword }, (err) => {
                            if (err) {
                                console.error(err);
                            }
                            r = true;
                            //utils.responseOK(res, "密码修改成功");
                        });
                    }

                    if (password2) {
                        pword2 = utility.md5(password2).toUpperCase();
                        db.update('user', { id: userId }, { password2: pword2 }, (err) => {
                            if (err) {
                                console.error(err);
                            }
                            r = true;
                            //utils.responseOK(res, "银行密码修改成功");
                        });
                    }

                    let params = {};
                    params.userId = operateid;
                    params.module = '重置密码';
                    params.desc = operateid + '重置玩家' + userId + '的密码,成功';
                    params.opname = '重置密码';
                    adminlog.external(req, params);
                    params.ext1 = userId;
                    params.ext2 = password;
                    params.ext3 = password2;
                    params.columns = [];
                    adminlog.logadmin(params);
                });
            }
        });

    });

    ///////////////////////////////////////////////////////////////////////////////////////
    //修改玩家密码
    /*db.find('user', { id: userId }, (err, data) => {
        if (err) {
            console.error(err);
            return utils.responseBDError(res);
        }

        if (!data) {
            return;
        }

        //修改玩家银行密码
        if (password2 && utils.isString(password2, 1, 30) ) {
            console.log('aaaaaaaaaaaaa');           
            sao.user.password2(data.account, password2, (result) => {
                console.log('bbbbbbbbbbbbbb');      
                if (!utils.crOK(result)) {
                    console.log('ccccccccccccccccccc');   
                    return;
                }

                console.log('dddddddddddddddddddddddd');   
                let params = {};
                params.userId = operateid;
                params.module = '重置密码';
                params.desc = operateid+'重置玩家'+userId+'的银行密码,成功';
                params.opname = '重置银行密码';
                adminlog.external(req, params);
                params.ext1 = userId;
                params.ext2 = null;
                params.ext3 = null;
                params.columns = [];
                adminlog.logadmin(params);
            });
        }

        if (password && utils.isString(password, 1, 30) ) {
            sao.user.password(data.account, password, (result) => {
                console.log('11111');   
                if (!utils.crOK(result)) {
                    console.log('22222');   
                    return;
                }

                console.log('3333333');   
                let params = {};
                params.userId = operateid;
                params.module = '重置密码';
                params.desc = operateid+'重置玩家'+userId+'的密码,成功';
                params.opname = '重置密码';
                adminlog.external(req, params);
                params.ext1 = userId;
                params.ext2 = null;
                params.ext3 = null;
                params.columns = [];
                adminlog.logadmin(params);
            });
        }   
    });*/
    ///////////////////////////////////////////////////////////////////////////////////////    
});

/**
 * @api {get} admin/user/game/details 玩家游戏列表
 * @class admin
 * @param {number} pindex 分页索引
 * @param {number} psize 分页大小
 */
router.get('/user/game/details', (req, res) => {
    let { pindex, psize, userId, game, area, from, to, agentId } = req.query;

    if (!utils.isNumber(parseInt(pindex), 0) ||
        !utils.isNumber(parseInt(psize), 0)) {
        utils.responseError(res);
        return;
    }

    userId = utils.isString(userId) ? userId : null;
    agentId = utils.isString(agentId) ? parseInt(agentId) : null;
    game = utils.isString(game, 1) ? game : null;
    area = utils.isString(area, 1) ? area : null;
    from = utils.isString(from, 1) ? from : null;
    to = utils.isString(to, 1) ? to : null;

    permission.isAgent(agentId, (isAgent) => {
        agentId = isAgent ? agentId : null;
        db.call('proc_user_game_details', [pindex, psize, userId, game, area, from, to, agentId], true, (err, result) => {
            if (err) {
                utils.responseError(res);
                return;
            }

            let data = result[0];
            let total = result[1][0].total;
            let allCost = result[1][0].allCost;
            let allScore = result[1][0].allScore;
            let allFee = result[1][0].allFee;
            utils.responseOK(res, { data, total, allCost, allScore, allFee });
        });
    }, res);
});

/**
 * @api {get} /admin/agent/details
 */
router.get('/agent/details', (req, res) => {
    let userId = (req.query.userId);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let from = req.query.fromStart;
    let to = req.query.toStart;
    let agentLevel = parseInt(req.query.agentLevel);

    from = utils.isString(from, 1) ? from : null;
    to = utils.isString(to, 1) ? to : null;
    agentLevel = utils.isNumber(agentLevel) ? (agentLevel == 0 ? null : agentLevel) : null;

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    userId = utils.isString(userId) ? userId : null;

    db.call('proc_agent_details', [userId, from, to, pindex, psize], true, (err, d) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let count = d[1][0].total;
        _.each(d[0], d => {
            //let [srate, srebate] = data.getRebate(d.sachieve + d.cachieve);
            //let [crate, crebate] = data.getRebate(d.cachieve);
            //d.rate = srate;
            //d.rebate = srebate - crebate;
            console.log(d);
        });
        utils.responseOK(res, { count, rows: d[0] });
    });
});


/**
 * 查询当前用户的下级代理
 * @api {get} /admin/agent/details
 */
router.get('/agent/detailssub', (req, res) => {
    //let userId = (req.query.userId);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let from = req.query.fromStart;
    let to = req.query.toStart;

    from = utils.isString(from, 1) ? from : null;
    to = utils.isString(to, 1) ? to : null;

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    //userId = utils.isString(userId) ? userId : null;

    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let userId = user.attrs.id;

    db.call('proc_agent_details_sub', [userId, from, to, pindex, psize], true, (err, d) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let count = d[1][0].total;
        _.each(d[0], d => {
            //let [srate, srebate] = data.getRebate(d.sachieve + d.cachieve);
            //let [crate, crebate] = data.getRebate(d.cachieve);
            //d.rate = srate;
            //d.rebate = srebate - crebate;
            console.log(d);
        });
        utils.responseOK(res, { count, rows: d[0] });
    });
});

/**
 * @api {get} admin/rebate/record 历史分红记录
 * @class admin
 * @param {number} userId    玩家id         全部 null
 * @param {string} fromStart 起始时间开始    全部 null
 * @param {string} fromEnd   起始时间结束    全部 null
 * @param {string} toStart   结束时间开始    全部 null
 * @param {string} toEnd     结束时间结束    全部 null
 * @param {number} pindex    分页索引
 * @param {number} psize     分页大小
 * @apiSuccess {json} 返回
 *  [{
 *      "userId": 111111,       玩家id
 *      "index": 1,             编号
 *      "from": '2018-05-01',   起始时间
 *      "to": '2018-05-07',     结束时间
 *      "children": 2,          直属数量
 *      "descendants": 3        下级数量
 *      "tachieve": 400,        总业绩
 *      "sachieve": 200,        自己业绩
 *      "cachieve": 200,        下级业绩
 *      "rate": 0.1,            分红比例
 *      "rebate": 100,           分红数
 *  }]
 */
router.get('/rebate/record', (req, res) => {
    let userId = req.query.userId;
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    userId = utils.isString(userId) ? userId : null;

    let fromStart = utils.isString(req.query.fromStart, 0, 30) ? (req.query.fromStart) : null;
    let fromEnd = utils.isString(req.query.fromEnd, 0, 30) ? (req.query.fromEnd) : null;
    let toStart = utils.isString(req.query.toStart, 0, 30) ? (req.query.toStart) : null;
    let toEnd = utils.isString(req.query.toEnd, 0, 30) ? (req.query.toEnd) : null;

    db.call('proc_user_rebate_self', [userId, pindex, psize, fromStart, fromEnd, toStart, toEnd], true, (err, data) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let count = data[1][0].total;
        utils.responseOK(res, { count, rows: data[0] });
    });
});


/**
 * @api {get} admin/achieve/record 当前结算业绩列表
 * @class admin
 * @param {number} userId            玩家id    全部 null
 * @param {number} recommenderId     推广人ID    全部 null
 * @param {number} pindex 分页索引
 * @param {number} psize 分页大小
 * @apiSuccess {json} 返回
 *  [{
 *      "id": 100001,       id
 *      "account": "123",   账号
 *      "nick": "123",      昵称
 *      "sachieve": 200,    自己业绩
 *      "cachieve": 200,    下级业绩
 *      "children": 2,      直属数量
 *      "descendants": 3,  下级数量
 *      "rate": 0.1         返利比例,
 *      "rebate": 1,        返利
 *  }]
 *  返利数 客户端计算
 */
router.get('/achieve/record', (req, res) => {
    let userId = parseInt(req.query.userId);
    let recommenderId = parseInt(req.query.recommenderId);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    userId = utils.isId(userId, 0) ? userId : null;
    recommenderId = utils.isId(recommenderId, 0) ? recommenderId : null;

    db.call('proc_user_achieve_children', [userId, pindex, psize, recommenderId], true, (err, d) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let count = d[1][0].total;
        _.each(d[0], d => {
            let [srate, srebate] = data.getRebate(d.sachieve + d.cachieve);
            let [crate, crebate] = data.getRebate(d.cachieve);
            d.rate = srate;
            d.rebate = srebate - crebate;
        });
        utils.responseOK(res, { count, rows: d[0] });
    });
});

/**
 * @api {get} admin/settlement/pay 代理的玩家充值明细
 * @class admin
 * @param {number} userId            代理id    全部 null
 * @param {number} pindex 分页索引
 * @param {number} psize 分页大小
 */
router.get('/settlement/pay', (req, res) => {
    let userId = parseInt(req.query.userId);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let includingself = parseInt(req.query.includingself);

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    userId = utils.isId(userId, 0) ? userId : null;

    db.call('proc_person_settlement_pay', [userId, includingself, pindex, psize], true, (err, d) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let count = d[1][0].total;
        _.each(d[0], d => {
            let [srate, srebate] = data.getRebate(d.sachieve + d.cachieve);
            let [crate, crebate] = data.getRebate(d.cachieve);
            d.rate = srate;
            d.rebate = srebate - crebate;
        });
        utils.responseOK(res, { count, rows: d[0] });
    });
});

/**
 * @api {get} admin/settlement/withdraw 代理的玩家体现明细
 * @class admin
 * @param {number} userId            代理id    全部 null
 * @param {number} pindex 分页索引
 * @param {number} psize 分页大小
 */
router.get('/settlement/withdraw', (req, res) => {
    let userId = parseInt(req.query.userId);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let includingself = parseInt(req.query.includingself);

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    userId = utils.isId(userId, 0) ? userId : null;

    db.call('proc_person_settlement_withdraw', [userId, includingself, pindex, psize], true, (err, d) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let count = d[1][0].total;
        _.each(d[0], d => {
            let [srate, srebate] = data.getRebate(d.sachieve + d.cachieve);
            let [crate, crebate] = data.getRebate(d.cachieve);
            d.rate = srate;
            d.rebate = srebate - crebate;
        });
        utils.responseOK(res, { count, rows: d[0] });
    });
});


/**
 * @api {get} admin/settlement/items 代理的玩家盈亏明细
 * @class admin
 * @param {number} userId            代理id    全部 null
 * @param {number} pindex 分页索引
 * @param {number} psize 分页大小
 */
router.get('/settlement/items', (req, res) => {
    let userId = parseInt(req.query.userId);
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let includingself = parseInt(req.query.includingself);

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    userId = utils.isId(userId, 0) ? userId : null;

    db.call('proc_person_settlement_item', [userId, includingself, pindex, psize], true, (err, d) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        let count = d[1][0].total;
        _.each(d[0], d => {
            let [srate, srebate] = data.getRebate(d.sachieve + d.cachieve);
            let [crate, crebate] = data.getRebate(d.cachieve);
            d.rate = srate;
            d.rebate = srebate - crebate;
        });
        utils.responseOK(res, { count, rows: d[0] });
    });
});


/**
 * @api {post} admin/mail/commit    新增邮件
 * @class admin
 * @param {id} senderId          发布人id
 * @param {string} caption       标题
 * @param {string} content       内容
 * @param {string} userIds       接收者id    (2,3)
 * @param {obj} items            道具    {2: 100,3: 50}
 * @param {date} send_time       发布时间
 */
router.route('/mail/commit').post((req, res) => {
    let { senderId, caption, content, userIds, items = {}, send_time = utils.date.formatYYMMDDHHMMSS(_.now()) } = req.body;
    if (!utils.isId(senderId) ||
        !utils.isString(caption) ||
        !utils.isString(content) ||
        !utils.isString(userIds) ||
        (send_time && !utils.isDate(send_time))) {
        utils.responseError(res);
        return;
    }
    let filter = new Array();
    /*let arrUserIds = userIds.split(',');
    if (arrUserIds.length == 0) {
        utils.responseError(res);
        res.end();
        return;
    }
    for (var i = 0; i < arrUserIds.length; ++i) {
        let userId = arrUserIds[i];
        let user = model.User.findById(userId);
        console.log('user:'+userId+user);
        if (!user) {
            utils.responseError(res);
            res.end();
            return;
        }
    }*/
    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    server.post('user/mail', { userIds: userIds.split(/,|，/) }, (result) => {
        console.log('result.msg:' + JSON.stringify(result.msg));
        _.each(result.msg, (userId) => {
            filter.push({
                senderId,
                caption,
                content,
                userId,
                items: JSON.stringify(items),
                send_time,
                timestamp: utils.date.timestamp(),
                status: 1
            });
        });
        console.log('filter:' + JSON.stringify(filter));
        db.bulkInsert('mail', filter);

        let params = {};
        params.userId = operateid;
        params.module = '邮件管理';
        params.desc = operateid + '新增邮件：' + content + ',成功';
        params.opname = '新增邮件';
        adminlog.external(req, params);
        params.ext1 = caption;
        params.ext2 = content;
        params.ext3 = userIds;
        params.columns = [];
        adminlog.logadmin(params);

        utils.responseOK(res);
    });
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});


/**
 * @api {post} admin/mail/update    更新邮件内容
 * @class admin
 * @param {id} mId               邮件id
 * @param {string} caption       标题
 * @param {string} content       内容
 * @param {obj} items            道具
 * @param {id} userId            接收者id
 * @param {date} send_time       发布时间
 */
router.route('/mail/update').post((req, res) => {
    let { mId, caption, content, items = {}, userId, send_time = null } = req.body;
    if (!utils.isId(mId) ||
        !utils.isString(caption) ||
        !utils.isString(content) ||
        !utils.isId(userId) ||
        (send_time && !utils.isDate(send_time))) {
        utils.responseError(res);
        return;
    }

    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    db.call('proc_mail_manage_update', [mId, caption, content, JSON.stringify(items), userId, send_time], true, (err, result) => {
        if (err) {
            utils.response(res, cons.ResultCode.DB_ERROR());
            return;
        }
        let error = result[0][0].error;
        if (error) {
            return utils.responseError(res, error);
        }

        let params = {};
        params.userId = operateid;
        params.module = '邮件管理';
        params.desc = operateid + '更新邮件：' + mId + ',成功';
        params.opname = '更新邮件';
        adminlog.external(req, params);
        params.ext1 = mId;
        params.ext2 = caption;
        params.ext3 = null;
        params.columns = [];
        adminlog.logadmin(params);
        utils.responseOK(res);
    });
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});


/**
 * @api {get} admin/mail/list       邮件列表
 * @class admin
 * @param {number} sended        全部(-1) 未发送(0) 已发送(1) 已过期(2) 已删除(3)
 * @param {number} pindex        分页索引
 * @param {number} psize         分页大小
 * @param {string} search        搜索条件id或者昵称
 * @param {string} dateStart     起始时间
 * @param {string} dateEnd       结束时间
 * @apiSuccess {json}               返回
 *  [{
 *      "mId": 111111,                          邮件mId
 *      "senderId":                             发送人
 *      "userId":                               接收人
 *      "timestamp":                            创建时间
 *      "caption": 1,                           标题
 *      "content": 'www',                       内容
 *      "send_time": '2018-05-07 12:12:12',     发布时间
 *      "status": 0,                            未发送(0) 已发送(1) 已过期(2)
 *  }]
 */
router.get('/mail/list', (req, res) => {
    let senderId = null;
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let sended = req.query.sended;
    let search = req.query.search || null;

    let dateStart = utils.isString(req.query.dateStart, 0, 30) ? req.query.dateStart : null;
    let dateEnd = utils.isString(req.query.dateEnd, 0, 30) ? req.query.dateEnd : null;

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0) ||
        (search && !utils.isString(search))) {
        utils.responseError(res);
        return;
    }

    db.call('proc_mail_manage_list', [senderId, pindex, psize, search, sended, dateStart, dateEnd], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        let list = result[0];
        let total = result[1][0].total;
        //let items = _.values(_.each(data.item, (item, id) => {item.id = id}));
        let items = [{ 'name': 'RMB', id: 1 }];
        utils.responseOK(res, { list, total, items });
    });
});

/** 
 * @api {post} admin/bankcard/del 删除用户银行卡
 * @class admin
 * @param {id} mId bankcardID（要删除的银行卡绑定ID）
 */
router.post('/bankcard/del', (req, res) => {
    let mId = parseInt(req.body.id);

    if (!utils.isNumber(mId)) {
        utils.responseError(res);
        return;
    }

    db.delete('user_bank', { id: mId }, (err) => {
        if (err) {
            utils.response(res, cons.ResultCode.USER_BANK_DELETE_ERROR());
            return;
        }
        return utils.responseOK(res);
    });
});

/** 
 * @api {post} admin/bankcard/update 修改用户银行卡
 * @class admin）
 */
router.post('/bankcard/update', (req, res) => {
    let mId = parseInt(req.body.id);
    let bankNo = req.body.bankNo;
    let bank = req.body.bank;
    if (!utils.isNumber(mId)) {
        utils.responseError(res);
        return;
    }

    db.update('user_bank', { id: mId }, { bank, bankNo }, (err) => {
        if (err) {
            utils.response(res, cons.ResultCode.USER_BANK_DELETE_ERROR());
            return;
        }
        return utils.responseOK(res);
    });
});

/** 
 * @api {post} admin/userlevel/update 修改用户分类
 * @class admin）
 */
router.post('/userlevel/update', (req, res) => {
    let id = req.body.id;
    let name = req.body.name;
    if (!utils.isNumber(id)) {
        utils.responseError(res);
        return;
    }

    db.update('config_level', { id: id }, { name }, (err) => {
        if (err) {
            utils.response(res, cons.ResultCode.USER_LEVEL_UPDATE_ERROR());
            return;
        }
        return utils.responseOK(res);
    });
});


/** 
 * @api {post} admin/userlevel/del 删除用户分类
 * @class admin
 * @param {id} mId bankcardID（要删除的银行卡绑定ID）
 */
router.post('/userlevel/del', (req, res) => {
    let mId = parseInt(req.body.id);

    if (!utils.isNumber(mId)) {
        utils.responseError(res);
        return;
    }

    db.scalar('select count(id) cnt from user where level=' + mId, (err, msg) => {
        if (err) {
            utils.response(res, cons.ResultCode.USER_LEVEL_DELETE_ERROR());
            return;
        }
        if (msg.cnt == 0) {
            db.delete('config_level', { id: mId }, (err) => {
                if (err) {
                    utils.response(res, cons.ResultCode.USER_LEVEL_DELETE_ERROR());
                    return;
                }
                return utils.responseOK(res);
            });
        } else {
            utils.response(res, cons.ResultCode.USER_LEVEL_CANT_DELETE_ERROR());
        }
    });
});

/** 
 * @api {post} admin/bankcard/new 新增用户银行卡
 * @class admin）
 */
router.post('/bankcard/new', (req, res) => {
    let bankNo = req.body.bankno;
    let bank = req.body.bank;
    let userId = req.body.userid;
    if (!utils.isString(bankNo, 1) || !utils.isString(bank, 1)) {
        utils.responseError(res);
        return;
    }

    db.insert('user_bank', { userId, bank, bankNo }, (err) => {
        if (err) {
            utils.response(res, cons.ResultCode.USER_BANK_DELETE_ERROR());
            return;
        }
        return utils.responseOK(res);
    });
});

/** 
 * @api {post} admin/mail/del 删除邮件
 * @class admin
 * @param {id} mId 邮件ID（要删除的邮件ID）
 */
router.post('/mail/del', (req, res) => {
    let mId = parseInt(req.body.mId);

    if (!utils.isNumber(mId)) {
        utils.responseError(res);
        return;
    }

    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    /*db.delete('mail', { id: mId }, (err) => {
        if (err) {
            utils.response(res, cons.ResultCode.ADMIN_PERMISSION_DELETE_ERROR());
            return;
        }
        return utils.responseOK(res);
    });*/

    db.update("mail", { id: mId }, { status: 3 }, (err, result) => {
        if (err) {
            utils.responseError(res, cons.ResultCode.MAIL_DEL_ERROR());
            return;
        }

        let params = {};
        params.userId = operateid;
        params.module = '邮件管理';
        params.desc = operateid + '删除邮件：' + mId + ',成功';
        params.opname = '删除邮件';
        adminlog.external(req, params);
        params.ext1 = mId;
        params.ext2 = 3;
        params.ext3 = null;
        params.columns = [];
        adminlog.logadmin(params);
        utils.responseOK(res);
    });
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});


/** 
 * @api {post} admin/room/params/commit 添加房间参数
 * @class admin
 * @param {number} area              房间id
 * @param {string} name              房间名称
 * @param {number} baseScore         房间底注
 * @param {number} scoreMin          最低准入
 * @param {number} scoreMax          最高限入
 * @param {number} bankerLimit       庄家限制
 * @param {number} bankerCount       庄家回合
 * @param {string} betOptions        投注选项
 * @param {string} game              游戏(nn:牛牛,dz:德州,bjl:百家乐)
 */
router.post('/room/params/commit', (req, res) => {
    //baseScore, scoreMin, scoreMax, bankerLimit = null, bankerCount = null, 
    //betOptions = null, 
    let { area, name, game, options } = req.body;
    if (!utils.isString(options, 1)) {
        console.log('1');
        utils.responseError(res);
        return;
    }

    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    let soptions = decodeURIComponent(options);
    let opts = JSON.parse(soptions);
    if (options && opts) {
        if ((opts.baseScore && !utils.isNumber(opts.baseScore)) ||
            (opts.scoreMin && !utils.isNumber(opts.scoreMin)) ||
            (opts.scoreMax && !utils.isNumber(opts.scoreMax)) ||
            (opts.bankerLimit && !utils.isNumber(opts.bankerLimit)) ||
            (opts.bankerCount && !utils.isNumber(opts.bankerCount))) {
            utils.responseError(res);
            return;
        }
    }

    if (!utils.isNumber(area) ||
        !utils.isString(game)) {
        utils.responseError(res);
        return;
    }
    db.call('proc_room_params_add', [area, name, soptions, game], true, (err, result) => {
        if (err) {
            utils.response(res, cons.ResultCode.DB_ERROR());
            return;
        }
        let error = result[0][0].error;
        if (error) {
            return utils.responseError(res, error);
        }

        let params = {};
        params.userId = operateid;
        params.module = '场次管理';
        params.desc = operateid + '新增场次 游戏:' + game + ' 房间名称:' + name + ' 区域:' + area + ' 底注:' + opts.baseScore + ' 最低准入:' + opts.scoreMin + ' 最高限入:' + opts.scoreMax + ' 庄家限制:' + opts.bankerLimit + ' 庄家回合:' + opts.bankerCount + ' 投注选项:' + opts.betOptions + ',成功';
        params.opname = '新增场次';
        adminlog.external(req, params);
        params.ext1 = null;
        params.ext2 = null;
        params.ext3 = null;
        params.columns = [];
        adminlog.logadmin(params);
        utils.responseOK(res);
    });

}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});


/** 
 * @api {get} admin/room/params/list    房间参数列表
 * @class admin
 * @param {number} pindex    
 * @param {number} psize
 * @param {number} gameId            游戏id(0表示全部，1表示牛牛，2表示德州，3表示百家乐)
 * @param {string} search            搜索条件
 * @param {string} dateStart         起始时间
 * @param {string} dateEnd           结束时间
 * @apiSuccess {json}                   返回
 *  [{
 *      "rpId": 111111,             id
 *      "area"                      房间id
 *      "name"                      房间名称
 *      "baseScore"                 房间底注
 *      "scoreMin"                  最低准入
 *      "scoreMax":                 最高限入
 *      "bankerLimit": 1,           庄家限制
 *      "bankerCount": 'www',       庄家回合
 *      "betOptions": '50, 100, 1000, 2000'     投注选项
 *      "game": 'nn',                  游戏游戏(nn:牛牛,dz:德州,bjl:百家乐)
 *      "create_time": '2018-05-07 12:12:12'    创建时间
 *  }]
 */
router.get('/room/params/list', (req, res) => {
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    let gameId = req.query.gameId;
    let search = req.query.search || null;

    let dateStart = utils.isString(req.query.dateStart, 0, 30) ? req.query.dateStart : null;
    let dateEnd = utils.isString(req.query.dateEnd, 0, 30) ? req.query.dateEnd : null;

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0) ||
        (search && !utils.isString(search))) {
        utils.responseError(res);
        return;
    }

    db.call('proc_room_params_list', [pindex, psize, gameId, search, dateStart, dateEnd], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        let data = result[0];
        let total = result[1][0].total;
        utils.responseOK(res, { data, total });
    });

});


/** 
 * @api {post} admin/room/params/update 修改房间参数
 * @class admin
 * @param {id}     rpId          id
 * @param {number} area          房间名称
 * @param {string} name          房间名称
 * @param {string} game          游戏
 * @param {number} baseScore     房间底注
 * @param {number} scoreMin      最低准入
 * @param {number} scoreMax      最高限入
 * @param {number} bankerLimit   庄家限制
 * @param {number} bankerCount   庄家回合
 * @param {string} betOptions    投注选项
 */
router.route('/room/params/update').post((req, res) => {
    //rpId,baseScore, scoreMin, scoreMax, bankerLimit = null, bankerCount = null, betOptions = null, 
    let { area, name, game, options, rpId } = req.body;
    if (!utils.isId(rpId) || !utils.isString(options, 1)) {
        console.log('rpId error');
        utils.responseError(res);
        return
    }

    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    let soptions = decodeURIComponent(options);
    let opts = JSON.parse(soptions);
    if (options && opts) {
        if (!utils.isNumber(opts.baseScore) ||
            !utils.isNumber(opts.scoreMin) ||
            !utils.isNumber(opts.scoreMax) ||
            (opts.bankerLimit && !utils.isNumber(opts.bankerLimit)) ||
            (opts.bankerCount && !utils.isNumber(opts.bankerCount))) {
            console.log('opts error');
            utils.responseError(res);
            return;
        }
    }

    if (!utils.isNumber(area) ||
        !utils.isString(name) ||
        !utils.isString(game)) {
        utils.responseError(res);
        return;
    }
    db.call('proc_room_params_update', [rpId, area, name, game, soptions], true, (err, result) => {
        if (err) {
            utils.response(res, cons.ResultCode.DB_ERROR());
            return;
        }
        let error = result[0][0].error;
        if (error) {
            return utils.responseError(res, error);
        }

        let params = {};
        params.userId = operateid;
        params.module = '场次管理';
        params.desc = operateid + '编辑场次 游戏:' + game + ' 房间名称:' + name + ' 区域:' + area + ' 底注:' + opts.baseScore + ' 最低准入:' + opts.scoreMin + ' 最高限入:' + opts.scoreMax + ' 庄家限制:' + opts.bankerLimit + ' 庄家回合:' + opts.bankerCount + ' 投注选项:' + opts.betOptions + ',成功';
        params.opname = '编辑场次';
        adminlog.external(req, params);
        params.ext1 = rpId;
        params.ext2 = null;
        params.ext3 = null;
        params.columns = [];
        adminlog.logadmin(params);
        utils.responseOK(res);
    });
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});

/** 
 * @api {post} admin/room/params/del 删除房间参数
 * @class admin
 * @param {id} rpId 房间参数ID（要删除的房间参数ID）
 */
router.post('/room/params/del', (req, res) => {
    let rpId = parseInt(req.body.rpId);
    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    if (!utils.isNumber(rpId)) {
        utils.responseError(res);
        return;
    }

    db.delete('room_params', { id: rpId }, (err) => {
        if (err) {
            utils.response(res, cons.ResultCode.ADMIN_PERMISSION_DELETE_ERROR());
            return;
        }

        let params = {};
        params.userId = operateid;
        params.module = '场次管理';
        params.desc = operateid + '删除场次 房间id:' + rpId + ',成功';
        params.opname = '删除场次';
        adminlog.external(req, params);
        params.ext1 = rpId;
        params.ext2 = null;
        params.ext3 = null;
        params.columns = [];
        adminlog.logadmin(params);
        utils.responseOK(res);
        return utils.responseOK(res);
    });
}).options((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.end('');
});


/**
 * @api {get} admin/jackpot/details    奖池
 * @class admin
 * @param {number}   pindex            
 * @param {number}   psize
 * @apiSuccessExample   返回
 * {
 *      "game": "nn",           游戏
 *      "area": 1,              区域
 *      "name": "羊毛",         名称
 *      "enabled": 0,           开关
 *      "minJackpot": 0,        
 *      "maxJackpot": 0,
 *      "minBet": 0,
 *      "prob": 0              概率值            
 *      "jackpot": "9000"       奖池
 * }
 */
router.get('/jackpot/details', (req, res) => {
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    db.call('proc_room_params_list', [pindex, psize, 0, null, null, null], true, (error, rows) => {
        if (error) {
            utils.responseError(res);
            return;
        }
        async.mapSeries(rows[0], (row, callback) => {
            let keys = [
                `UpGame:${row.game.toUpperCase()}:AREA_${row.area}:${cons.Jackpot.ENABLED()}`,
                `UpGame:${row.game.toUpperCase()}:AREA_${row.area}:${cons.Jackpot.MINJACKPOT()}`,
                `UpGame:${row.game.toUpperCase()}:AREA_${row.area}:${cons.Jackpot.MAXJACTPOT()}`,
                `UpGame:${row.game.toUpperCase()}:AREA_${row.area}:${cons.Jackpot.MINBET()}`,
                `UpGame:${row.game.toUpperCase()}:AREA_${row.area}:${cons.Jackpot.JACKPOT()}`,
                `UpGame:${row.game.toUpperCase()}:AREA_${row.area}:${cons.Jackpot.PROB()}`,
                `UpGame:${row.game.toUpperCase()}:AREA_${row.area}:${cons.Jackpot.WIN_RATE()}`,
                `UpGame:${row.game.toUpperCase()}:AREA_${row.area}:${cons.Jackpot.JACKPOT_RATE()}`,
                `UpGame:${row.game.toUpperCase()}:AREA_${row.area}:${cons.Jackpot.WIN_GOLD_RATE()}`,
                `UpGame:${row.game.toUpperCase()}:AREA_${row.area}:${cons.Jackpot.LOSE_GOLD_RATE()}`,
                `UpGame:${row.game.toUpperCase()}:AREA_${row.area}:${cons.Jackpot.WIN_GOLD()}`,
                `UpGame:${row.game.toUpperCase()}:AREA_${row.area}:${cons.Jackpot.LOSE_GOLD()}`
            ];
            redis.mget(keys, (reply) => {
                reply ?
                    callback(null, {
                        game: row.game,
                        area: row.area,
                        name: row.name,
                        enabled: reply[0] ? parseInt(reply[0].toString()) : 0,
                        minJackpot: reply[1] ? parseInt(reply[1].toString()) : 0,
                        maxJackpot: reply[2] ? parseInt(reply[2].toString()) : 0,
                        minBet: reply[3] ? parseInt(reply[3].toString()) : 0,
                        jackpot: reply[4] ? parseInt(reply[4].toString()) : 0,
                        prob: reply[5] ? parseInt(reply[5].toString()) : 0,
                        winRate: reply[6] ? parseInt(reply[6].toString()) : 0,
                        jackpotRate: reply[7] ? parseInt(reply[7].toString()) : 0,
                        winGoldRate: reply[8] ? parseInt(reply[8].toString()) : 0,
                        loseGoldRate: reply[9] ? parseInt(reply[9].toString()) : 0,
                        winGold: reply[10] ? parseInt(reply[10].toString()) : 0,
                        loseGold: reply[11] ? parseInt(reply[11].toString()) : 0
                    }) :
                    callback(null);
            });
        }, (err, data) => {
            if (err) {
                return utils.responseError(res, err);
            }
            utils.responseOK(res, { data: data, total: rows[1][0].total });
        });
    });
});


/**
 * @api {post} admin/charge/jackpot       调整当前奖池值
 * @class admin
 * @param {id}           userId        操作人ID
 * @param {string}       game          游戏
 * @param {number}       area          区域
 * @param {number}       enabled       是否开启机器人收割放钱机制（1:开启；0为关闭）
 * @param {number}       minJackpot    奖池小于这个值，启动回收
 * @param {number}       maxJackpot    奖池大于这个值，启动收割
 * @param {number}       minBet        启动收割最小下注量
 * @param {number}       prob          概率值
 * @param {number}       score         奖池修改值(正+ 负-)
 * @apiSuccessExample 返回
 * {}
 */
router.post('/charge/jackpot', (req, res) => {
    let { userId, game, area, score } = req.body;

    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    if (!utils.isId(userId) ||
        !utils.isString(game) ||
        !utils.isNumber(area) ||
        !utils.isNumber(score)) {
        utils.responseError(res);
        return;
    }

    redis.incrby(`UpGame:${game.toUpperCase()}:AREA_${area}:${cons.Jackpot.JACKPOT()}`, score);
    db.insert('jackpot_charge_record', { userId, game, area, score }, () => {
        jackpot.chargeScore(game, area, score, () => { });

        let params = {};
        params.userId = operateid;
        params.module = '奖池管理';
        params.desc = operateid + '修改数值 游戏:' + game + ' 场次:' + area + ' 奖池增加: ' + score + ',成功';
        params.opname = '设置奖池';
        adminlog.external(req, params);
        params.ext1 = null;
        params.ext2 = null;
        params.ext3 = null;
        params.columns = [];
        adminlog.logadmin(params);
        utils.responseOK(res);
    });
});


/**
 * @api {post} admin/charge/status        调整奖池状态值
 * @class admin
 * @param {id}           userId        操作人ID
 * @param {string}       game          游戏
 * @param {number}       area          区域
 * @param {number}       enabled       是否开启机器人收割放钱机制（1:开启；0为关闭）
 * @param {number}       minJackpot    奖池小于这个值，启动回收
 * @param {number}       maxJackpot    奖池大于这个值，启动收割
 * @param {number}       minBet        启动收割最小下注量
 * @param {number}       winRate       放水概率
 * @param {number}       jackpotRate   奖池转换率
 * @param {number}       winGoldRate   玩家赢钱上限充值比
 * @param {number}       loseGoldRate  玩家赢钱下限充值比
 * @param {number}       winGold       玩家赢钱上限金额
 * @param {number}       loseGold      玩家赢钱下限金额
 * @param {number}       ids           需要批量修改的奖池
 * @apiSuccessExample 返回
 * {}
 */
router.post('/charge/status', (req, res) => {
    let { userId, game, area, enabled, minJackpot, maxJackpot, minBet, prob, winRate, jackpotRate, winGoldRate, loseGoldRate, winGold, loseGold, ids } = req.body;

    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    if (!utils.isId(userId) ||
        !utils.isNumber(enabled) ||
        !utils.isNumber(minJackpot) ||
        !utils.isNumber(maxJackpot) ||
        !utils.isNumber(minBet) ||
        !utils.isNumber(prob) ||
        !utils.isNumber(winRate) ||
        !utils.isNumber(jackpotRate) ||
        !utils.isNumber(winGoldRate) ||
        !utils.isNumber(loseGoldRate) ||
        !utils.isNumber(winGold) ||
        !utils.isNumber(loseGold)) {
        return utils.responseError(res);
    }

    let data = [];
    if (ids && ids.length > 0) {
        for (let id of ids) {
            if (!utils.isObject(id) || !utils.isString(id.game) || !utils.isNumber(id.area)) {
                continue;
            }
            data.push(`UpGame:${id.game.toUpperCase()}:AREA_${id.area}:${cons.Jackpot.ENABLED()}`, enabled);
            data.push(`UpGame:${id.game.toUpperCase()}:AREA_${id.area}:${cons.Jackpot.MINJACKPOT()}`, minJackpot);
            data.push(`UpGame:${id.game.toUpperCase()}:AREA_${id.area}:${cons.Jackpot.MAXJACTPOT()}`, maxJackpot);
            data.push(`UpGame:${id.game.toUpperCase()}:AREA_${id.area}:${cons.Jackpot.MINBET()}`, minBet);
            data.push(`UpGame:${id.game.toUpperCase()}:AREA_${id.area}:${cons.Jackpot.PROB()}`, prob);
            data.push(`UpGame:${id.game.toUpperCase()}:AREA_${id.area}:${cons.Jackpot.WIN_RATE()}`, winRate);
            data.push(`UpGame:${id.game.toUpperCase()}:AREA_${id.area}:${cons.Jackpot.JACKPOT_RATE()}`, jackpotRate);
            data.push(`UpGame:${id.game.toUpperCase()}:AREA_${id.area}:${cons.Jackpot.WIN_GOLD_RATE()}`, winGoldRate);
            data.push(`UpGame:${id.game.toUpperCase()}:AREA_${id.area}:${cons.Jackpot.LOSE_GOLD_RATE()}`, loseGoldRate);
            data.push(`UpGame:${id.game.toUpperCase()}:AREA_${id.area}:${cons.Jackpot.WIN_GOLD()}`, winGold);
            data.push(`UpGame:${id.game.toUpperCase()}:AREA_${id.area}:${cons.Jackpot.LOSE_GOLD()}`, loseGold);
        }
    } else {
        if (!utils.isString(game) || !utils.isNumber(area)) {
            return utils.responseError(res);
        }
        data.push(`UpGame:${game.toUpperCase()}:AREA_${area}:${cons.Jackpot.ENABLED()}`, enabled,
            `UpGame:${game.toUpperCase()}:AREA_${area}:${cons.Jackpot.MINJACKPOT()}`, minJackpot,
            `UpGame:${game.toUpperCase()}:AREA_${area}:${cons.Jackpot.MAXJACTPOT()}`, maxJackpot,
            `UpGame:${game.toUpperCase()}:AREA_${area}:${cons.Jackpot.MINBET()}`, minBet,
            `UpGame:${game.toUpperCase()}:AREA_${area}:${cons.Jackpot.PROB()}`, prob,
            `UpGame:${game.toUpperCase()}:AREA_${area}:${cons.Jackpot.WIN_RATE()}`, winRate,
            `UpGame:${game.toUpperCase()}:AREA_${area}:${cons.Jackpot.JACKPOT_RATE()}`, jackpotRate,
            `UpGame:${game.toUpperCase()}:AREA_${area}:${cons.Jackpot.WIN_GOLD_RATE()}`, winGoldRate,
            `UpGame:${game.toUpperCase()}:AREA_${area}:${cons.Jackpot.LOSE_GOLD_RATE()}`, loseGoldRate,
            `UpGame:${game.toUpperCase()}:AREA_${area}:${cons.Jackpot.WIN_GOLD()}`, winGold,
            `UpGame:${game.toUpperCase()}:AREA_${area}:${cons.Jackpot.LOSE_GOLD()}`, loseGold);
    }

    redis.mset(data);
    let p = {};
    adminlog.external(req, p);
    utils.responseOK(res);

    if (ids && ids.length) {
        for (let id of ids) {
            jackpot.chargeSettings(id.game, id.area, enabled, minJackpot, maxJackpot, minBet, prob, winRate, jackpotRate, winGoldRate, loseGoldRate, winGold, loseGold, () => { });

            db.insert('jackpot_charge_record', { userId, game: id.game, area: id.area, enabled, minJackpot, maxJackpot, minBet, prob, winRate, jackpotRate, winGoldRate, loseGoldRate, winGold, loseGold, score: 0 }, () => {
                let params = {};
                params.userId = operateid;
                params.module = '奖池管理';
                params.desc = operateid
                    + '修改数值 游戏:' + id.game
                    + ' 场次:' + id.area
                    + ' 开启收割: ' + enabled
                    + ' 触发概率: ' + prob
                    + ' 启动回收：' + minJackpot
                    + ' 启动放水：' + maxJackpot
                    + ' 最小下注量：' + minBet
                    + ' 放水概率：' + winRate
                    + ' 奖池转换率：' + jackpotRate
                    + ' 玩家赢钱上限充值比：' + winGoldRate
                    + ' 玩家赢钱下限充值比：' + loseGoldRate
                    + ' 玩家赢钱上限金额：' + winGold
                    + ' 玩家赢钱下限金额：' + loseGold
                    + ',成功';
                params.opname = '修改数值';
                params.ext1 = null;
                params.ext2 = null;
                params.ext3 = null;
                params.columns = [];
                params.ip = p.ip;
                params.optime = p.optime;
                adminlog.logadmin(params);
            });
        }
    } else {
        jackpot.chargeSettings(game, area, enabled, minJackpot, maxJackpot, minBet, prob, winRate, jackpotRate, winGoldRate, loseGoldRate, winGold, loseGold, () => { });

        db.insert('jackpot_charge_record', { userId, game, area, enabled, minJackpot, maxJackpot, minBet, prob, winRate, jackpotRate, winGoldRate, loseGoldRate, winGold, loseGold, score: 0 }, () => {
            let params = {};
            params.userId = operateid;
            params.module = '奖池管理';
            params.desc = operateid
                + '修改数值 游戏:' + game
                + ' 场次:' + area
                + ' 开启收割: ' + enabled
                + ' 触发概率: ' + prob
                + ' 启动回收：' + minJackpot
                + ' 启动放水：' + maxJackpot
                + ' 最小下注量：' + minBet
                + ' 放水概率：' + winRate
                + ' 奖池转换率：' + jackpotRate
                + ' 玩家赢钱上限充值比：' + winGoldRate
                + ' 玩家赢钱下限充值比：' + loseGoldRate
                + ' 玩家赢钱上限金额：' + winGold
                + ' 玩家赢钱下限金额：' + loseGold
                + ',成功';
            params.opname = '修改数值';
            params.ext1 = null;
            params.ext2 = null;
            params.ext3 = null;
            params.columns = [];
            params.ip = p.ip;
            params.optime = p.optime;
            adminlog.logadmin(params);
        });
    }
});

/**
 * @api {post} admin/charge/updateBlackList       更新黑名单

router.post('/charge/updateBlackList', (req, res) => {
    console.log('进入updateBlackList')
    let { game, userId, isadd } = req.body;

    let user = userManager.getUserBySession(req.sessionID);
    if (!user) {
        utils.response(res, { code: 402, msg: '登录失效！' });
        return;
    }
    let operateid = user.attrs.id;

    if (!utils.isId(userId) ||
        !utils.isString(game) ) {
        return;
    }
    if(isadd) {
        db.insert('blackList', { userId, game}, () => {
            jackpot.updateBlackList(game, game, isadd, () => { });

            utils.responseOK(res);
        });
    }
    else {
        db.delete('blackList', { userId, game}, () => {
            jackpot.updateBlackList(game, area, score, () => { });

            adminlog.logadmin(params);
            utils.responseOK(res);
        });
    }
});


/** 
 * @api {get} admin/jackpot/record        奖池操作记录
 * @class admin
 * @param {string}   game              游戏  
 * @param {number}   area              区域
 * @param {number}   pindex            
 * @param {number}   psize
 * @apiSuccess {json}                     返回
 *  [{
 *      id: 1,
 *      account: aaa                 操作人账号
 *      nick: aaa                    操作人昵称
 *      enabled:                     开关
 *      minJackpot:                  启动回收      
 *      maxJackpot:                  启动放钱 
 *      minBet:                      下注量
 *      score:                       当前奖池值
 *      timestamp:                   时间
 *  }]
 */
router.get('/jackpot/record', (req, res) => {
    let { game, area } = req.query;
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);
    area = parseInt(req.query.area);

    if (!utils.isString(game) ||
        !utils.isNumber(area) ||
        !utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_jackpot_record_details', [game, area, pindex, psize], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        let data = result[0];
        let total = result[1][0].total;
        utils.responseOK(res, { data, total });
    });
});


/** 
 * @api {post} admin/upg/setConfig         upg配置(param不传不设置)
 * @class admin
 * @param {string}    colds             冷钱包地址数组
 * @param {string}    gasPrice          事务gasPrice
 * @param {float}     prrate            upg权重计算-资产比例
 * @param {float}     plrate            upg权重计算-有效计算比例
 * @param {float}     turate            upg权重计算-流水比例
 * @param {integer}   bomax             分红上限
 * @param {float}     borate            分红占服务费比例
 * @param {integer}   upbase            upg发布总数计算系数-人数*upbase
 * @param {integer}   upmax             upg发布总数上限
 * @apiSuccess {json}                      返回
 *  {}
 */
router.post('/upg/setConfig', (req, res) => {
    let { colds = null, gasPrice = null, prrate = null, plrate = null, turate = null, bomax = null, borate = null, upbase = null, upmax = null } = req.body;
    if ((colds && !utils.isString(colds)) ||
        (gasPrice && !utils.isString(gasPrice)) ||
        (prrate && !utils.isNumber(prrate)) ||
        (plrate && !utils.isNumber(plrate)) ||
        (turate && !utils.isNumber(turate)) ||
        (bomax && !utils.isNumber(bomax)) ||
        (borate && !utils.isNumber(borate)) ||
        (upbase && !utils.isNumber(upbase)) ||
        (upmax && !utils.isNumber(upmax))) {
        utils.responseError(res);
        return;
    }
    colds && redis.lpush(`eth:ether:colds`, colds.split(/,|，/), () => { });
    gasPrice && redis.set(`eth:ether:gasPrice`, gasPrice, () => { });
    prrate && redis.set(`eth:ether:prrate`, prrate, () => { });
    plrate && redis.set(`eth:ether:plrate`, plrate, () => { });
    turate && redis.set(`eth:ether:turate`, turate, () => { });
    bomax && redis.set(`eth:ether:bomax`, bomax, () => { });
    borate && redis.set(`eth:ether:borate`, borate, () => { });
    upbase && redis.set(`eth:ether:upbase`, upbase, () => { });
    upmax && redis.set(`eth:ether:upmax`, upmax, () => { });
    utils.responseOK(res);
});

/** 
 * @api {get} admin/upg/getConfig          upg配置获取
 * @class admin
 * @param {string}    colds             冷钱包地址数组
 * @param {string}    gasPrice          事务gasPrice
 * @param {float}     prrate            upg权重计算-资产比例
 * @param {float}     plrate            upg权重计算-有效计算比例
 * @param {float}     turate            upg权重计算-流水比例
 * @param {integer}   bomax             分红上限
 * @param {float}     borate            分红占服务费比例
 * @param {integer}   upbase            upg发布总数计算系数-人数*upbase
 * @param {integer}   upmax             upg发布总数上限
 * @apiSuccess {json}                      返回
 *  {}
 */
router.get('/upg/getConfig', (req, res) => {
    let keys = [
        `eth:ether:gasPrice`, `eth:ether:prrate`,
        `eth:ether:plrate`, `eth:ether:turate`,
        `eth:ether:bomax`, `eth:ether:borate`,
        `eth:ether:upbase`, `eth:ether:upmax`,
        `eth:ether:hot`
    ];
    async.series([
        (callback) => {
            redis.lrange(`eth:ether:colds`, (colds) => {
                callback(null, { colds: colds });
            })
        },
        (callback) => {
            redis.mget(keys, (reply) => {
                callback(null, {
                    gasPrice: reply[0] ? reply[0].toString() : '',
                    prrate: reply[1] ? reply[1].toString() : 0,
                    plrate: reply[2] ? reply[2].toString() : 0,
                    turate: reply[3] ? reply[3].toString() : 0,
                    bomax: reply[4] ? reply[4] : 0,
                    borate: reply[5] ? reply[5] : 0,
                    upbase: reply[6] ? reply[6] : 0,
                    upmax: reply[7] ? reply[7] : 0,
                    hot: reply[8] ? reply[8] : ''
                });
            })
        }
    ], (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        let data = result[1];
        data.colds = result[0].colds;
        utils.responseOK(res, data);
    });
});


/** 
 * @api {get} admin/upg/details             审核列表
 * @class admin
 * @param {number}    pindex             分页索引
 * @param {number}    psize              分页数量
 * @apiSuccess {json}                       返回
 * {
 *      'id':13                             id
 *      'timestamp': 2018-08-05,            日期(Y-m-d)
 *      'upg'                               upg总量
 *      'upcount'                           重置upg总量
 *      'bofrom'                            当日服务费
 *      'borate':                           服务费系数
 *      'bocount':                          重置分红总量
 *      'urcount':                          排行奖励总量
 *      'property':                         资产总计
 *      'count':                            人数
 *      'score':                            权重
 * }
 */
router.get('/upg/details', (req, res) => {
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_upg_details', [pindex, psize], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        let data = result[0];
        let total = result[1][0].total;
        utils.responseOK(res, { data, total });
    });
});


/** 
 * @api {get} admin/upg/user/record            upg_user_record列表
 * @class admin
 * @param {string}    timestamp              日期
 * @param {number}    pindex                 分页索引
 * @param {number}    psize                  分页数量
 * @apiSuccess {json}                           返回
 * {
 *      'userId':13                             用户id
 *      'nick':13                               用户昵称
 *      'upcount':  123,                        获得upg
 *      'bocount':  123                         获得WFEE  
 *      'urcount':  123                         排名奖励 
 *      'urrank':   123                         排名 
 *      'property': 123                         日均资产
 *      'play': 1                               有效局数
 *      'turnover': 1                           流水
 * }
 */
router.get('/upg/user/record', (req, res) => {
    let { timestamp } = req.query;
    let pindex = parseInt(req.query.pindex);
    let psize = parseInt(req.query.psize);

    if (!utils.isString(timestamp) ||
        !utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 0)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_upg_user_record', [timestamp, pindex, psize], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        let data = result[0];
        let total = result[1][0].total;
        utils.responseOK(res, { data, total });
    });
});


/** 
 * @api {post} admin/upg/reset                  重置upg总量
 * @class admin
 * @param {string}    timestamp              日期
 * @param {number}    gross                  总量
 * @param {number}    score                  权重
 * @param {string}    field                  (upcount-->upg重置, bocount-->wfee分红重置)
 * @apiSuccess {json}                           返回
 * {}
 */
router.post('/upg/reset', (req, res) => {
    let { timestamp, gross, score, field } = req.body;

    if (!utils.isString(timestamp) ||
        !utils.isNumber(gross) ||
        !utils.isNumber(score)) {
        utils.responseError(res);
        return;
    }
    let tscore = score;
    db.call('proc_upg_count_reset', [timestamp, tscore, field, gross], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        utils.responseOK(res);
    });
});


/** 
 * @api {post} admin/upg/publish                发送奖励(审批同意按钮)
 * @class admin
 * @param {string}    timestamp              日期
 * @param {string}    field                  (bostate-->wee分红, upstate-->upg, urstate-->排名)
 * @param {number}    state                  发送奖励状态值 1
 * @apiSuccess {json}                           返回
 * {}
 */
router.post('/upg/publish', (req, res) => {
    let { timestamp, field, state } = req.body;

    if (!utils.isString(timestamp) ||
        !utils.isString(field) ||
        !utils.isNumber(state)) {
        utils.responseError(res);
        return;
    }
    let data = field == 'bostate' ? { bostate: state } : (field == 'upstate' ? { upstate: state } : { urstate: state });
    db.update("upg", { timestamp: timestamp }, data, (err, result) => {
        if (err) {
            utils.responseError(res, cons.ResultCode.ERROR());
            return;
        }
        utils.responseOK(res);
    });
});

/** 
 * @api {post} admin//wallet/config/update                  修改冷钱包地址
 * @class admin
 * @param {number}    index                 索引
 * @param {string}    cold                  值
 * @apiSuccess {json}                          返回
 * {}
 */
router.post('/wallet/config/update', (req, res) => {
    let { index, cold } = req.body;
    if (!utils.isNumber(index) ||
        !utils.isString(cold)) {
        utils.responseError(res);
        return;
    }
    redis.lset(`eth:ether:colds`, index, cold, (reply) => {
        utils.responseOK(res);
    })
});

/** 
 * @api {post} admin/wallet/config/delete         删除冷钱包地址
 * @class admin
 * @param {string}    cold                       值
 * @apiSuccess {json}                               返回
 * {}
 */
router.post('/wallet/config/delete', (req, res) => {
    let { cold } = req.body;
    if (!utils.isString(cold)) {
        utils.responseError(res);
        return;
    }
    redis.lrem(`eth:ether:colds`, cold, (reply) => {
        utils.responseOK(res);
    })
});


/** 
 * @api {post} admin/marquee/onoff              自动跑马灯开关
 * @class admin
 * @param {boolean}    onoff                 值(true|false)
 * @apiSuccess {json}                           返回
 * {}
 */
router.post('/marquee/onoff', (req, res) => {
    let { onoff } = req.body;
    server.post('user/marquee', { onoff }, (err, result) => {
        utils.response(res, err, result);
    });
});


/** 
 * @api {post} admin/robot/money/reset         排行榜金币区间段修改
 * @class admin
 * @param {number}    minRank               最小排名
 * @param {number}    maxRank               最大排名
 * @param {decimal(7,2)}     coeff          修改系数 +,-
 * @apiSuccess {json}                          返回
 * {}
 */
router.post('/robot/money/reset', (req, res) => {
    let { minRank, maxRank, coeff } = req.body;
    if (!utils.isNumber(minRank) ||
        !utils.isNumber(maxRank)) {
        utils.responseError(res);
        return;
    }

    db.call('proc_robot_money_reset', [minRank, maxRank, coeff], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }
        utils.responseOK(res);
    });
});

/**
 * @api {get} /admin/pay/bank/details
 */
router.get('/pay/bank/details', (req, res) => {
    let p = model.AdminPayBank.findAndCountAll();
    utils.responseProm(res, p);
});

/**
 * @api {get} /admin/pay/bank/details
 */
router.get('/pay/wx/details', (req, res) => {
    let p = model.AdminPayWx.findAndCountAll();
    utils.responseProm(res, p);
});

/**
 * 后台操作日志
 * @api {post} /admin/operate/records
 */
router.post('/operate/records', (req, res) => {
    let { userId, ip, desc, from, to, from_createTime, to_createTime } = req.body;
    let pindex = req.body.page;
    let psize = req.body.skip;

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 5)) {
        utils.responseError(res);
        return;
    }

    userId = utils.isString(userId) ? userId : null;
    ip = utils.isString(ip) ? ip : null;
    desc = utils.isString(desc) ? desc : null;
    from = utils.isDate(from) ? (from) : null;
    to = utils.isDate(to) ? (to) : null;
    from_createTime = utils.isDate(from_createTime) ? (from_createTime) : null;
    to_createTime = utils.isDate(to_createTime) ? (to_createTime) : null;

    db.call('proc_admin_operate_record_details', [userId, ip, desc, from, to, from_createTime, to_createTime, pindex, psize], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        var qqwry = libqqwry.init(); //初始化IP库解析器
        qqwry.speed(); //启用急速模式 比不开启效率率快非常多 但多占10M左右内存;

        let data = result[0];
        _.each(data, (row) => {
            try {
                console.log('row.ip:');
                console.log(row.ip);
                var ip = qqwry.searchIP(utils.ip(row.ip)); //查询IP信息
                row.ip = row.ip + '(' + ip.Country + ip.Area + ')';
                row.ip = row.ip.replace(/ CZ88.NET/g, "");
            } catch (e) {
                console.log(e);
            }
        });
        let total = result[1][0].total;
        utils.responseOK(res, { data, total });
    });
});

/*管理员操作日志 */
router.post('/adminlog', (req, res) => {
    let { userId, ip, desc, from, to } = req.body;
    let pindex = req.body.page;
    let psize = req.body.skip;

    if (!utils.isNumber(pindex, 0) ||
        !utils.isNumber(psize, 5)) {
        utils.responseError(res);
        return;
    }

    userId = utils.isString(userId) ? userId : null;
    ip = utils.isString(ip) ? ip : null;
    desc = utils.isString(desc) ? desc : null;
    from = utils.isDate(from) ? (from) : null;
    to = utils.isDate(to) ? (to) : null;

    db.call('proc_admin_logs', [userId, ip, desc, from, to, pindex, psize], true, (err, result) => {
        if (err) {
            utils.responseError(res);
            return;
        }

        var qqwry = libqqwry.init(); //初始化IP库解析器
        qqwry.speed(); //启用急速模式 比不开启效率率快非常多 但多占10M左右内存;

        let data = result[0];
        _.each(data, (row) => {
            try {
                var ip = qqwry.searchIP(utils.ip(row.ip)); //查询IP信息
                row.ip = row.ip + '(' + ip.Country + ip.Area + ')';
                row.ip = row.ip.replace(/ CZ88.NET/g, "");
            } catch (e) {

            }
        });
        let total = result[1][0].total;
        utils.responseOK(res, { data, total });
    });
});

module.exports = router;
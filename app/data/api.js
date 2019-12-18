let api = module.exports = {};


api['/api/announcement'] = { session: false };
api['/api/config/'] = { session: false };
api['/api/vercode'] = { session: false };
api['/api/vercodepng'] = { session: false };
api['/api/vercode/action'] = { session: false };
api['/api/test'] = { session: false };
api['/api/qr'] = { session: false };
api['/api/wx'] = { session: false };
api['/api/create_device'] = { session: false };
api['/api/customer/records'] = { session: false };
api['/api/customer/reply'] = { session: false };

api['/api/activity/login/rewards'] = { session: false };

api['/api/pay/bank/details'] = { session: false };
api['/api/pay/wx/details'] = { session: false };

api['/api/admin/charge/updateBlackList'] = { type: 1, session: true };
api['/api/admin/role'] = { type: 1, session: true };
api['/api/admin/accounts'] = { type: 1, session: true };
api['/api/admin/accounts/add'] = { type: 1, session: true };
api['/api/admin/accounts/permission'] = { type: 1, session: true };
api['/api/admin/permission'] = { type: 1, session: true };
api['/api/admin/permission/add'] = { type: 1, session: true };
api['/api/admin/permission/commit'] = { type: 1, session: true };
api['/api/admin/agent/register'] = { type: 1, session: true };
api['/api/admin/charge/agent'] = { type: 1, session: true };
api['/api/admin/user/find'] = { type: 1, session: true };
api['/api/admin/user/details'] = { type: 1, session: true };
api['/api/admin/user/details/addup'] = { type: 1, session: true };
api['/api/admin/user/bank/list'] = { type: 1, session: true };
api['/api/admin/user/level/change'] = { type: 1, session: true };
api['/api/admin/user/game/details'] = { type: 1, session: true };
api['/api/admin/operate/records'] = { type: 1, session: true };
api['/api/admin/adminlog'] = { type: 1, session: true };
api['/api/admin/user/suspend/commit'] = { type: 1, session: true };
api['/api/admin/user/suspend/delete'] = { type: 1, session: true };

api['/api/agent/find'] = { session: false };
api['/api/agent/register/commit'] = { session: false };
api['/api/agent/register/send'] = { session: false };
api['/api/agent/token'] = { session: false };
api['/api/agent/user/bind/agent'] = { type: 1, session: true };
api['/api/agent/paystats'] = { session: true };

api['/api/finace/withdraw/submit'] = { session: false };
api['/api/finace/withdraw/records'] = { session: true };
api['/api/finace/withdraw/audit'] = { session: true };
api['/api/finace/withdraw/lock'] = { session: true };
api['/api/finace/pay/records'] = { session: true };
api['/api/finace/pay/manual'] = { session: false };
api['/api/finace/pay/order'] = { session: false };
api['/api/finace/pay/order/result'] = { session: false };
api['/api/finace/pay/order/ad'] = { session: false };
api['/api/finace/pay/order/union'] = { session: false };
api['/api/finace/item/records'] = { session: false };
api['/api/finace/pay/getpayurl'] = { session: false };
api['/api/finace/pay/undo'] = { session: true };
api['/api/finace/pay/ingore'] = { session: true };
api['/api/finace/pay/channels'] = { session: false };
api['/api/finace/pay/channels/vip'] = { session: false };

api['/api/settings/config'] = { session: false };
api['/api/settings/edit_setting'] = { session: false };
api['/api/settings/del_setting'] = { session: false };
api['/api/settings/settings'] = { session: false };
api['/api/settings/withdraw/edit_channel'] = { session: false };
api['/api/settings/withdraw/del_channels'] = { session: false };
api['/api/settings/withdraw/channels'] = { session: false };
api['/api/settings/pay/edit_channel'] = { session: false };
api['/api/settings/pay/del_channels'] = { session: false };
api['/api/settings/pay/channels'] = { session: false };
api['/api/settings/pay/channels/union'] = { session: false };
api['/api/settings/pay/channel/kinds'] = { session: false };
api['/api/settings/pay/kinds'] = { session: false };
api['/api/settings/level'] = { session: false };
api['/api/settings/tuiguanghost'] = { session: false };
api['/api/settings/qr'] = { session: false };
api['/api/settings/addvalue'] = { session: false };
api['/api/settings/game/setting'] = { session: false };
api['/api/settings/game/change/open'] = { session: false };
api['/api/settings/payinfo'] = { session: false };


api['/api/room/records'] = { session: false };
api['/api/room/record/round/detail'] = { session: false };
api['/api/room/record/round/thumbnails'] = { session: false };

api['/api/sdk/audio'] = { session: false };
api['/api/sdk/eth/mine'] = { session: false };
api['/api/sdk/ofb/agent'] = { session: false };
api['/api/sdk/ofb/user'] = { session: false };

api['/api/user/achieve/children'] = { session: false };
api['/api/user/achieve/self'] = { session: false };
api['/api/user/rebate/children'] = { session: false };
api['/api/user/rebate/self'] = { session: false };
api['/api/user/buy'] = { session: false };
api['/api/user/feedback'] = { session: false };
api['/api/user/find'] = { session: false };
api['/api/user/login/info'] = { session: true };
api['/api/user/login/token'] = { session: false };
api['/api/user/mail/delete'] = { session: false };
api['/api/user/mail/details'] = { session: false };
api['/api/user/mail/read'] = { session: false };
api['/api/user/mail/receive'] = { session: false };
api['/api/user/mall/order'] = { session: false };
api['/api/user/message/list'] = { session: false };
api['/api/user/announce/details'] = { session: false };
api['/api/user/info/commit'] = { session: false };
api['/api/user/password/commit'] = { session: false };
api['/api/user/password/send'] = { session: false };
api['/api/user/password2/commit'] = { session: false };
api['/api/user/password2/send'] = { session: false };
api['/api/user/register/commit'] = { session: false };
// api['/api/user/register/account/commit'] = { session: false };
api['/api/user/register/send'] = { session: false };
api['/api/user/register/send/action'] = { session: false };
api['/api/user/register/agent/bind'] = { session: false };
api['/api/user/bind/phone/commit'] = { session: false };
api['/api/user/bind/phone/send'] = { session: false };
api['/api/user/bind/account'] = { session: false };
api['/api/user/bind/agent'] = { session: false };
api['/api/user/roundabout/free'] = { session: false };
api['/api/user/roundabout/diamond'] = { session: false };
api['/api/user/roundabout/remain'] = { session: false };
api['/api/user/item'] = { session: false };
api['/api/user/item/records'] = { session: false };
api['/api/user/property/rank'] = { session: false };
api['/api/user/single/rank'] = { session: false };
api['/api/user/bank/list'] = { session: false };
api['/api/user/login/records'] = { session: false };
api['/api/user/belongto'] = { session: false };
api['/api/user/shareurl'] = { session: false };
api['/api/user/mytuiguang'] = { session: false };
api['/api/user/recommend'] = { session: false };
api['/api/user/recommend/qrcode'] = { session: false };

api['/api/statistics/report/pay'] = { session: true };
api['/api/statistics/ykbb'] = { session: true };
api['/api/statistics/hybb'] = { session: true };
api['/api/statistics/ykbb_compute'] = { session: false };
api['/api/statistics/rebate_compute'] = { session: false };

api['/api/nn/recommender/details'] = { session: false };
api['/api/nn/recommender/thumbnail'] = { session: false };

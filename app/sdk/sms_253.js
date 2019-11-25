var request = require('request');

// 修改为您的短信账号
var account = "I0467561";
// 修改为您的短信密码
var password = "bX7IjZpT0W2a6e";

// 短请求地址请登录253云通讯自助通平台查看或者询问您的商务负责人获取
var sms_host = 'http://intapi.253.com';
// 发送短信地址
var send_sms_uri = '/send/json';

// 发送短信方法
module.exports.send = (phone, content) => {
    console.log('==send2==')
    // 这是需要提交的数据 
    let post_data = {
        'account': account,
        'password': password,
        'msg': content,
        'mobile': phone,
    };

    post_data = JSON.stringify(post_data);

    request({
        url: sms_host + send_sms_uri,
        method: "POST",
        headers: {
            "Content-Type": "application/json;charset=UTF-8",
        },
        body: post_data
    }, (err, resp, body) => {
        console.debug('sms_253 send: ', body);
    });
};
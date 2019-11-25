const request = require('request');


let configuration = {
    /*
     * service接口配置
     */
    timestampConfig : {
        timestamp_uri: "https://api.mysubmail.com/service/timestamp.json"
    },
    /*
     * 邮件配置
     */
    mailConfig : {
        xsend_uri : 'https://api.mysubmail.com/mail/xsend.json',
        send_uri  : 'https://api.mysubmail.com/mail/send.json',
        subscribe_uri : 'https://api.mysubmail.com/addressbook/mail/subscribe.json',
        unsubscribe_uri : 'https://api.mysubmail.com/addressbook/mail/unsubscribe.json',
        appid: 'your mail appid',
        appkey: 'your mail appkey',
        signtype: 'normal'     /*可选参数normal,md5,sha1*/
    },
    /*
     * 短信配置
     */
    messageConfig : {
        xsend_uri : 'https://api.mysubmail.com/message/xsend.json',
        send_uri  : 'https://api.mysubmail.com/message/send.json',
        multiXsend_uri : 'https://api.mysubmail.com/message/multixsend.json',
        subscribe_uri : 'https://api.mysubmail.com/addressbook/message/subscribe.json',
        unsubscribe_uri : 'https://api.mysubmail.com/addressbook/message/unsubscribe.json',
        template_uri : 'https://api.mysubmail.com/message/template.json',
        appid : '19652',
        appkey : '269741e55da4290bc961fbe09011559a',
        signtype : 'normal'   /*可选参数normal,md5,sha1*/
    },
    /*
     * 语音配置
     */
    voiceConfig : {
        code_uri : 'https://api.mysubmail.com/voice/verify',
        xsend_uri : 'https://api.mysubmail.com/voice/xsend.json',
        send_uri  : 'https://api.mysubmail.com/voice/send.json',
        multiXsend_uri : 'https://api.mysubmail.com/voice/multixsend.json',
        appid : 'your voice appid',
        appkey : 'your voice appkey',
        signtype : 'md5'   /*可选参数normal,md5,sha1*/
    },
    /*
     * 国际短信配置
     */
    inter_smsConfig : {
        xsend_uri : 'https://api.mysubmail.com/internationalsms/xsend.json',
        send_uri  : 'https://api.mysubmail.com/internationalsms/send.json',
        multiXsend_uri : 'https://api.mysubmail.com/internationalsms/multixsend.json',
        appid : 'your message appid',
        appkey : 'your voice appkey',
        signtype : 'normal'    /*可选参数normal,md5,sha1*/
    }

};


module.exports.send = (params) => {
    request({method: 'GET', uri: configuration.timestampConfig.timestamp_uri}, (err, res, body) => {
        if(err) {
            console.error('sms_SZ send: request timestamp error');
            return;
        }

        try {
            body = JSON.parse(body);
            params.appid = configuration.messageConfig.appid;
            params.timestamp = body.timestamp;
            params.sign_type = configuration.messageConfig.signtype;
            params.signature = configuration.messageConfig.appkey;
            console.log(params);
            request.post({url: configuration.messageConfig.send_uri, formData: params}, (err, res, body) => {
                if (err) {
                    return console.error(err);
                }
                console.log(body);
            });
        } catch(e) {
            console.error('sms_SZ send: parse body error');
        }
    });
};

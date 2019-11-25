let util = module.exports = {};



util.toEth = (wei, r = 18) => {
    let sps = wei.split('');
    while(sps.length < r) {
        sps.splice(0, 0, '0');
    }

    let d = sps.length - r - 1;
    let n = (d < 0) ? ['0'] : sps.slice(0, d + 1);
    let f = sps.slice(d + 1);
    while(f.length > 0) {
        if(f[f.length - 1] !== '0') {
            break;
        }

        f.pop();
    }
    return n.join('') + ((f.length === 0) ? '' : ('.' + f.join('')));
};


util.toWei = (eth, r = 18) => {
    let [n, f] = eth.split('.');

    f = f ? f.split('') : [];
    while(f.length < r) {
        f.push('0');
    }

    return n + f.join('')
};

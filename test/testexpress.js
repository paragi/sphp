/* jshint -W097 */// jshint strict:false
/*jslint node: true */
var expect = require('chai').expect;
var path = require('path');
var request = require('request');

var express = require('express');
var sphp = require('../sphp');

var serving = false;
describe('Test Express only', function() {
    before('Setup Server', function (_done) {
        this.timeout(600000); // because of first install from npm

        var app = express();
        if (process.env.PHP_PATH && process.env.PHP_PATH !== "") {
            sphp.cgiEngine = process.env.PHP_PATH;
        }

        var doc_root = __dirname + path.sep + 'doc_root/';
        var server = app.listen(20000, function() {
            console.log('SPHP Server started on port 20000 with Doc-Root ' + doc_root);
            serving = true;
        });

        app.use(sphp.express(doc_root));
        app.use(express.static(doc_root));

        _done();
    });

    it('Test phpinfo()', function (done) {
        request('http://127.0.0.1:20000/phpinfo.php', function (error, response, body) {
            console.log('BODY: ' + body);
            expect(serving).to.be.true;
            expect(error).to.be.not.ok;
            expect(body.indexOf('<title>phpinfo()</title>')).to.be.not.equal(-1);
            expect(response.statusCode).to.equal(200);
            done();
        });
    });

    after('Stop Server', function (done) {
        this.timeout(10000);
        try {
            if (serving) {
                app.close();
                console.log('SPHP Server stopped');
            }
        } catch (e) {
        }
        done();
    });
});

"use strict";

/*
 * MIT License http://www.opensource.org/licenses/mit-license.php
 */

var chai = require("chai");
var webpack = require("webpack");
var fs = require("fs");
var rimraf = require("rimraf");
var Path = require("path");
var Config = require("../../lib/config");
var expect = chai.expect;
var webpackConfig = require("../webpack.config");

var extendRequire = require("../../lib/extend-require");
var clone = require("clone");

describe("isomorphic extend", function () {
    function cleanup() {
        rimraf.sync(Path.resolve("test/dist"));
        rimraf.sync(Path.resolve(Config.configFile));
    }

    function generate(config, callback) {
        if (!callback) {
            callback = config;
            config = webpackConfig;
        }
        var compiler = webpack(config);
        compiler.run(function (err, stats) {
            stats.toString();
            callback(err);
        });
    }

    before(cleanup);
    afterEach(cleanup);

    it("should generate assets file", function (done) {
        generate(function () {
            var assets = JSON.parse(fs.readFileSync(Path.resolve("test/dist/isomorphic-assets.json")));
            expect(fs.existsSync(Path.resolve(".isomorphic-loader-config.json"))).to.equal(true);
            var expected = {
                "test/client/images/smiley.jpg": "d04306b61740c68d4f09a015487b3460.jpg",
                "test/client/images/smiley2.jpg": "d04306b61740c68d4f09a015487b3460.jpg",
                "test/client/images/smiley.png": "34c7cd87f32ffa7479a1b5806769d325.png",
                "test/client/images/smiley.svg": "47869791f9dd9ef1be6e258e1a766ab8.svg",
                "test/client/data/foo.bin": "71f74d0894d9ce89e22c678f0d8778b2.bin"
            };
            expect(assets).to.deep.equal(expected);
            done();
        });
    });

    function verifyRequireAssets(publicPath) {
        publicPath = publicPath === undefined ? "/test/" : publicPath;

        var smiley = require("../client/images/smiley.jpg");
        var smiley2 = require("../client/images/smiley2.jpg");
        var smileyFull = require(Path.resolve("test/client/images/smiley.jpg"));
        var smileyPng = require("../client/images/smiley.png");
        var smileySvg = require("../client/images/smiley.svg");
        var fooBin = require("file!isomorphic!../client/data/foo.bin");
        var expectedUrl = publicPath + "d04306b61740c68d4f09a015487b3460.jpg";

        expect(smiley).to.equal(expectedUrl);
        expect(smiley2).to.equal(expectedUrl);
        expect(smileyFull).to.equal(expectedUrl);
        expect(smileyPng).to.equal(publicPath + "34c7cd87f32ffa7479a1b5806769d325.png");
        expect(smileySvg).to.equal(publicPath + "47869791f9dd9ef1be6e258e1a766ab8.svg");
        expect(fooBin).to.equal(publicPath + "71f74d0894d9ce89e22c678f0d8778b2.bin");
    }

    function verifyExtend(callback) {
        extendRequire(function () {
            verifyRequireAssets();
            callback();
        });
    }

    function verifyExtendPromise(callback) {
        extendRequire().then(verifyRequireAssets).then(callback);
    }

    it("should extend require", function (done) {
        generate(function () {
            verifyExtend(done);
        });
    });

    it("should wait for generate", function (done) {
        verifyExtend(done);
        setTimeout(function () {
            generate(function () {
            });
        }, Config.pollConfigInterval + 1);
    });

    it("should support Promise", function (done) {
        if (typeof Promise !== "undefined") {
            generate(function () {
                verifyExtendPromise(done);
            });
        } else {
            console.log("Promise not defined.  Skip test.");
            done();
        }
    });

    it("should fail to load if config doesn't exist", function (done) {
        delete require.cache[require.resolve("../../lib/extend-require")];
        extendRequire = require("../../lib/extend-require");
        extendRequire.loadAssets(function (err) {
            expect(err).to.be.ok;
            done();
        });
    });

    it("should fail to load if assets file doesn't exist", function (done) {
        generate(function () {
            rimraf.sync(Path.resolve("test/dist"));
            extendRequire.loadAssets(function (err) {
                expect(err).to.be.ok;
                done();
            });
        });
    });

    it("should fail to load if assets file is invalid", function (done) {
        generate(function () {
            fs.writeFileSync(Path.resolve("test/dist/isomorphic-assets.json"), "bad");
            extendRequire.loadAssets(function (err) {
                expect(err).to.be.ok;
                done();
            });
        });
    });


    it("should fail to extend if config file is invalid (Promise)", function () {
        if (typeof Promise === "undefined") {
            console.log("Promise not defined.  Skip test.");
            return;
        }

        fs.writeFileSync(Path.resolve(Config.configFile), "bad");
        return extendRequire()
            .then(function () {
                chai.assert(false, "expected error");
            }, function (err) {
                expect(err).to.be.ok;
            });
    });

    it("should fail to extend if config file is invalid (callback)", function (done) {
        fs.writeFileSync(Path.resolve(Config.configFile), "bad");
        extendRequire(function (err) {
            expect(err).to.be.ok;
            done();
        });
    });

    it("should handle undefined publicPath", function (done) {
        var config = clone(webpackConfig);
        delete config.output.publicPath;
        generate(config, function () {
            extendRequire(function () {
                verifyRequireAssets("");
                done();
            });
        });
    });

    it("should handle empty publicPath", function (done) {
        var config = clone(webpackConfig);
        config.output.publicPath = "";
        generate(config, function () {
            extendRequire(function () {
                verifyRequireAssets("");
                done();
            });
        });
    });

    it("should fail if config version and package version mismatch", function (done) {
        generate(function () {
            var config = JSON.parse(fs.readFileSync(Path.resolve(Config.configFile)));
            config.version = "0.0.1";
            extendRequire(config, function (err) {
                expect(err).to.be.ok;
                done();
            });
        });
    });
});

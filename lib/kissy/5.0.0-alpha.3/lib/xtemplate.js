/**
 * @ignore
 * load tpl from file in nodejs
 * @author yiminghe@gmail.com
 */

var S = require('./loader');
var util = require('./util');
var fs = require('fs');
var Path = require('path');
var iconv;

try {
    iconv = require('iconv-lite');
} catch (e) {
}

var XTemplate = S.nodeRequire('xtemplate');

var globalConfig = {
    encoding: 'utf-8'
};

function normalizeSlash(path) {
    if (path.indexOf('\\') !== -1) {
        path = path.replace(/\\/g, '/');
    }
    return path;
}

function merge(config) {
    var ret = {};
    for (var i in globalConfig) {
        ret[i] = globalConfig[i];
    }
    if (config) {
        for (i in config) {
            ret[i] = config[i];
        }
    }
    return ret;
}

var fileCache = {};
var instanceCache = {};

function getInstance(path, config, callback) {
    var cache = config.cache;
    if (cache && instanceCache[path]) {
        return callback(0, instanceCache[path]);
    }
    readFile(path, config, function (error, tpl) {
        if (error) {
            callback(error);
        } else {
            var instance = new XTemplate(tpl, config);
            if (cache) {
                instanceCache[path] = instance;
            }
            callback(undefined, instance);
        }
    });
}

function readFile(path, config, callback) {
    var cache = config.cache;
    var encoding = config.encoding;
    if (cache && fileCache[path]) {
        return callback(null, fileCache[path]);
    }
    if (encoding === 'utf-8') {
        fs.readFile(path, {
            encoding: encoding
        }, function (error, content) {
            if (error) {
                callback(error);
            } else {
                if (cache) {
                    fileCache[path] = content;
                }
                callback(undefined, content);
            }
        });
    } else if (iconv) {
        fs.readFile(path, function (error, buf) {
            if (error) {
                callback(error);
            } else {
                var content = iconv.decode(buf, encoding);
                if (cache) {
                    fileCache[path] = content;
                }
                callback(undefined, content);
            }
        });
    } else {
        callback('encoding: ' + encoding + ', npm install iconv-lite, please!');
    }
}

var loader = {
    load: function (template, path, callback) {
        template.extName = template.extName || Path.extname(template.config.name);
        var pathExtName = Path.extname(path);
        if (!pathExtName) {
            pathExtName = template.extName;
            path += pathExtName;
        }
        var rootConfig = template.config;
        if (pathExtName && pathExtName !== template.extName) {
            readFile(path, rootConfig, callback);
        } else {
            readFile(path, rootConfig, function (err, content) {
                if (err) {
                    callback(err);
                } else {
                    var tpl = content;
                    if (pathExtName === template.extName) {
                        try {
                            tpl = template.compile(content, path);
                        } catch (e) {
                            return callback(e);
                        }
                    }
                    callback(null, tpl);
                }
            });
        }
    }
};

function renderFile(path, options, callback) {
    path = normalizeSlash(path);

    var encoding = options.settings && options.settings['view encoding'];

    try {
        var config = {
            name: path,
            loader: loader,
            cache: options.cache
        };
        if (encoding) {
            config.encoding = encoding;
        }

        config = merge(config);

        getInstance(path, config, function (error, engine) {
            if (error) {
                callback(error);
            } else {
                // runtime commands
                engine.render(options, {commands: options.commands}, callback);
            }
        });
    } catch (e) {
        callback(e);
    }
}

/**
 * load xtemplate from file on nodejs
 * @singleton
 */
module.exports = {
    config: function (options) {
        util.mix(globalConfig, options);
    },

    XTemplate: XTemplate,

    __express: renderFile,

    renderFile: renderFile,

    clearCache: function (path) {
        var content = fileCache[path];
        delete instanceCache[path];
        if (content !== undefined) {
            delete fileCache[path];
            XTemplate.clearCache(content);
        }
    }
};


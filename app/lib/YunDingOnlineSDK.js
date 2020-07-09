define(['protocol'], function (Protocol) {

    /**
     * 一些常量
     */
    const JS_WS_CLIENT_TYPE = 'js-websocket';
    const JS_WS_CLIENT_VERSION = '0.0.1';

    /**
     * 返回消息状态码
     */
    const RES_OK = 200;         // 成功
    const RES_FAIL = 500;       // 失败
    const RES_OLD_CLIENT = 501; // 客户端版本不符

    const gapThreshold = 100;   // heartbeat gap threashold

    /**
     * {object} 默认配置
     */
    let default_config = {
        gameHost: 'yundingxx.com',
        gameProtocol: 'ws',
        loginPort: 3014,
        gamePort: 3052,
        loginServer: null,
        gameServer: null,
        socketPathTpl: '{protocol}://{host}:{port}/'
    };

    let Package = Protocol.Package,
        Message = Protocol.Message;

    /**
     * 工具类
     */
    let Tool = {
        /**
         * 替换字符串中的变量占位符
         *
         * @param {string} str           需要替换的字符串
         * @param {object} replaceMaps   替换关系
         */
        replaceParams: function (str, replaceMaps) {
            return str.replace(/{([^}]+)}/g, function (full_match, key) {
                return replaceMaps[key] || full_match;
            });
        }
    }

    /**
     * YunDingXX Online API
     *
     * @param {object} config   配置信息
     */
    let GameApi = function (config) {
        // 加载配置
        if ('object' == typeof config || 'undefined' == typeof config) {
            this.config = Object.assign(default_config, config);
        }

        // 初始化配置
        this.initConfig();
    };

    /**
     * 初始化配置信息
     */
    GameApi.prototype.initConfig = function () {
        // WebSocket 链接对象
        this.socket = null;

        // 玩家信息都存在这里
        this.user_info = {};
        this.token = null;

        // 生成服务器链接地址
        if (!this.config.loginServer) {
            this.config.loginServer = this.getSocketServer(this.config.loginPort);
        }

        // 消息处理分发
        this.messageHandlers = [];
        this.messageHandlers[Package.TYPE_HANDSHAKE] = this.onHandshake;
        this.messageHandlers[Package.TYPE_HEARTBEAT] = this.onHeartbeat;
        this.messageHandlers[Package.TYPE_DATA] = this.onData;
        this.messageHandlers[Package.TYPE_KICK] = this.onKick;

        // 维持心跳
        this.reqId = 1;
        this.heartbeatInterval = 0;
        this.heartbeatId = null;
        this.heartbeatTimeoutId = null;
        this.heartbeatTimeout = 0;

        // 路由字典
        this.dict = {};
        this.abbrs = {};

        // 协议相关???
        this.protoVersion = 0;
        this.serverProtos = {};
        this.clientProtos = {};

        // 握手成功的回调
        this.initCallback = null;
        this.callbacks = [];    // seqId
        this.callRoutes = [];

        // 注册各路由的回调钩子
        this.hookHandlers = {
            "connector.loginHandler.login": [
                CoreHooks.onLoginGame
            ]
        };
    }

    /**
     * 生成服务器链接地址
     * @param {*} port
     */
    GameApi.prototype.getSocketServer = function (port, host, protocol) {
        if ('number' != typeof port) {
            return null;
        }

        return Tool.replaceParams(this.config.socketPathTpl, {
            protocol: protocol || this.config.gameProtocol,
            host: host || this.config.gameHost,
            port: port
        });
    }

    /**
     * 注册路由回调钩子
     * @param {string}   route      挂载的路由地址
     * @param {function} cb         回调
     * @param {string}   position   用于 触发时机 暂不可用
     */
    GameApi.prototype.regHookHandler = function (route, cb, position) {

    }


    /**
     * 启动实例
     */
    GameApi.prototype.start = function () {
        if (this.socket) {
            return;
        }
        // 建立 ws 链接
        this.createWebSocket(this.config.loginServer);
    }

    /**
     * 创建一个 WebSocket 连接并初始化
     *
     * @param {string} url 服务地址 ws://host:prot/path
     */
    GameApi.prototype.createWebSocket = function (url) {
        // 创建对象
        let socket = new WebSocket(url);

        // 指定传输数据类型
        socket.binaryType = 'arraybuffer';

        /**
         * 批量绑定相关回调事件
         */
        let bindEvents = {
            open: this.onOpen,
            message: this.onMessage,
            error: this.onError,
            close: this.onClose
        };

        // 遍历事件列表 添加 绑定
        Object.keys(bindEvents).map((enevtName) => {
            socket.addEventListener(enevtName, (event) => {
                bindEvents[enevtName].call(this, event);
            });
        });

        // 将 reqId 重置
        this.reqId = 1;
        this.socket = socket;

        return socket;
    }

    /**
     * WebSocket 建立连接的回调
     *
     * @param {object} event
     */
    GameApi.prototype.onOpen = function (event) {
        // 发送握手包
        this.handShake();
    };

    /**
     * WebSocket 收到消息时的回调
     * @param {object} event
     */
    GameApi.prototype.onMessage = function (event) {
        let messages = Package.decode(event.data);
        if (messages.type != 3) {
            // console.log('onMessage', messages);
        }

        // 根据事件类型分发到对应的处理程序
        if (Array.isArray(messages)) {
            for (let i = 0; i < messages.length; i++) {
                let msg = messages[i];
                this.messageHandlers.call(this, [msg.type](msg.body));
            }
        } else {
            this.messageHandlers[messages.type].call(this, messages.body);
        }

        // 重新计算心跳包时间
        if (this.heartbeatTimeout) {
            this.nextHeartbeatTimeout = Date.now() + this.heartbeatTimeout;
        }
    };

    /**
     * WebSocket 报错时的回调
     *
     * @param {object} event
     */
    GameApi.prototype.onError = function (event) {
        console.log('onError', event);
    };

    /**
     * WebSocket 断开时的回调
     *
     * @param {object} event
     */
    GameApi.prototype.onClose = function (event) {
        console.log('onClose', event);
    };

    /**
     * 发送消息到服务器(自动处理编码信息)
     *
     * @param {object} data
     * @param {string} type
     */
    GameApi.prototype.sendMessage = function (data, route, cb) {
        // 分析参数
        if (arguments.length == 2 && 'function' == typeof route) {
            cb = route;
            route = null;
        }

        // 解包消息
        let bytes = Protocol.strencode(JSON.stringify(data)),
            pkg_type = Package.TYPE_HANDSHAKE,
            routeId = null;

        // 分析路由情况
        if ('string' == typeof route) {
            // 是否压缩路由 (存在 Dict 的就压缩)
            let compressRoute = 0;
            if (this.dict && this.dict[route]) {
                routeId = this.dict[route];
                compressRoute = 1;
            }

            // 然后生成 Message
            let reqId = this.reqId++ % 255;
            let type = reqId ? Message.TYPE_REQUEST : Message.TYPE_NOTIFY;

            // 设置回调
            if ('function' == typeof cb) {
                this.callbacks[reqId] = cb;
            }

            // 设置回调路由表
            this.callRoutes[reqId] = route;

            // 将消息打包
            bytes = Message.encode(reqId, type, compressRoute, compressRoute ? routeId : route, bytes);
            pkg_type = Package.TYPE_DATA;
        }

        // 封装到最终格式
        let packet = Package.encode(pkg_type, bytes);

        // 发出封包 这里应该有发送失败的处理
        this.socket.send(packet);
    }

    /**
     * 处理握手返回包
     *
     * @param {*} data
     */
    GameApi.prototype.onHandshake = function (data) {
        // 解码数据
        data = JSON.parse(Protocol.strdecode(data));
        console.log('onHandshake', data);

        // 报错的话
        if (data.code === RES_OLD_CLIENT) {
            throw new Error('client version not fullfill');
            return;
        }

        // 其他错误
        if (data.code !== RES_OK) {
            throw new Error('handshake fail');
            return;
        }

        // 要发送握手回复
        let packet = Package.encode(Package.TYPE_HANDSHAKE_ACK);
        this.socket.send(packet);

        // 保存心跳时间
        if (data.sys && data.sys.heartbeat) {
            // 超时信息
            this.heartbeatInterval = data.sys.heartbeat * 1000;   // heartbeat interval
            this.heartbeatTimeout = this.heartbeatInterval * 2;        // max heartbeat timeout

            // 保存字典
            let dict = data.sys.dict;

            // Init compress dict
            if (dict) {
                this.dict = dict;
                this.abbrs = {};

                for (let route in dict) {
                    this.abbrs[dict[route]] = route;
                }
            }
        }

        // 保存 protos 信息
        if (data.sys && data.sys.protos) {
            let protos = data.sys.protos;

            // Init protobuf protos
            if (protos) {
                this.protoVersion = protos.version || 0;
                this.serverProtos = protos.server || {};
                this.clientProtos = protos.client || {};
            }
        }

        // if (typeof handshakeCallback === 'function') {
        //     handshakeCallback(data.user);
        // }

        // 握手成功有回调的话
        if (this.initCallback) {
            this.initCallback.call(this);
            this.initCallback = null;
        }
    };

    /**
     * 保持心跳
     */
    GameApi.prototype.onHeartbeat = function () {
        if (!this.heartbeatInterval) {
            // no heartbeat
            return;
        }

        let packet = Package.encode(Package.TYPE_HEARTBEAT);
        if (this.heartbeatTimeoutId) {
            clearTimeout(this.heartbeatTimeoutId);
            this.heartbeatTimeoutId = null;
        }

        if (this.heartbeatId) {
            // already in a heartbeat interval
            return;
        }
        this.heartbeatId = setTimeout(() => {
            this.heartbeatId = null;
            this.socket.send(packet);;

            this.nextHeartbeatTimeout = Date.now() + this.heartbeatTimeout;
            this.heartbeatTimeoutId = setTimeout(this.heartbeatTimeoutCb, this.heartbeatTimeout);
        }, this.heartbeatInterval);
    };

    /**
     * 心跳超时的回调
     */
    GameApi.prototype.heartbeatTimeoutCb = function () {
        let gap = this.nextHeartbeatTimeout - Date.now();
        if (gap > gapThreshold) {
            this.heartbeatTimeoutId = setTimeout(this.heartbeatTimeoutCb, gap);
        } else {
            console.error('server heartbeat timeout');
        }
    };

    /**
     * 收到数据回复
     *
     * @param {*} data
     */
    GameApi.prototype.onData = function (data) {
        let msg = Message.decode(data),
            route = null;

        // 从发包请求中取回 Route
        if (!msg.route && msg.id && this.callRoutes[msg.id]) {
            msg.route = route = this.callRoutes[msg.id];
        }

        // 解码 Body
        msg.body = JSON.parse(Protocol.strdecode(msg.body));
        console.log('onData', msg);

        // 检查是否有回调
        let cbMark = [];
        if ('function' == typeof this.callbacks[msg.id]) {
            let cb = this.callbacks[msg.id];
            delete this.callbacks[msg.id];
            if ('string' == typeof cb.hookMark) {
                cbMark.push(cb.hookMark);
            }

            cb.call(this, msg.body);
        }

        // 检查钩子
        if (route && 'object' == typeof this.hookHandlers[route]) {
            for (let i = 0; i < this.hookHandlers[route].length; i++) {
                const cb = this.hookHandlers[route][i];
                if ('string' == typeof cb.hookMark) {
                    if (cbMark.indexOf(cb.hookMark) >= 0) {
                        continue;
                    }
                    cbMark.push(cb.hookMark);
                }

                cb.call(this, msg.body);
            }
        }
    };

    /**
     * 被踢么？
     *
     * @param {*} data
     */
    GameApi.prototype.onKick = function (data) {
        console.log('onKick', data);
    };

    //======= 下面是游戏事件封装区 =======//

    /**
     * 发送握手包
     *
     * WebSocket 链接成功后自动发送
     */
    GameApi.prototype.handShake = function () {
        let handshakeBuffer = {
            'sys': {
                type: JS_WS_CLIENT_TYPE,
                version: JS_WS_CLIENT_VERSION,
                rsa: {},
                protoVersion: this.protoVersion
            }
        };

        this.sendMessage(handshakeBuffer);
    }

    /**
     * 登录游戏
     *
     * @param {*} email
     * @param {*} pwd
     * @param {*} code
     */
    GameApi.prototype.login = function (email, pwd, code, is_r) {
        let route = 'gate.gateHandler.queryEntry',
            data = {
                login_email: email,
                login_pwd: pwd,
                code: '',
                is_r: true
            };

        // 设置握手回调
        this.initCallback = function () {
            // 尝试保存账号
            this.user_info.email = email;
            // 设置消息回调
            this.sendMessage(data, route, this.onLogin);
        }
        this.start();
    }

    /**
     * 登录成功的回调
     *
     * @param {*} data
     */
    GameApi.prototype.onLogin = function (data) {
        if (data.code != RES_OK) {
            console.log('onLogin', data.msg);
            return;
        }
        console.log('onLogin', data)

        // 保存端口等信息
        this.config.gamePort = data.port;
        this.user_info.mid = data.mid;
        this.token = data.token;

        // 断开登录链接 重新连接到游戏服务器
        this.socket.close();
        this.gameServer = this.getSocketServer(data.port);
        this.initCallback = this.loginToken;
        this.createWebSocket(this.gameServer);
    }

    /**
     * 使用 Token 登录游戏服务器
     */
    GameApi.prototype.loginToken = function () {
        console.log('loginToken');
        let route = 'connector.loginHandler.login',
            data = {
                email: this.user_info.email,
                token: this.token
            };

        // 先清空工作台
        console.clear();

        // 如果登录成功 则清空控制台
        this.sendMessage(data, route, () => {
            console.log('登录到游戏服务器成功', this);
        });
    }

    /**
     * Hooks 默认的
     */
    let CoreHooks = {
        /**
         * 登录游戏成功回调
         * @param {*} data
         */
        onLoginGame: function (data) {
            console.log('onLoginGame', data);
        }
    }
    // 给绑定 Mark
    Object.keys(CoreHooks).forEach((name) => {
        CoreHooks[name].prototype.hookMark = 'Core.' + name;

    })

    return GameApi;
});

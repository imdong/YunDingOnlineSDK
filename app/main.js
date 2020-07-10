(function (exports) {
    // 定义加载源
    require.config({
        baseUrl: './',
        paths: {
            vue: 'https://cdn.jsdelivr.net/npm/vue@2.6.11/dist/vue',
            axios: 'https://cdn.jsdelivr.net/npm/axios@0.19.2/dist/axios.min',
            ELEMENT: 'https://cdn.jsdelivr.net/npm/element-ui@2.13.2/lib/index',
            'element-ui-theme': 'https://cdn.jsdelivr.net/npm/element-ui@2.13.2/lib/theme-chalk/index',
            YunDingOnlineSDK: 'app/lib/YunDingOnlineSDK',
            'app-main': 'templates/main.html',
            'app-config': 'app/config.json',
            'app-style': 'assets/style',
            protocol: 'app/lib/protocol'
        },
        map: {
            '*': {
                'css': 'https://cdn.jsdelivr.net/npm/require-css@0.1.10/css.js',
                'data': 'app/lib/require-data.js'
            }
        }
    });

    let require_list = [
        // 模板相关
        'data!app-main', 'data!app-config',
        // 插件相关
        'YunDingOnlineSDK', 'vue', 'axios', 'ELEMENT',
        // 额外样式动态引用
        'css!app-style', 'css!element-ui-theme'
    ];

    // 启动项目
    requirejs(require_list, function (tpl, config, GameApi, Vue, axios, ELEMENT) {
        // 手动注册 Element-UI 到 Vue
        ELEMENT.install(Vue);

        // 创建空函数 屏蔽 onLeave onAdd 消息刷屏
        let emptyCb = () => { };
        emptyCb.hookMark = 'emptyCb';
        GameApi.regHookHandlers['onLeave'].push(emptyCb);
        GameApi.regHookHandlers['onAdd'].push(emptyCb);

        // 接管登录成功的回调
        let loginCb = function (data) {
            let index = this.user_index,
                email = this.email;

            // 检查错误
            if (data.code != 200) {
                app.user_list[index].status = "登录失败";
                app.user_list[index].status_msg = data.msg;
                return;
            }
            // 登录成功
            app.user_list[index].status = '登录成功';

            // 没有数据就不在继续了
            if ('object' != typeof data.data) {
                return;
            }
            // 记录地图位置
            app.$set(app.user_list[index], 'map', data.data.map);
        }
        loginCb.hookMark = "loginCb";
        GameApi.regHookHandlers['gate.gateHandler.queryEntry'].push(loginCb);
        GameApi.regHookHandlers['connector.loginHandler.login'].push(loginCb);

        // 移动地图的返回
        let moveToNewMapCb = function (data) {
            // 更新地图位置
            app.$set(app.user_list[this.user_index], 'map', data.map);
            console.log('moveToNewMapCb', data);
        };
        moveToNewMapCb.hookMark = "moveToNewMapCb";
        GameApi.regHookHandlers['connector.playerHandler.moveToNewMap'].push(moveToNewMapCb);

        // 创建 View
        let app = new Vue({
            el: '#app',
            template: tpl,
            data: {
                login_form: {},
                user_list: [],
                login_rules: {
                    // 账号不能重复
                    email: {
                        validator: function (rule, value, callback) {
                            // 检查用户是否存在
                            app.user_list.forEach((item) => {
                                if (item.email == value) {
                                    callback(new Error('账号已经存在'));
                                    return;
                                }
                            })
                            callback();
                        },
                        trigger: 'blur'
                    }
                }
            },
            // 创建完毕回调
            mounted: function () {
                // 创建 game_list (不希望被 Vue 解析)
                this.game_list = {};
                this.config = config;
            },
            computed: {
                nextMap: function (event) {
                    console.log('nextMap', event, this);
                    return 'loading...';
                }
            },
            methods: {
                onAddUser: function (event) {
                    // 验证表单
                    this.$refs['loginForm'].validate((valid) => {
                        if (!valid) {
                            return;
                        }
                    });

                    let game = new GameApi(),
                        email = this.login_form.email;

                    // 添加到用户列表
                    game.user_index = this.user_list.push({
                        email: email,
                        status: '已添加'
                    }) - 1;

                    // 登录账号
                    game.login(email, this.login_form.password);

                    // 保存起来
                    this.game_list[email] = game;
                },
                // 移动到新地图
                moveToNewMap: function (row, mid) {
                    this.game_list[row.email].moveToNewMap(mid);
                }
            }
        });

        // 暴露到全局
        exports.app = app;
        exports.GameApi = GameApi;
    });

})(window);

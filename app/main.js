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
            regHooks: 'app/regHooks',
            'app-main': 'templates/main.html',
            'app-config': 'app/config.json',
            'app-style': 'assets/style',
            'ali-icon': '//at.alicdn.com/t/font_1936453_g8yfzj2joju',   // 阿里的 icon 图标
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
        'YunDingOnlineSDK', 'vue', 'axios', 'ELEMENT', 'regHooks',
        // 额外样式动态引用
        'css!app-style', 'css!element-ui-theme', 'css!ali-icon'
    ];

    // 启动项目
    requirejs(require_list, function (tpl, config, GameApi, Vue, axios, ELEMENT, regHooks) {
        // 手动注册 Element-UI 到 Vue
        ELEMENT.install(Vue);

        // 创建 View
        let app = new Vue({
            el: '#app',
            template: tpl,
            data: {
                login_form: {},
                user_list: [],
                tableData: [],
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

                // 一定要马上将自己暴露给 regHook 里面
                regHooks(this);
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
                    let valid = false;
                    this.$refs['loginForm'].validate((_valid) => {
                        valid = _valid;
                    });
                    if (!valid) return;

                    // 创建游戏对象
                    let game = new GameApi(),
                        email = this.login_form.email;

                    // 添加到用户列表
                    game.user_index = this.user_list.push({
                        email: email,
                        status: '已添加',
                        teams: []
                    }) - 1;

                    // 登录账号
                    game.login(email, this.login_form.password);

                    // 保存起来
                    this.game_list[email] = game;
                },
                // 移动到新地图
                moveToNewMap: function (row, mid) {
                    this.game_list[row.email].moveToNewMap(mid);
                },
                // 创建队伍
                createdTeam: function (row) {
                    this.game_list[row.email].createdTeam();
                },
                // 加入队伍
                addTeam: function (row, item) {
                    this.game_list[row.email].addTeam(item._id)
                },
                // 离开队伍
                leaveTeam: function (row) {
                    this.game_list[row.email].leaveTeam();
                },
                // 获取团队列表
                getTeamList: function (row) {
                    if (!row.isLogin) {
                        return null;
                    }
                    console.log('getTeamList', row.email, row.map.id);
                    this.game_list[row.email].getTeamList(row.map.id);
                    return null;
                }

            }
        });

        // 测试账号
        app.login_form = {
            email: 'test2',
            password: '123456'
        };

        // 暴露到全局
        exports.app = app;
        exports.GameApi = GameApi;
    });

})(window);

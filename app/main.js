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
            'app-template': 'templates/main.html',
            'app-config': 'app/config.json',
            'app-style': 'assets/style',
            'ali-icon': 'https://at.alicdn.com/t/font_1936453_g8yfzj2joju',   // 阿里的 icon 图标
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
        'data!app-template', 'data!app-config',
        // 插件相关
        'YunDingOnlineSDK', 'vue', 'ELEMENT', 'regHooks', 'axios',
        // 额外样式动态引用
        'css!app-style', 'css!element-ui-theme', 'css!ali-icon'
    ];

    // 启动项目
    requirejs(require_list, function (template, config, GameApi, Vue, ELEMENT, regHooks, axios) {
        // 手动注册 Element-UI 到 Vue
        ELEMENT.install(Vue);

        // 设置调试模式
        // GameApi.isDEBUG();

        // 创建 View
        let app = new Vue({
            el: '#app',
            template: template,
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
                // 创建保存游戏对象的列表 (不希望被 Vue 解析)
                this.game_list = {};

                // 全局配置
                this.config = config;

                // 一定要马上将自己暴露给 regHook 里面
                regHooks(this);

                // 加载历史账号
                let users = this.getStorageUser();
                Object.keys(users).forEach((email) => {
                    this.addUser(email, users[email], true);
                });
            },
            computed: {
                /**
                 * user_list 的 email 与 index 对照关系
                 */
                userMap: function () {
                    let user_map = {};
                    this.user_list.forEach((item, index) => {
                        // console.log('userMap', item, index);
                        user_map[item.email] = index;
                    });
                    return user_map;
                }
            },
            methods: {
                /**
                 * 将账号密码保存到 localStorage 中
                 * @param {*} email
                 * @param {*} password
                 */
                saveStorageUser: function (email, password) {
                    let users = this.getStorageUser();
                    if ('undefined' == typeof password) {
                        delete users[email];
                    } else {
                        users[email] = password;
                    }
                    localStorage.setItem('ydxxGame_userList', JSON.stringify(users));
                },
                /**
                 * 从 localStorage 中取出账号密码
                 * @param {*} email 可选
                 */
                getStorageUser: function (email) {
                    let users = JSON.parse(localStorage.getItem('ydxxGame_userList') || '{}') || {};
                    return email ? users[email] || null : users;
                },
                /**
                 * 获取内建的游戏对象
                 * @param {*} email
                 */
                getGame: function (email) {
                    return this.game_list[email];
                },
                /**
                 * 获取列表中对应的 User
                 * @param {*} email
                 */
                getUser: function (email) {
                    let index = this.userMap[email];
                    // console.log('getUser', email, index);
                    if (index === undefined) {
                        return null;
                    }
                    return this.user_list[index];
                },
                /**
                 * 页面表单 添加用户
                 * @param {*} event
                 */
                onAddUser: function (event) {
                    // 验证表单
                    let valid = false;
                    this.$refs['loginForm'].validate((_valid) => {
                        valid = _valid;
                    });
                    if (!valid) return;

                    // 保存账号密码
                    this.saveStorageUser(this.login_form.email, this.login_form.password);

                    // 添加到列表并登陆
                    this.addUser(this.login_form.email, this.login_form.password, true)
                },
                /**
                 * 添加一个用户到列表
                 *
                 * @param {*} email
                 * @param {*} password
                 * @param {*} isLogin
                 */
                addUser: function (email, password, isLogin) {
                    // 创建游戏对象
                    let game = new GameApi();

                    // 游戏对象保存起来
                    this.game_list[email] = game;

                    // 添加到用户列表
                    this.user_list.push({
                        email: email,
                        status: '已添加',
                        teams: []
                    });

                    // 登录账号
                    if (isLogin) {
                        game.login(email, password);
                    }
                },
                /**
                 * 删除用户
                 * @param {*} row
                 */
                deleteUser: function (row) {
                    let index = this.userMap[row.email];

                    // 从列表删除此用户
                    this.user_list.splice(index, 1);

                    // TODO 需要完成 注销游戏 与销毁游戏对象的功能

                    // 更新保存用户
                    this.saveStorageUser(row.email);
                },
                // 移动到新地图
                moveToNewMap: function (row, mid) {
                    this.game_list[row.email].moveToNewMap(mid);
                },
                // 创建队伍
                createdTeam: function (row) {
                    this.game_list[row.email].createdTeam(row.map.id);
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

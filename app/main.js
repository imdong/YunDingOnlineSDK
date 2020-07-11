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
            ydComponents: 'app/ydComponents',
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
        'data!app-config',
        // 插件相关
        'YunDingOnlineSDK', 'vue', 'ELEMENT', 'regHooks', 'ydComponents'
    ];

    // 启动项目
    requirejs(require_list, function (config, GameApi, Vue, ELEMENT, regHooks, ydComponents) {
        // 手动注册 Element-UI 到 Vue
        ELEMENT.install(Vue);

        // 设置调试模式
        // GameApi.isDEBUG();

        // 创建 View
        let app = new Vue({
            el: '#app',
            template: ydComponents.main,
            data: {
                user_list: [],
                tableData: [],
            },
            // 创建完毕回调
            mounted: function () {
                // 创建保存游戏对象的列表 (不希望被 Vue 解析)
                this.game_list = {};

                // 全局配置
                this.config = config;

                // 一定要马上将自己暴露给 regHook 里面
                regHooks(this);
                ydComponents.setApp(this);

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
                onAddUser: function (email, passwd) {
                    // 保存账号密码
                    this.saveStorageUser(email, passwd);

                    // 添加到列表并登陆
                    this.addUser(email, passwd, true)
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
                        teams: [],
                        message: '暂无'
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
                    this.getGame(row.email).Stop();

                    // 更新保存用户
                    this.saveStorageUser(row.email);
                },
                // 设置消息
                setMessage: function (email, data) {
                    let date = new Date();
                    data.time = 'H:i:s'.replace(/[His]/g, (full) => {
                        let str = '';
                        switch (full) {
                            case 'H':
                                str = date.getHours();
                                break;
                            case 'i':
                                str = date.getMinutes();
                                break;
                            case 's':
                                str = date.getSeconds();
                                break;
                            default:
                                break;
                        }
                        return str.toString().padStart(2, '0');
                    })

                    // 调整格式 方便渲染
                    if (data.win >= 1) {
                        data.exp.forEach((item) => {
                            if (item.name == email) {
                                data.my_exp = item.exp;
                            }
                        });
                        data.player_reward.forEach((item) => {
                            if (item.name == email) {
                                let reward = [];
                                item.goods.forEach((good) => {
                                    reward.push(good.name);
                                })
                                if (reward.length == 0) {
                                    reward.push('无')
                                }
                                data.my_reward = reward;
                            }
                        });
                    }

                    this.getUser(email).message = data;
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

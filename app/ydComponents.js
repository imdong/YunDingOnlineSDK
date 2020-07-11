define(['vue', 'data!app-template', 'css!ali-icon', 'css!app-style', 'css!element-ui-theme'], function (Vue, template) {
    // 对象是需要的
    let app,
        templates = {},
        components = {},
        main;

    /**
     * 将字符串模板转换为对象列表
     * @param {*} template_str
     */
    function strToDoms(template_str) {
        let templateDom = document.createElement('div'),
            templates = {}, doms;
        templateDom.innerHTML = template_str;
        doms = templateDom.getElementsByTagName('template');

        for (let i = 0; i < doms.length; i++) {
            const template = doms[i];
            let component_name = template.getAttribute('component-name');

            if (!component_name) {
                continue;
            }

            if ('yd-main' == component_name) {
                main = template;
            } else {
                templates[component_name] = template;
            }
        }

        return templates;
    }

    /**
     * 字符串拆分为数组 如果不为空的话
     * @param {*} str
     * @param {*} splitter
     */
    function splitStrOrNull(str, splitter) {
        return ('string' == typeof str) && str.length > 0 ? str.split(splitter) : [];
    }

    /**
     * 将模板转换为组件
     * @param {*} templates
     */
    function templatesTocomponents(templates) {
        Object.keys(templates).forEach((component_name) => {
            const template = templates[component_name];
            let definition = {
                props: splitStrOrNull(template.getAttribute('props'), ','),
                template: template
            };

            // 如果有定义则合并
            if ('object' == typeof components[component_name]) {
                Object.assign(definition, components[component_name]);
            }

            Vue.component(component_name, definition);
        })
    }

    // 转换模板到列表
    templates = strToDoms(template);

    /**
     * 添加用户 登录表单 yd-login-form
     * @event {*} on-submit
     */
    components['yd-login-form'] = {
        data: function () {
            return {
                form: {},
                rules: {
                    // 账号不能重复
                    email: [
                        { required: true, message: '账号不能为空', trigger: 'blur' },
                        { max: 5, message: '账号最长5个字符', trigger: 'blur' },
                        {
                            validator: function (rule, email, callback) {
                                app.getUser(email) ? callback(new Error('账号已经存在')) : callback();
                            },
                            trigger: 'manual'
                        }
                    ],
                    passwd: [
                        { required: true, message: '密码不能为空', trigger: 'blur' },
                    ]
                }
            }
        },
        methods: {
            onSubmit: function (event) {
                this.$refs.form.validate((valid) => {
                    if (valid) {
                        this.$emit('on-submit', this.form.email, this.form.passwd);
                    }
                });

            }
        }
    }

    /**
     * 行内 地图切换
     */
    components['yd-line-map'] = {
        methods: {
            // 移动到新地图
            moveToNewMap: function (email, mid) {
                app.game_list[email].moveToNewMap(mid);
            }
        }
    }

    /**
     * 行内 团队操作
     */
    components['yd-line-team'] = {
        methods: {
            // 创建队伍
            createdTeam: function (email, map_id) {
                console.log('createdTeam', email, map_id);
                app.game_list[email].createdTeam(map_id);
            },
            // 离开队伍
            leaveTeam: function (email) {
                console.log('leaveTeam', email);
                app.game_list[email].leaveTeam();
            },
            startCombat: function (email, fighting, combat) {
                console.log('startCombat', email, fighting);
                if (fighting) {
                    app.getGame(email).startCombat(combat)
                }
            }
        }
    }

    /**
     * 行内 当前地图队伍列表
     */
    components['yd-line-teams'] = {
        methods: {
            // 计算时间差
            diffTime: function (start_bat_at) {
                return start_bat_at && (new Date().getTime()) - (new Date(start_bat_at).getTime())
            },
            // 获取团队列表
            getTeamList: function (email, map_id) {
                console.log('getTeamList', email, map_id);
                app.game_list[email].getTeamList(map_id);
                return null;
            },
            // 加入队伍
            addTeam: function (email, item_id) {
                console.log('addTeam', email, item_id);
                app.game_list[email].addTeam(item_id)
            }
        }
    }

    /**
     * 场景列表
     */
    components['yd-line-screens'] = {
        methods: {
            switchCombatScreen: function (email, id) {
                app.getUser(email).team.to_combat = id;
                app.getGame(email).switchCombatScreen(id);
            }
        }
    }

    // 统一转换为组件并注册
    templatesTocomponents(templates);

    // 暴露对象
    return {
        main: main,
        setApp: function (_app) {
            app = _app;
        }
    };
});

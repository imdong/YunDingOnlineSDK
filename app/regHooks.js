define(['YunDingOnlineSDK'], function (GameApi) {
    let app = null;

    // 创建空函数 屏蔽 onLeave onAdd 消息刷屏
    let emptyCb = () => { };
    emptyCb.hookMark = 'regHooks.emptyCb';
    GameApi.regHookHandlers['onLeave'].push(emptyCb);
    GameApi.regHookHandlers['onAdd'].push(emptyCb);

    // 接管登录成功的回调
    let loginCb = function (data) {
        let user = app.getUser(this.email);
        console.log('loginCb', this.email, data);

        // 检查错误
        if (data.code == 500) {
            user.status = "登录失败";
            user.status_msg = "账号已在他处登录";
            return;
        } else if (data.code != 200) {
            user.status = "登录失败";
            user.status_msg = data.msg || '未知错误';
            return;
        }

        // 登录成功
        if (data.token) {
            user.status = '鉴权成功';
            return;
        }
        user.status = '登录成功';

        // 没有数据就不在继续了
        if ('object' != typeof data.data) {
            return;
        }

        // 标记自己登陆成功
        app.$set(user, 'isLogin', true);

        // 记录地图位置
        app.$set(user, 'map', data.data.map);

        // 获取一些初始化的信息
        this.getTeamList(); // 获取地图队伍列表
    }
    loginCb.hookMark = "regHooks.loginCb";
    GameApi.regHookHandlers['gate.gateHandler.queryEntry'].push(loginCb);
    GameApi.regHookHandlers['connector.loginHandler.login'].push(loginCb);

    // 移动地图的返回
    let moveToNewMapCb = function (data) {
        let user = app.getUser(this.email);

        // 更新地图位置
        app.$set(user, 'map', data.map);
        console.log('moveToNewMapCb', this.email, data);
    };
    moveToNewMapCb.hookMark = "regHooks.moveToNewMapCb";
    GameApi.regHookHandlers['connector.playerHandler.moveToNewMap'].push(moveToNewMapCb);

    // 创建队伍回调
    let createdTeamCb = function (data) {
        if (data.code != 200) {
            app.$message.error(data.msg);
            return;
        }
        console.log('createdTeamCb', this.email, data);

        // 保存队长信息
        app.$set(app.getUser(this.email), 'team', {
            leader: this.email,
            users: []
        });

        app.$message.success('队伍创建成功');
    }
    createdTeamCb.hookMark = "regHooks.createdTeamCb";
    GameApi.regHookHandlers['connector.teamHandler.createdTeam'].push(createdTeamCb);

    // 离开队伍的回调
    let leaveTeamCb = function (data) {
        if (data.code != 200) {
            app.$message.error(data.msg);
            return;
        }
        console.log('createdTeamCb', this.email, data);

        app.$delete(app.getUser(this.email), 'team');
        app.$message('已离开队伍');
    }
    leaveTeamCb.hookMark = "regHooks.leaveTeamCb";
    GameApi.regHookHandlers['connector.teamHandler.leaveTeam'].push(leaveTeamCb);

    // 加入队伍
    let addTeamCb = function (data) {
        if (data.code != 200) {
            app.$message.error(data.msg);
            return;
        }
        console.log('addTeamCb', this.email, data);

        // 整理结构
        let combat = data.data.combat || null,
            leader = data.data.users[0].nickname,
            users = data.data.users;

        for (let i = 0; i < this.user_info.screens.length; i++) {
            const screen = this.user_info.screens[i];
            if (screen._id == combat) {
                combat = screen.name;
            }
        }

        app.$set(app.getUser(this.email), 'team', {
            combat: combat,
            leader: leader,
            users: users
        });
        app.$message('已加入队伍');
    }
    addTeamCb.hookMark = "regHooks.addTeamCb";
    GameApi.regHookHandlers['connector.teamHandler.addTeam'].push(addTeamCb);

    // 重新接收队伍信息
    let onMyTeamReloadCb = function (data) {
        if (data.code && data.code != 200) {
            app.$message.error(data.msg);
            return;
        }
        console.log('onMyTeamReloadCb', this.email, data);

        let user = app.getUser(this.email);

        // 队员退出
        if (data.new_uid && !data.team && user.team) {
            // 移除队员
            user.team.users.forEach((item, index) => {
                if (item._id == data.new_uid) {
                    user.team.users.splice(index, 1);
                }
            });
            return;
        }

        // 队长退出队伍 data = {} 只有自己会收到
        if (data.data) {
            app.$delete(user, 'team');
            return;
        }

        // 没有队伍信息是干啥?
        if (!data.team) {
            return;
        }

        // 获取队长信息
        let leader = data.team.leader,
            users = [];

        for (let i = 0; i < data.team.users.length; i++) {
            const user = data.team.users[i];
            if (user._id == leader) {
                leader = user.email;
            }
            users.push({
                _id: user._id,
                email: user.email,
                level: user.level
            })
        }

        app.$set(user, 'team', {
            leader: leader,
            users: users,
            combat: data.team.combat
        });
    }
    onMyTeamReloadCb.hookMark = "regHooks.onMyTeamReloadCb";
    GameApi.regHookHandlers['onMyTeamReload'].push(onMyTeamReloadCb);

    // 获取队伍列表
    let getTeamListCb = function (data) {
        if (data.code != 200) {
            app.$message.error(data.msg);
            return;
        }
        console.log('getTeamListCb', this.email, data);

        let user = app.getUser(this.email);

        app.$set(user, 'screens', data.data.screens);
        app.$set(user, 'teams', data.data.teams);

        // 特别标记队长
        if (data.data.myTeam) {
            data.data.myTeam.leader = data.data.myTeam.users[0].nickname;
        }
        app.$set(user, 'team', data.data.myTeam);
    }
    getTeamListCb.hookMark = "regHooks.getTeamListCb";
    GameApi.regHookHandlers['connector.teamHandler.getTeamList'].push(getTeamListCb);

    // 切换场景回调
    let switchCombatScreenCb = function (data) {
        if (data.code != 200) {
            app.$message.error(data.msg);
            return;
        }
        console.log('switchCombatScreenCb', this.email, data);

        app.getUser(this.email).team.combat = app.getUser(this.email).team.to_combat;

        app.$message.success("切换场景成功");
    }
    switchCombatScreenCb.hookMark = "regHooks.switchCombatScreenCb";
    GameApi.regHookHandlers['connector.teamHandler.switchCombatScreen'].push(switchCombatScreenCb);

    // 战斗开始
    let onStartBatCb = function (data) {
        console.log('onStartBatCb', data);
    }
    onStartBatCb.hookMark = "regHooks.onStartBatCb";
    GameApi.regHookHandlers['onStartBat'].push(onStartBatCb);

    // 战斗结束
    let onRoundBatEndCb = function (data) {
        // 开启新的战斗
        if (app.getUser(this.email).fighting && data.data.win > 0) {
            this.startCombat(this.user_info.team.combat);
        }
        // console.log('onRoundBatEndCb', data);

        // 保存战斗消息
        app.setMessage(this.email, data.data);
    }
    onRoundBatEndCb.hookMark = "regHooks.onRoundBatEndCb";
    GameApi.regHookHandlers['onRoundBatEnd'].push(onRoundBatEndCb);

    // 回合操作
    let roundOperatingCb = function (data) {
        if (data.code != 200) {
            app.$message.error(data.msg);
            return;
        }
        console.log('switchCombatScreenCb', this.email, data);
    }
    roundOperatingCb.hookMark = "regHooks.roundOperatingCb";
    GameApi.regHookHandlers['connector.teamHandler.roundOperating'].push(roundOperatingCb);



    // 暴露一个接口 用来接收 app 对象
    return function (_app) {
        app = _app;
    };
});

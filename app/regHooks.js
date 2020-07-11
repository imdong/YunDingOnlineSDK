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
        console.log('loginCb', data);

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
    }
    loginCb.hookMark = "regHooks.loginCb";
    GameApi.regHookHandlers['gate.gateHandler.queryEntry'].push(loginCb);
    GameApi.regHookHandlers['connector.loginHandler.login'].push(loginCb);

    // 移动地图的返回
    let moveToNewMapCb = function (data) {
        let user = app.getUser(this.email);

        // 更新地图位置
        app.$set(user, 'map', data.map);
        console.log('moveToNewMapCb', data);
    };
    moveToNewMapCb.hookMark = "regHooks.moveToNewMapCb";
    GameApi.regHookHandlers['connector.playerHandler.moveToNewMap'].push(moveToNewMapCb);

    // 创建队伍回调
    let createdTeamCb = function (data) {
        if (data.code != 200) {
            app.$message.error(data.msg);
            return;
        }
        console.log('createdTeamCb', data);

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
        console.log('createdTeamCb', data);

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
        console.log('addTeamCb', data);

        //
        let combat = data.data.combat,
            leader = data.data.leader,
            users = [];
        for (let i = 0; i < data.data.users.length; i++) {
            const user = data.data.users[i];
            if (user._id == leader) {
                leader = user.email;
            }
            users.push({
                email: user.email,
                level: user.level
            })
        }

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
        console.log('onMyTeamReloadCb', data);

        let user = app.getUser(this.email);

        // 退出队伍后还会推送清空团队
        if (!data.team) {
            app.$delete(user, 'team');
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
                email: user.email,
                level: user.level
            })
        }

        app.$set(user, 'team', {
            leader: leader,
            users: users
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
        console.log('getTeamListCb', data);

        let user = app.getUser(this.email);

        app.$set(user, 'screens', data.data.screens);
        app.$set(user, 'teams', data.data.teams);
    }
    getTeamListCb.hookMark = "regHooks.getTeamListCb";
    GameApi.regHookHandlers['connector.teamHandler.getTeamList'].push(getTeamListCb);

    // 暴露一个接口 用来接收 app 对象
    return function (_app) {
        app = _app;
    };
});

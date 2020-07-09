(function () {
    // 定义加载源
    require.config({
        baseUrl: './',
        paths: {
            vue: 'https://cdn.jsdelivr.net/npm/vue@2.6.11/dist/vue',
            axios: 'https://cdn.jsdelivr.net/npm/axios@0.19.2/dist/axios.min',
            'element-ui': 'https://cdn.jsdelivr.net/npm/element-ui@2.13.2/lib/index',
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
        'vue', 'axios', 'YunDingOnlineSDK',
        'element-ui', 'css!app-style', 'css!element-ui-theme'
    ];


    // 启动项目
    requirejs(require_list, function (tpl, config, Vue, axios, GameApi) {
        document.getElementById('app').innerHTML = tpl;

        let game_api = new GameApi();

        game_api.login('test2', '123456');

        console.log(game_api);
        window.game_api = game_api;
    });

})();

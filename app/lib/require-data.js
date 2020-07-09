define(['axios'], function (axios) {
    var loadData = {};

    loadData.load = function (dataId, req, load, config) {
        axios.get(req.toUrl(dataId)).then(function (response) {
            load(response.data);
        });
    }

    return loadData;
});

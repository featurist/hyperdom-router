var plastiq = require('plastiq');
var h = plastiq.html;
var routism = require('routism');
var prototype = require('prote');

module.exports = prototype({
  constructor: function (options) {
    this.routes = [];
    this.history = options && options.hasOwnProperty('history')? options.history: historyApi;
    if (this.history.init) {
      this.history.init();
    }

    this[404] = options && options.hasOwnProperty('404')? options[404]: function () {
      return h('h1', '404');
    };

    this.push = this.push.bind(this);
    this.replace = this.replace.bind(this);
  },

  expand: function (pattern, params) {
    var paramsExpanded = {};

    var url = pattern.replace(/:([a-z_][a-z0-9_]*)/gi, function (_, id) {
      var param = params[id];
      paramsExpanded[id] = true;
      return param;
    });

    var query = Object.keys(params).filter(function (key) {
      return !paramsExpanded[key];
    }).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    }).join('&');

    if (query) {
      return url + '?' + query;
    } else {
      return url;
    }
  },

  route: function (pattern, binding) {
    var self = this;

    var route = binding;
    this.routes.push({pattern: pattern, route: route});

    return function(params, state, vdom) {
      var hasState = false;

      if (arguments.length == 1) {
        if (arguments[0].constructor == Object) {
          return self.expand(pattern, params);
        } else {
          vdom = params;
          params = undefined;
          state = undefined;
          hasState = false;
        }
      } else if (arguments.length == 2) {
        vdom = state;
        state = undefined;
        hasState = false;
      } else {
        hasState = true;
      }

      var path = params
        ? self.expand(pattern, params)
        : pattern;

      self.nextRoute = {
        path: path,
        route: route
      };

      if (hasState) {
        self.history.state(state);
      }

      return vdom;
    };
  },

  render: function (model, render) {
    this.history.refresh = plastiq.html.refresh;

    var location = this.history.location();
    var path = location.pathname + location.search;

    if (this.history.lastPath != path) {
      var routes = routism.compile(this.routes);
      var route = routes.recognise(location.pathname);

      var lastRoute = this.history.lastRoute;
      this.history.lastPath = path;
      this.history.lastRoute = route.route;

      if (route) {
        if (lastRoute && lastRoute.from) {
          lastRoute.from(model);
        }
        if (route.route && route.route.to) {
          var state = this.history.popstate? this.history.popstateState: undefined;
          route.route.to(model, associativeArrayToObject(route.params), state);
          delete this.history.popstate;
          delete this.history.popstateState;
        }
      } else {
        return this[404]();
      }
    }

    delete this.nextRoute;

    var vdom = render();

    if (this.nextRoute && this.history.lastPath != this.nextRoute.path) {
      this.history.lastPath = this.nextRoute.path;
      this.history.lastRoute = this.nextRoute.route;
      this.history.push(this.history.lastPath);
      delete this.nextRoute;
    }

    return vdom;
  },

  push: function (ev) {
    this.history.push(ev.target.href);
    ev.preventDefault();
  },

  replace: function (ev) {
    this.history.replace(ev.target.href);
    ev.preventDefault();
  }
});

function associativeArrayToObject(array) {
  var o = {};

  array.forEach(function (item) {
    o[item[0]] = item[1];
  });

  return o;
}

var historyApi = {
  init: function () {
    var self = this;
    if (!this.listening) {
      window.addEventListener('popstate', function (ev) {
        self.popstate = true;
        self.popstateState = ev.state;
        self.refresh();
      });
      this.listening = true;
    }
  },
  location: function () {
    return window.location;
  },
  push: function (url) {
    window.history.pushState(undefined, undefined, url);
  },
  state: function (state) {
    window.history.replaceState(state);
  },
  replace: function (url) {
    window.history.replaceState(undefined, undefined, url);
  }
};

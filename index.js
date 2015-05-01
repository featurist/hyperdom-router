var routism = require('routism');
var plastiq = require('plastiq');
var h = plastiq.html;
var refresh;
var rendering = require('plastiq/rendering');

var routes = {
  routes: [],
  routesChanged: false,

  start: function (history) {
    this.history = history || exports.historyApi;
    this.history.start();
  },

  stop: function () {
    this.history.stop();
  },

  compile: function () {
    if (this.routesChanged) {
      this.compiledRoutes = routism.compile(this.routes);
      this.routesChanged = false;
    }
  },

  isNotFound: function () {
    if (this.currentRoute.isNotFound) {
      return this.currentRoute;
    }
  },

  makeCurrentRoute: function () {
    var location = this.history.location();
    var href = location.pathname + location.search;

    if (!this.currentRoute || this.currentRoute.href != href) {
      this.compile();
      var routeRecognised = this.compiledRoutes.recognise(location.pathname);

      if (routeRecognised) {
        var search = location.search && parseSearch(location.search);
        var paramArray = search
          ? search.concat(routeRecognised.params)
          : routeRecognised.params;

        var params = associativeArrayToObject(paramArray);

        var expandedUrl = expand(routeRecognised.route.pattern, params);
        var self = this;

        this.currentRoute = {
          route: routeRecognised.route,
          params: params,
          href: href,
          expandedUrl: expandedUrl,
          times: 1,
          replace: function (params) {
            var url = expand(this.route.pattern, params);
            self.replace(url);
          }
        };
      } else {
        this.currentRoute = {
          isNotFound: true,
          href: href
        };
      }
    }
  },

  isCurrentRoute: function (route) {
    this.makeCurrentRoute();

    if (this.currentRoute.route === route) {
      this.currentRoute.isNew = this.currentRoute.times-- > 0;
      return this.currentRoute;
    }
  },

  add: function (pattern) {
    var route = {pattern: pattern};
    this.routes.push({pattern: pattern, route: route});
    this.routesChanged = true;
    return route;
  },

  pushOrReplace: function (pushReplace, url, options) {
    if ((options && options.force) || !this.currentRoute || this.currentRoute.expandedUrl != url) {
      this.history[pushReplace](url);
      var location = this.history.location();

      if (options && options.sameRoute) {
        this.currentRoute.href = location.pathname + location.search;
        this.currentRoute.expandedUrl = url;
      } else {
        delete this.currentRoute;
        this.makeCurrentRoute();
      }
    }
  },

  push: function (url, options) {
    this.pushOrReplace('push', url, options);
  },

  replace: function (url, options) {
    this.pushOrReplace('replace', url, options);
  }
};

function parseSearch(search) {
  return search && search.substring(1).split('&').map(function (param) {
    return param.split('=').map(decodeURIComponent);
  });
}

var popstateListener;

exports.start = function (history) {
  routes.start(history);
};

exports.stop = function () {
  routes.stop();
};

exports.route = function (pattern) {
  var route = routes.add(pattern);

  return function (paramBindings, render) {
    if (typeof paramBindings === 'function') {
      render = paramBindings;
      paramBindings = undefined;
    }

    if (!render) {
      var params = paramBindings || {};
      var url = expand(pattern, params);

      return {
        push: function (ev) {
          if (ev) {
            ev.preventDefault();
          }

          routes.push(url);
        },

        replace: function (ev) {
          if (ev) {
            ev.preventDefault();
          }

          routes.replace(url);
        },

        active: !!routes.isCurrentRoute(route),

        href: url,

        a: function () {
          var options;
          if (arguments[0] && arguments[0].constructor == Object) {
            options = arguments[0];
            content = Array.prototype.slice.call(arguments, 1);
          } else {
            options = {};
            content = Array.prototype.slice.call(arguments, 0);
          }

          options.href = url;
          options.onclick = this.push.bind(this);

          return h.apply(h, ['a', options].concat(content));
        }
      };
    } else {
      refresh = h.refresh;
      var currentRoute = routes.isCurrentRoute(route);

      if (currentRoute) {
        if (paramBindings) {
          if (currentRoute.isNew) {
            Object.keys(currentRoute.params).forEach(function (param) {
              var value = currentRoute.params[param];

              h.binding(paramBindings[param], {norefresh: true}).set(value);
            });
          } else {
            var newParams = {};

            var keys = Object.keys(paramBindings);

            function allBindingsHaveGetters() {
              return !keys.some(function (k) {
                return !paramBindings[k].get;
              });
            }

            if (allBindingsHaveGetters()) {
              keys.forEach(function (param) {
                var binding = h.binding(paramBindings[param]);
                if (binding.get) {
                  var value = binding.get();
                  newParams[param] = value;
                }
              });

              currentRoute.replace(newParams);
            }
          }
        }

        return render(currentRoute.params);
      }
    }
  };
};

exports.notFound = function (render) {
  var notFoundRoute = routes.isNotFound();

  if (notFoundRoute) {
    return render(notFoundRoute.href);
  }
};

function associativeArrayToObject(array) {
  var o = {};

  array.forEach(function (item) {
    o[item[0]] = item[1];
  });

  return o;
}

function expand(pattern, params) {
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
}

exports.historyApi = {
  start: function () {
    var self = this;
    if (!this.listening) {
      this.popstateListener = function(ev) {
        self.popstate = true;
        self.popstateState = ev.state;
        if (refresh) {
          refresh();
        }
      }
      window.addEventListener('popstate', this.popstateListener);
      this.listening = true;
    }
  },
  stop: function () {
    window.removeEventListener('popstate', this.popstateListener);
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

exports.hash = {
  start: function () {
    var self = this;
    if (!this.listening) {
      this.hashchangeListener = function(ev) {
        if (refresh) {
          refresh();
        }
      }
      window.addEventListener('hashchange', this.hashchangeListener);
      this.listening = true;
    }
  },
  stop: function () {
    window.removeEventListener('hashchange', this.hashchangeListener);
  },
  location: function () {
    var path = window.location.hash || '#';

    var m = /^#(.*?)(\?.*)?$/.exec(path);

    return {
      pathname: '/' + m[1],
      search: m[2] || ''
    }
  },
  push: function (url) {
    window.location.hash = url.replace(/^\//, '');
  },
  state: function (state) {
  },
  replace: function (url) {
    return this.push(url);
  }
};

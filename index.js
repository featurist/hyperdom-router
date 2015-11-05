var routism = require('routism');
var plastiq = require('plastiq');
var h = plastiq.html;
var refresh;

function Routes() {
  this.routes = [];
  this.routesChanged = false;
}

Routes.prototype.recognise = function (pathname) {
  if (this.routesChanged) {
    this.compiledRoutes = routism.compile(this.routes);
    this.routesChanged = false;
  }

  return this.compiledRoutes.recognise(pathname);
};

Routes.prototype.add = function (pattern) {
  var route = {pattern: pattern};
  this.routes.push({pattern: pattern, route: route});
  this.routesChanged = true;
  return route;
};

function Router() {
  this.routes = new Routes();
}

Router.prototype.start = function (history) {
  this.history = history;
  this.history.start();
  this.started = true;
};

Router.prototype.stop = function () {
  if (this.started) {
    this.history.stop();

    var keys = Object.keys(this);
    for (var n = 0; n < keys.length; n++) {
      if (keys[n] != 'routes') {
        delete this[keys[n]];
      }
    }
  }
};

Router.prototype.isNotFound = function () {
  if (this.currentRoute.isNotFound) {
    return this.currentRoute;
  }
};

Router.prototype.makeCurrentRoute = function () {
  var location = this.history.location();
  var href = location.pathname + location.search;

  if (!this.currentRoute || this.currentRoute.href != href) {
    var routeRecognised = this.routes.recognise(location.pathname);

    if (routeRecognised) {
      var search = location.search && parseSearch(location.search);
      var paramArray = search
        ? search.concat(routeRecognised.params)
        : routeRecognised.params;

      var params = associativeArrayToObject(paramArray);

      var expandedUrl = expand(routeRecognised.route.pattern, params);
      var self = this;

      if (this.currentRoute && this.currentRoute.ondeparture) {
        this.currentRoute.ondeparture();
      }

      this.currentRoute = {
        route: routeRecognised.route,
        params: params,
        href: href,
        expandedUrl: expandedUrl,
        replace: function (params) {
          var url = expand(this.route.pattern, params);
          this.params = params;
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
};

Router.prototype.setupRender = function () {
  if (h.currentRender && !h.currentRender.routerEstablished) {
    h.currentRender.routerEstablished = true;

    this.lastHref = this.currentHref;

    var location = this.history.location();
    var href = location.pathname + location.search;
    this.currentHref = href;

    this._isNewHref = this.lastHref != this.currentHref;

    this.makeCurrentRoute();
  }
};

Router.prototype.isNewHref = function () {
  return this._isNewHref;
};

Router.prototype.isCurrentRoute = function (route) {
  this.makeCurrentRoute();

  if (this.currentRoute.route === route) {
    return this.currentRoute;
  }
};

Router.prototype.add = function (pattern) {
  return this.routes.add(pattern);
};

Router.prototype.pushOrReplace = function (pushReplace, url, options) {
  if ((options && options.force) || !this.currentRoute || this.currentRoute.expandedUrl != url) {
    this.history[pushReplace](url);
    var location = this.history.location();

    if (this.currentRoute.ondeparture) {
      this.currentRoute.ondeparture();
    }

    if (refresh) {
      refresh();
    }
  }
};

Router.prototype.push = function (url, options) {
  this.pushOrReplace('push', url, options);
};

Router.prototype.replace = function (url, options) {
  this.pushOrReplace('replace', url, options);
};

function createRouter() {
  return new Router();
}

function escapeRegex(pattern) {
  return pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

var splatVariableRegex = /(\:([a-z\-_]+)\\\*)/ig;
var variableRegex = /(:([-a-z_]+))/ig;

function compilePattern(pattern) {
  return escapeRegex(pattern)
    .replace(splatVariableRegex, "(.+)")
    .replace(variableRegex, "([^\/]+)");
}

function preparePattern(pattern) {
  var match;
  var variableRegex = new RegExp('(:([-a-z_]+))', 'ig');
  var variables = [];

  while (match = variableRegex.exec(pattern)) {
    variables.push(match[2]);
  }

  var patternRegex = new RegExp('^' + compilePattern(pattern));

  return {
    regex: patternRegex,
    variables: variables
  };
}

function matchUnder(pattern) {
  var patternVariables = preparePattern(pattern);

  return function (path) {
    var match = patternVariables.regex.exec(path);

    if (match) {
      var params = {};

      for (var n = 1; n < match.length; n++) {
        params[patternVariables.variables[n - 1]] = match[n];
      }

      return params;
    }
  };
}

var router = createRouter();

function parseSearch(search) {
  return search && search.substring(1).split('&').map(function (param) {
    return param.split('=').map(decodeURIComponent);
  });
}

var popstateListener;

exports.start = function (options) {
  if (!router) {
    router = createRouter();
  }
  router.start((options && options.history) || exports.historyApi);
};

exports.stop = function () {
  router.stop();
};

exports.clear = function () {
  router.stop();
  router = undefined;
};

exports.route = function (pattern) {
  var route = router.add(pattern);

  function routeFn (paramBindings, render) {
    if (typeof paramBindings === 'function') {
      render = paramBindings;
      paramBindings = undefined;
    }

    if (!render) {
      var params = paramBindings || {};
      var url = expand(pattern, params);

      var currentRoute = router.started && router.isCurrentRoute(route);

      return {
        push: function (ev) {
          if (ev) {
            ev.preventDefault();
          }

          router.push(url);
        },

        replace: function (ev) {
          if (ev) {
            ev.preventDefault();
          }

          router.replace(url);
        },

        active: currentRoute && currentRoute.expandedUrl == url,

        href: url,

        a: function () {
          return this.link.apply(this, arguments);
        },

        link: function () {
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
      if (!router.started) {
        throw new Error("router not started yet, start with require('plastiq-router').start([history])");
      }

      router.setupRender();

      refresh = h.refresh;
      var currentRoute = router.isCurrentRoute(route);
      var isNew = router.isNewHref();

      if (currentRoute) {
        if (paramBindings) {
          var onarrival = paramBindings.onarrival && h.refreshify(paramBindings.onarrival, {refresh: 'promise'});
          delete paramBindings.onarrival;
          currentRoute.ondeparture = paramBindings.ondeparture;
          delete paramBindings.ondeparture;

          if (isNew) {
            setParamBindings(currentRoute.params, paramBindings);

            if (onarrival) {
              onarrival(currentRoute.params);
            }
          } else {
            var newParams = getParamBindings(currentRoute.params, paramBindings);
            if (newParams) {
              currentRoute.replace(newParams);
            }
          }
        }

        return render(currentRoute.params);
      }
    }
  }

  var _underRegExp;
  function underRegExp() {
    if (!_underRegExp) {
      _underRegExp = matchUnder(pattern);
    }

    return _underRegExp;
  }

  routeFn.under = function (_paramBindings, _fn) {
    var paramBindings, fn;

    if (typeof _paramBindings === 'function') {
      fn = _paramBindings;
    } else {
      paramBindings = _paramBindings;
      fn = _fn;
    }

    var params = underRegExp()(router.history.location().pathname);

    if (params && paramBindings && fn) {
      router.setupRender();

      if (router.isNewHref()) {
        setParamBindings(params, paramBindings);
      } else {
        var newParams = getParamBindings(router.currentRoute.params, paramBindings);
        if (newParams) {
          router.currentRoute.replace(newParams);
        }
      }
    }

    if (fn) {
      if (params) {
        return fn(params);
      }
    } else {
      return {
        active: !!params
      };
    }
  };

  routeFn.pattern = pattern;
  
  return routeFn;
};

function setParamBindings(params, paramBindings) {
  var paramKeys = Object.keys(params);
  for (var n = 0; n < paramKeys.length; n++) {
    var param = paramKeys[n];
    var value = params[param];

    var paramBinding = paramBindings[param];
    if (paramBinding) {
      var binding = h.binding(paramBinding, {refresh: 'promise'})
      if (binding.set) {
        binding.set(value);
      }
    }
  }
}

function getParamBindings(params, paramBindings) {
  var bindings = Object.keys(paramBindings).map(function (key) {
    return {
      key: key,
      binding: h.binding(paramBindings[key])
    };
  });

  var allBindingsHaveGetters = !bindings.some(function (b) {
    return !b.binding.get;
  });

  if (allBindingsHaveGetters) {
    var newParams = {};

    var paramKeys = Object.keys(params);
    for(var n = 0; n < paramKeys.length; n++) {
      var param = paramKeys[n];
      newParams[param] = params[param];
    }

    for(var n = 0; n < bindings.length; n++) {
      var b = bindings[n];
      if (b.binding.get) {
        var value = b.binding.get();
        newParams[b.key] = value;
      }
    }

    return newParams;
  }
}

exports.notFound = function (render) {
  var notFoundRoute = router.isNotFound();

  if (notFoundRoute) {
    return render(notFoundRoute.href);
  }
};

function associativeArrayToObject(array) {
  var o = {};

  for(var n = 0; n < array.length; n++) {
    var pair = array[n];
    o[pair[0]] = pair[1];
  }

  return o;
}

function paramToString(p) {
  if (p === undefined || p === null) {
    return '';
  } else {
    return p;
  }
}

function expand(pattern, params) {
  var paramsExpanded = {};

  var url = pattern.replace(/:([a-z_][a-z0-9_]*)\*/gi, function (_, id) {
    var param = params[id];
    paramsExpanded[id] = true;
    return encodeURI(paramToString(param));
  });

  url = url.replace(/:([a-z_][a-z0-9_]*)/gi, function (_, id) {
    var param = params[id];
    paramsExpanded[id] = true;
    return encodeURIComponent(paramToString(param));
  });

  var query = Object.keys(params).map(function (key) {
    var param = paramToString(params[key]);

    if (!paramsExpanded[key] && param != '') {
      return encodeURIComponent(key) + '=' + encodeURIComponent(param);
    }
  }).filter(function (param) {
    return param;
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
      window.addEventListener('popstate', function(ev) {
        if (self.active) {
          self.popstate = true;
          self.popstateState = ev.state;
          if (refresh) {
            refresh();
          }
        }
      });
      this.listening = true;
    }

    this.active = true;
  },
  stop: function () {
    // I _think_ this is a chrome bug
    // if we removeEventListener then history.back() doesn't work
    // Chrome Version 43.0.2357.81 (64-bit), Mac OS X 10.10.3
    // yeah...
    this.active = false;
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
        if (!self.pushed) {
          if (refresh) {
            refresh();
          }
        } else {
          self.pushed = false;
        }
      }
      window.addEventListener('hashchange', this.hashchangeListener);
      this.listening = true;
    }
  },
  stop: function () {
    this.listening = false;
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
    this.pushed = true;
    window.location.hash = url.replace(/^\//, '');
  },
  state: function (state) {
  },
  replace: function (url) {
    return this.push(url);
  }
};

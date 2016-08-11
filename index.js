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

  var routeRecognised = this.routes.recognise(location.pathname);

  if (routeRecognised) {
    var routeParams  = associativeArrayToObject(routeRecognised.params);
    var searchParams = exports.querystring.parse((location.search || '').substring(1));

    var params = merge(searchParams, routeParams);

    var expandedUrl = expand(routeRecognised.route.pattern, params);
    var self = this;

    if (this.currentRoute) {
      this.currentRoute.depart();
    }

    this.currentRoute = {
      route: routeRecognised.route,
      params: params,
      href: href,
      expandedUrl: expandedUrl,
      ondeparture: undefined,

      depart: function () {
        if (this.ondeparture) {
          this.ondeparture();
          this.ondeparture = undefined;
        }
      },

      arrive: function () {
        if (this.onarrival) {
          this.onarrival(this.params);
        }
      },

      setParams: function (params, pushOrReplace) {
        var url = expand(this.route.pattern, params);
        self.pushOrReplace(pushOrReplace, url, {refresh: false});
        this.params = params;
        if (this.expandedUrl != url) {
          this.arrive();
        }
        this.expandedUrl = url;
        this.href = url;
        self.currentHref = url;
      },

      push: function (params) {
        this.setParams(params, 'push');
      },

      replace: function (params) {
        this.setParams(params, 'replace');
      }
    };
  } else {
    this.currentRoute = {
      isNotFound: true,
      href: href
    };
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

    if (this._isNewHref) {
      this.makeCurrentRoute();
    }
  }
};

Router.prototype.isNewHref = function () {
  return this._isNewHref;
};

Router.prototype.isCurrentRoute = function (route) {
  if (this.currentRoute && this.currentRoute.route === route) {
    return this.currentRoute;
  }
};

Router.prototype.add = function (pattern) {
  return this.routes.add(pattern);
};

Router.prototype.pushOrReplace = function (pushReplace, url, options) {
  var refreshAfter = typeof options == 'object' && options.hasOwnProperty('refresh')? options.refresh: true;

  if ((options && options.force) || !this.currentRoute || this.currentRoute.expandedUrl != url) {
    this.history[pushReplace](url);

    this.currentRoute.depart();

    if (refresh && refreshAfter) {
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

exports.querystring = {
  parse: function(search) {
    var params = {};

    (search || '').split('&').map(function (param) {
      var v = param.split('=').map(decodeURIComponent);
      params[v[0]] = v[1];
    });

    return params;
  },
  stringify: function(paramsObject) {
    var query = Object.keys(paramsObject).map(function (key) {
      var param = paramToString(paramsObject[key]);

      if (param != '') {
        return encodeURIComponent(key) + '=' + encodeURIComponent(param);
      }
    }).filter(function (param) {
      return param;
    }).join('&');

    return query;
  }
};

exports.route = function (pattern) {
  var route = router.add(pattern);

  function routeFn (paramBindings, render) {
    if (typeof paramBindings === 'function') {
      render = paramBindings;
      paramBindings = undefined;
    }

    router.setupRender();

    var currentRoute = router.started && router.isCurrentRoute(route);

    if (!render) {
      var params = paramBindings || {};
      var url = expand(pattern, params);


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
          var content;

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

      refresh = h.refresh;
      var isNew = router.isNewHref();

      if (currentRoute) {
        if (paramBindings) {
          currentRoute.onarrival = paramBindings.onarrival && h.refreshify(paramBindings.onarrival, {refresh: 'promise'});
          delete paramBindings.onarrival;
          currentRoute.ondeparture = paramBindings.ondeparture;
          delete paramBindings.ondeparture;
          var pushBindings = pushFromBindings(paramBindings);

          if (isNew) {
            setParamBindings(currentRoute.params, paramBindings);
            currentRoute.arrive();
          } else {
            applyParamBindings(currentRoute.params, paramBindings, pushBindings);
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

      var pushBindings = pushFromBindings(paramBindings);

      if (router.isNewHref()) {
        setParamBindings(params, paramBindings);
      } else {
        applyParamBindings(router.currentRoute.params, paramBindings, pushBindings);
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

function pushFromBindings(paramBindings) {
  var pushBindings = paramBindings.push;
  delete paramBindings.push;
  return pushBindings;
}

function setParamBindings(params, paramBindings) {
  var paramKeys = Object.keys(paramBindings);
  for (var n = 0; n < paramKeys.length; n++) {
    var param = paramKeys[n];
    var value = params[param];

    var paramBinding = paramBindings[param];
    var binding = h.binding(paramBinding, {refresh: 'promise'})
    if (binding.set) {
      binding.set(value);
    }
  }
}

function applyParamBindings(params, paramBindings, pushBindings) {
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
    var push = false;

    var paramKeys = Object.keys(params);
    for(var n = 0; n < paramKeys.length; n++) {
      var param = paramKeys[n];
      newParams[param] = params[param];
    }

    for(n = 0; n < bindings.length; n++) {
      var b = bindings[n];
      if (b.binding.get) {
        var value = b.binding.get();
        newParams[b.key] = value;

        if (pushBindings && value != params[b.key]) {
          push = push || pushBindings[b.key];
        }
      }
    }

    if (push) {
      router.currentRoute.push(newParams);
    } else {
      router.currentRoute.replace(newParams);
    }
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

function merge(obj1, obj2) {
  var o = clone(obj1);

  Object.keys(obj2).forEach(function(key) {
    o[key] = obj2[key];
  });

  return o;
}

function paramToString(p) {
  if (p === undefined || p === null) {
    return '';
  } else {
    return p;
  }
}

function clone(thing) {
  return JSON.parse(JSON.stringify(thing));
}

function expand(pattern, params) {
  var onlyQueryParams = clone(params);

  var url = pattern.replace(/:([a-z_][a-z0-9_]*)\*/gi, function (_, id) {
    var param = params[id];
    delete onlyQueryParams[id];
    return encodeURI(paramToString(param));
  });

  url = url.replace(/:([a-z_][a-z0-9_]*)/gi, function (_, id) {
    var param = params[id];
    delete onlyQueryParams[id];
    return encodeURIComponent(paramToString(param));
  });

  var query = exports.querystring.stringify(onlyQueryParams);

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
      this.hashchangeListener = function() {
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
  state: function () {
  },
  replace: function (url) {
    return this.push(url);
  }
};

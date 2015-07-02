var plastiq = require('plastiq');
var h = plastiq.html;
var router = require('..');
var browser = require('browser-monkey').scope('.test');
var expect = require('chai').expect;

describe('plastiq router', function () {
  var originalLocation;

  before(function () {
    originalLocation = location.href;
  });

  beforeEach(function () {
    router.start();
  });

  afterEach(function () {
    router.stop();
    unmount();
  });

  after(function () {
    history.pushState(undefined, undefined, originalLocation);
  });

  function setLocation(url) {
    history.pushState(undefined, undefined, url);
  }

  it('displays the correct vdom for a given route', function () {
    var a = router.route('/a');
    var b = router.route('/b');

    function render() {
      return h('div',
        a(function () {
          return h('.a', 'a', b().link('b'));
        }),
        b(function () {
          return h('.b', 'b');
        })
      );
    }

    setLocation('/a');
    mount(render);

    return Promise.all([
      browser.find('.a').shouldExist(),
      browser.find('.b').shouldNotExist()
    ]).then(function () {
      return browser.find('a', {text: 'b'}).click();
    }).then(function () {
      return Promise.all([
        browser.find('.b').shouldExist(),
        browser.find('.a').shouldNotExist()
      ]);
    }).then(function () {
      history.back();
      return Promise.all([
        browser.find('.a').shouldExist(),
        browser.find('.b').shouldNotExist()
      ]);
    });
  });

  it('shows 404 when route not found', function () {
    var a = router.route('/a');

    function render() {
      return h('div',
        a(function () {
          return h('h1', 'a');
        }),
        router.notFound(function () {
          return h('h1', '404');
        })
      );
    }

    setLocation('/b');
    mount(render);

    return browser.find('h1', {text: '404'}).shouldExist();
  });

  it('provides parameters to route render function', function () {
    var a = router.route('/a/:id');

    function render() {
      return h('div',
        a(function (params) {
          return h('h1', 'id: ' + params.id);
        })
      );
    }

    setLocation('/a/asdf');
    mount(render);

    return browser.find('h1', {text: 'id: asdf'}).shouldExist();
  });

  it('can write params to bindings', function () {
    var a = router.route('/a/:id');

    function render(model) {
      return h('div',
        a({id: [model, 'id'], optional: [model, 'optional']}, function () {
          return h('h1', 'id: ' + model.id, ', optional: ' + model.optional);
        })
      );
    }

    setLocation('/a/asdf?optional=yo');
    mount(render, {});

    return Promise.all([
      browser.find('h1', {text: 'id: asdf'}).shouldExist(),
      browser.find('h1', {text: 'optional: yo'}).shouldExist()
    ]);
  });

  it('can read bindings into params', function () {
    var a = router.route('/a/:id');

    function render(model) {
      return h('div',
        a({id: [model, 'id'], optional: [model, 'optional']}, function () {
          return h('div',
            h('h1', 'id: ' + model.id),
            h('button', {onclick: function () { model.id++; model.optional = 'yo'; }}, 'add')
          );
        })
      );
    }

    setLocation('/a/1');
    mount(render, {});

    return browser.find('h1', {text: 'id: 1'}).shouldExist().then(function () {
      return browser.find('button', {text: 'add'}).click();
    }).then(function () {
      return browser.find('h1', {text: 'id: 2'}).shouldExist();
    }).then(function () {
      expect(location.pathname).to.equal('/a/2');
      expect(location.search).to.equal('?optional=yo');
    });
  });

  it("doesn't navigate if already on the route", function () {
    var a = router.route('/a');

    function render() {
      return h('div',
        a(function () {
          return a().link('a');
        })
      );
    }

    setLocation('/a');
    mount(render);

    var placeInHistory = history.length;
    return browser.find('a', {text: 'a'}).click().then(function () {
      return wait(20);
    }).then(function () {
      expect(history.length).to.equal(placeInHistory);
    });
  });
});

function mount(render, model) {
  var div = document.createElement('div');
  div.classList.add('test');
  document.body.appendChild(div);
  plastiq.append(div, render, model, {requestRender: setTimeout});
  return div;
}

function unmount() {
  var divs = document.querySelectorAll('body > div.test');
  Array.prototype.forEach.call(divs, function (div) {
    div.parentNode.removeChild(div);
  });
}

function wait(n) {
  return new Promise(function (fulfil) {
    setTimeout(fulfil, n);
  });
}

var plastiq = require('plastiq');
var h = plastiq.html;
var router = require('../..');
var browser = require('browser-monkey').scope('.test');
var expect = require('chai').expect;
var querystring = require('querystring');

function describePlastiqRouter(apiName, qs) {
  describe('plastiq router ' + apiName, function () {
    var originalLocation;
    var api = router[apiName];

    before(function () {
      originalLocation = location.pathname;
    });

    beforeEach(function () {
      router.clear();
      unmount();
      api.push(originalLocation);

      var options = apiName == 'historyApi'
        ? undefined
        : {history: api};

      if (qs == 'querystring') {
        router.querystring = querystring;
      }

      router.start(options);
    });

    function setLocation(url) {
      api.push(url);
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

    it('calls arrival departure events', function () {
      var a = router.route('/a');
      var b = router.route('/b/:id');
      var c = router.route('/c');

      function render(model) {
        return h('div',
          a(function () {
            return h('h1', 'route: a', b({id: '1'}).link('b'));
          }),
          b({
            onarrival: function (params) {
              model.event = 'arrived at b: ' + params.id;
            },
            ondeparture: function () {
              model.event = 'departed from b'
            }
          }, function () {
            return h('h1', 'route: b', c().link('c'));
          }),
          c(function () {
            return h('h1', 'route: c');
          })
        );
      }

      var model = {};
      setLocation('/a');
      mount(render, model);

      return browser.find('h1', {text: 'route: a'}).shouldExist().then(function () {
        return browser.find('a', {text: 'b'}).click();
      }).then(function () {
        return browser.find('h1', {text: 'route: b'}).shouldExist();
      }).then(function () {
        expect(model.event, 'first').to.equal('arrived at b: 1');
      }).then(function () {
        return browser.find('a', {text: 'c'}).click();
      }).then(function () {
        return browser.find('h1', {text: 'route: c'}).shouldExist();
      }).then(function () {
        expect(model.event).to.equal('departed from b');
      }).then(function () {
        history.back();
        return browser.find('h1', {text: 'route: b'}).shouldExist();
      }).then(function () {
        expect(model.event, 'second').to.equal('arrived at b: 1');
      }).then(function () {
        history.back();
        return browser.find('h1', {text: 'route: a'}).shouldExist();
      }).then(function () {
        expect(model.event).to.equal('departed from b');
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
      var model = {};
      mount(render, model);

      return browser.find('h1', {text: 'id: 1'}).shouldExist().then(function () {
        return browser.find('button', {text: 'add'}).click();
      }).then(function () {
        return browser.find('h1', {text: 'id: 2'}).shouldExist();
      }).then(function () {
        expect(api.location().pathname).to.equal('/a/2');
        expect(api.location().search).to.equal('?optional=yo');
        expect(model.id).to.equal(2);
      });
    });

    if (apiName != 'hash') {
      it('can specify which bindings replace or push the URL', function () {
        var a = router.route('/a/:a/:b');

        function render(model) {
          return h('div',
            a({
              a: [model, 'a'],
              b: [model, 'b'],

              push: {a: true}
            }, function () {
              return h('div',
                h('h1', 'a: ' + model.a + ', b: ' + model.b),
                h('button', {onclick: function () { model.a++; model.optional = 'yo'; }}, 'add a'),
                h('button', {onclick: function () { model.b++; model.optional = 'yo'; }}, 'add b')
              );
            })
          );
        }

        setLocation('/a/1/1');
        var model = {};
        mount(render, model);

        return browser.find('h1', {text: 'a: 1, b: 1'}).shouldExist().then(function () {
          return browser.find('button', {text: 'add a'}).click();
        }).then(function () {
          return browser.find('h1', {text: 'a: 2, b: 1'}).shouldExist();
        }).then(function () {
          return browser.find('button', {text: 'add b'}).click();
        }).then(function () {
          return browser.find('h1', {text: 'a: 2, b: 2'}).shouldExist();
        }).then(function () {
          expect(api.location().pathname).to.equal('/a/2/2');
          expect(model.a).to.equal(2);
          expect(model.b).to.equal(2);
          history.back();
          return browser.find('h1', {text: 'a: 1, b: 1'}).shouldExist();
        }).then(function () {
          expect(api.location().pathname).to.equal('/a/1/1');
          expect(model.a).to.equal('1');
          expect(model.b).to.equal('1');
        });
      });

      it('sets the model when going back', function () {
        var a = router.route('/a');

        function render(model) {
          return h('div',
            a({
              a: [model, 'a'],

              push: {a: true}
            }, function () {
              return h('div',
                h('h1', model.a? 'a: ' + model.a: 'nothing'),
                h('button', {onclick: function () { model.a = 1; }}, 'set a')
              );
            })
          );
        }

        setLocation('/a');
        var model = {};
        mount(render, model);

        return browser.find('h1', {text: 'nothing'}).shouldExist().then(function () {
          return browser.find('button', {text: 'set a'}).click();
        }).then(function () {
          return browser.find('h1', {text: 'a: 1'}).shouldExist();
        }).then(function () {
          expect(model.a).to.equal(1);
          expect(api.location().pathname).to.equal('/a');
          expect(api.location().search).to.equal('?a=1');
          history.back();
        }).then(function () {
          return browser.find('h1', {text: 'nothing'}).shouldExist();
        }).then(function () {
          expect(model.a).to.be.undefined;
          expect(api.location().pathname).to.equal('/a');
        });
      });
    }

    it("doesn't navigate if already on the route", function () {
      var root = router.route('/');
      var a = router.route('/a');

      function render() {
        return h('div',
          root(function () {
            return h('h1', 'root');
          }),
          a(function () {
            return a().link('a');
          })
        );
      }

      setLocation('/');
      setLocation('/a');
      mount(render);

      return browser.find('a', {text: 'a'}).click().then(function () {
        history.back();
        return browser.find('h1', {text: 'root'}).shouldExist();
      });
    });

    describe('under', function () {
      it('can accept locations under a route', function () {
        var root = router.route('/');
        var person = router.route('/people/:name');
        var personFriends = router.route('/people/:name/friends');

        function render() {
          return h('div',
            root(function () {
              return h('div',
                h('h1', 'root'),
                person({name: 'jack'}).link('jack')
              );
            }),
            person.under(function () {
              return h('div',
                h('h1', 'people'),
                person(function (params) {
                  return h('div',
                    h('h1', 'person: ' + params.name),
                    personFriends({name: params.name}).link('friends')
                  );
                }),
                personFriends(function (params) {
                  return h('h1', 'friends of ' + params.name);
                })
              );
            })
          );
        }

        setLocation('/');
        mount(render);

        return Promise.all([
          browser.find('h1', {text: 'root'}).shouldExist(),
          browser.find('h1', {text: 'people'}).shouldNotExist()
        ]).then(function () {
          expect(person.under().active).to.be.false;
          return browser.find('a', {text: 'jack'}).click();
        }).then(function () {
          return browser.find('h1', {text: 'person: jack'}).shouldExist();
        }).then(function () {
          expect(person.under().active).to.be.true;
          return browser.find('a', {text: 'friends'}).click();
        }).then(function () {
          expect(person.under().active).to.be.true;
          return browser.find('h1', {text: 'friends of jack'}).shouldExist();
        });
      });

      it('can bind properties when using under', function () {
        var root = router.route('/');
        var person = router.route('/people/:name');
        var personFriends = router.route('/people/:name/friends');

        function render(model) {
          return h('div',
            root(function () {
              return h('div',
                h('h1', 'root'),
                person({name: 'jack'}).link('jack')
              );
            }),
            person.under(
              {
                name: [model, 'name']
              },
              function () {
                return h('div',
                  h('h1', 'people'),
                  person(function () {
                    return h('div',
                      h('h1', 'person: ' + model.name),
                      personFriends({name: model.name}).link('friends')
                    );
                  }),
                  personFriends(function () {
                    return h('div',
                      h('h1', 'friends of ' + model.name),
                      h('button.bob', {
                        onclick: function () {
                          model.name = 'bob';
                        }
                      }, 'show bob')
                    );
                  })
                );
              }
            )
          );
        }

        setLocation('/');
        mount(render, {});

        return Promise.all([
          browser.find('h1', {text: 'root'}).shouldExist(),
          browser.find('h1', {text: 'people'}).shouldNotExist()
        ]).then(function () {
          expect(person.under().active).to.be.false;
          return browser.find('a', {text: 'jack'}).click();
        }).then(function () {
          return browser.find('h1', {text: 'person: jack'}).shouldExist();
        }).then(function () {
          expect(person.under().active).to.be.true;
          return browser.find('a', {text: 'friends'}).click();
        }).then(function () {
          expect(person.under().active).to.be.true;
          return browser.find('h1', {text: 'friends of jack'}).shouldExist();
        }).then(function () {
          return browser.find('button.bob').click();
        }).then(function () {
          return browser.find('h1', {text: 'friends of bob'}).shouldExist();
        }).then(function () {
          expect(person.under().active).to.be.true;
          expect(api.location().pathname).to.equal('/people/bob/friends');
        });
      });
    });

    it("can navigate to a route using push", function () {
      var root = router.route('/');
      var a = router.route('/a');
      var b = router.route('/b/:id');

      function render() {
        return h('div',
          root(function () {
            return h('h1', 'root');
          }),
          a(function () {
            return h('div',
              h('h1', 'a'),
                h('button', {onclick: function () {
                b({id: 'asdf'}).push();
              }}, 'b')
            );
          }),
          b(function (params) {
            return h('h1', 'b: ' + params.id);
          })
        );
      }

      setLocation('/');
      setLocation('/a');
      mount(render);

      return browser.find('button', {text: 'b'}).click().then(function () {
        return browser.find('h1', {text: 'b'}).shouldExist().then(function () {
          history.back();
          return browser.find('h1', {text: 'a'}).shouldExist();
        });
      });
    });

    if (apiName != 'hash') {
      it("can navigate to a route using replace", function () {
        var root = router.route('/');
        var a = router.route('/a');
        var b = router.route('/b/:id');

        function render() {
          return h('div',
            root(function () {
              return h('h1', 'root');
            }),
            a(function () {
              return h('div',
                h('h1', 'a'),
                  h('button', {onclick: function () {
                  b({id: 'asdf'}).replace();
                }}, 'b')
              );
            }),
            b(function (params) {
              return h('h1', 'b: ' + params.id);
            })
          );
        }

        setLocation('/');
        setLocation('/a');
        mount(render);

        return browser.find('button', {text: 'b'}).click().then(function () {
          return browser.find('h1', {text: 'b'}).shouldExist().then(function () {
            history.back();
            return browser.find('h1', {text: 'root'}).shouldExist();
          });
        });
      });
    }

    it('can return the href for a given route', function () {
      var a = router.route('/a');
      expect(a().href).to.equal('/a');
    });

    it('can return the href for a given route with params', function () {
      var a = router.route('/a/:id');
      expect(a({id: 'asdf', optional: 'yo'}).href).to.equal('/a/asdf?optional=yo');
    });

    it('can return the href for a given route with wildcard params', function () {
      var a = router.route('/a/:id/:path*');
      expect(a({id: 'asdf/qw er', path: 'a/b c/d', optional: 'yo'}).href).to.equal('/a/asdf%2Fqw%20er/a/b%20c/d?optional=yo');
    });
  });
}

describePlastiqRouter('hash');
describePlastiqRouter('historyApi');
describePlastiqRouter('hash', 'querystring');

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

var router = require('../..');
var expect = require('chai').expect;

describe('server routes', function () {
  it('routes can be constructed and interrogated on the server', function () {
    var a = router.route('/posts/:id');
    expect(a({id: 'asdf'}).href).to.equal('/posts/asdf');
  });
});

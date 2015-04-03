# plastiq-router

```bash
npm install plastiq-router
```

## routes

```js
var plastiqRouter = require('plastiq-router');

var router = plastiqRouter();

var root = router.route('/');

var user = router.route('/users/:userId', {
  onarrive: function (model, params) {
    model.userId = params.userId;
    return userApi.user(params.userId).then(function (user) {
      model.user = user;
    });
  },

  onleave: function (model) {
    delete model.userId;
    delete model.user;
  }
});

function render(model) {
  router.render(model, function () {
    if (model.userId) {
      return user({userId: model.userId}, user,
        model.user
          ? h('h1', user.name)
          : h('h1', 'loading...')
      );
    } else {
      return root(h('h1', 'root'));
    }
  });
}
```

## how does it work?

* the current route is set during rendering, in the `render` function above. As with the HTML, the current route is based on the state of the model.
* when the route is changed, either by entering a new URL into the address bar, or by clicking a link, the model is updated to reflect the new route. This is where the `onarrive` and `onleave` functions are invoked in each route, setting and unsetting the state of the model.

## API

### Requiring

```js
var plastiqRouter = require('plastiq-router');
```

### Creating a Router

```js
var router = plastiqRouter([options]);
```

* `options`
    * `history` - the type of history to use, by default this is the browser's history API (`plastiqRouter.history`).

### Creating Routes

```js
var route = router.route(path, [handlers]);
```

* `path` - the path of the route, can contain parameters in the form of `:name`, or `:name*` to include `/` characters.
* `handlers` - (optional)
    * `onarrive(model, params, state)`

        Called when we arrive at this route, allowing the model to be set appropriately

        * `model` - the model passed to the `router.render(model, render)` function.
        * `params` - the parameters extracted from the URL using the pattern in `path`
        * `state` - the state previously set in the history API for this URL, see `route([params, [state]], vdom)`

    * `onleave(model)`

        Called when we leave this route, allowing the model to be unset appropriately

        * `model` - the model passed to the `router.render(model, render)` function.

### Rendering a Route

```js
var vdom = route([params, [state]], vdom);
```

* `params` - (optional), the parameters to give the route from the model.
* `state` - (optional), the state to store in the history API for this URL.
* `vdom` - the VDOM to render for this route.

### Rendering your page

```js
var pageVdom = router.render(model, render);
```

* `model` - the page's model.
* `render` - a function rendering the vdom for the page.

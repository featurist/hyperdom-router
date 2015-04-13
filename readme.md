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
      return user({userId: model.userId}, model.user,
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

* **The model drives the URL**

    When the model changes and the page is rendered (with plastiq), the current URL is expressed by wrapping VDOM with a route. See how the `user` route is used in the `render` function above.

* **The URL drives the model**

    When the URL changes, either by typing a new URL or by navigating the browser back and forward, the new route adds properties to the model in the `onarrive` handler, and re-renders the page. When you navigate away from a route the `onleave` handler removes properties on the model.

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

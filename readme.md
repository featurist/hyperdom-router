# plastiq-router

* incredibly simple
* generate links from routes
* route parameters can be bound to the model

## rewrite + API simplication

Documentation for the 1.x API, can be found [here](https://github.com/featurist/plastiq-router/tree/v1).

## install

```bash
npm install plastiq-router
```

## example

You can see this example in action [here](http://www.featurist.co.uk/plastiq-router/example/)

* On the search page, notice how the URL changes as you type the search query.

```js
var plastiq = require('plastiq');
var h = plastiq.html;
var router = require('plastiq-router');

var routes = {
  root: router.route('/'),
  document: router.route('/document/:documentId'),
  search: router.route('/search')
};

var model = {
  documents: [
    {id: 0, title: 'One', content: 'With just one polka dot, nothing can be achieved...'},
    {id: 1, title: 'Two', content: 'Sometimes I am two people. Johnny is the nice one...'},
    {id: 2, title: 'Three', content: 'To be stupid, selfish, and have good health are three requirements for happiness...'}
  ]
};

function renderDocument(d) {
  return h('.document',
    h('h1', d.title),
    h('.content', d.content)
  );
}

router.start();

function render(model) {
  return h('div',
    routes.root().a('Home'),
    ' | ',
    routes.search().a('Search'),
    routes.root(function () {
      return h('ol.documents',
        model.documents.map(function (d, index) {
          return h('li', routes.document({documentId: index}).a(d.title));
        })
      );
    }),
    routes.document(function (params) {
      return renderDocument(model.documents[params.documentId]);
    }),
    routes.search({q: [model, 'query']}, function () {
      var query = model.query? model.query.toLowerCase(): undefined;
      return h('div',
        h('h1', 'search'),
        h('input', {type: 'text', binding: [model, 'query']}),
        h('ol.results',
          model.documents.filter(function (d) {
            return query && d.title.toLowerCase().indexOf(query) >= 0 || d.content.toLowerCase().indexOf(query) >= 0;
          }).map(function (d) {
            return h('li', routes.document({documentId: d.id}).a(d.title));
          })
        )
      );
    })
  );
}

plastiq.append(document.body, render, model);
```

# API

## start

```js
router.start([options]);
```

Starts the router, adding event handlers for navigation.

* `options.history` - a history driver, currently two supported: `router.historyApi` and `router.hash`.

## stop

```js
router.stop();
```

Stops the router, removing event handlers for navigation. This is particularly useful in test teardown.

## create a route

```js
var route = router.route(pattern);
```

* `pattern` - the path pattern: `/` or `/path`, or `/path/:id`, or `/path/:id/:path*`
* `route` - the route, to be used in rendering, see below

## render a route

Routes can be rendered in two forms, passive and active. Passive routes do not modify the route parameters, active routes bind the model to the route parameters, effectively allowing the URL to change as the model changes.

### passive routes

```js
route(function (params) {
  return vdom;
});
```

If the route is active, returns the `vdom` passing the `params` taken from the route to the function. If the route is not active, `undefined` is returned.

* `params` - the params taken from the route, these can be from `:param` elements in the route pattern or query string parameters.

### active routes

```js
route(bindings, function () {
  return vdom;
});
```

* `bindings` - how the model binds on to the route parameters, takes the form:

    ```js
    {
      param1: [model, 'param1'],
      param2: [model, 'param2']
    }
    ```

    Where the object keys are the parameter names, and the values are the bindings onto the model.

## route instances

```js
var routeInstance = route([params]);
```

* `params` - an optional object containing the parameters of the form:

    ```js
    {param1: 'param1 value', param2: 'param2 value'}
    ```

### href

```js
routeInstance.href
```

The root-relative HREF of the route - of the form `/path`.

### active

```js
routeInstance.active
```

Whether the route is currently active.

### push, replace

```js
routeInstance.push()
routeInstance.replace()
```

Either push the route onto the history stack (using history.pushState) or replace the current URL (using history.replaceState). Replace only works with the router.historyApi driver, which is the default.

### a, anchor, link

```js
routeInstance.a([options], contents, ...)
```

Generates virtual DOM for an anchor for the route, passing the arguments to `h('a', options, contents, ...)`, but with the correct `href` and `onclick` properties set.

# plastiq-router

* incredibly simple
* works with History API or Hashes
* generate links from routes
* route parameters can be bound to the model
* hierarchical routes

## install

```bash
npm install plastiq-router
```

# How?

## Declare Your Routes

```js
var router = require('plastiq-router');

var routes = {
  home = router.route('/'),
  posts = router.post('/posts'),
  post = router.post('/posts/:postId')
};
```

## Start the Router

```js
router.start();
```

By default it uses the History API for nice clean URLs, but you can use `#hash` URLs too if you feel strongly about it.

```js
router.start(router.hash);
```

## Render the Routes

In your plastiq render function, just use the different routes to conditionally render different HTML, depending on the current URL:

```js
function render() {
  return h('div',
    routes.home(function () {
      return h('h1', 'Home');
    }),
    routes.post(function (params) {
      return [
        h('h1', 'Post ' + params.postId),
        h('.post', posts[params.postId])
      ];
    })
  );
}
```

When the URL is `/` the code inside the `routes.home()` function will render. When the URL is `/posts/blah`, the `routes.post()` function will render, being passed the parameters `{postId: 'blah'}`.

## Link to Routes

You can create a link to a route:

```js
routes.post({postId: 'blah'}).link('My Post on Blah');
```

Sometimes you may want to indicate that this route is the current one and highlight it in CSS by giving it a class:

```js
var route = routes.post({postId: 'blah'});
route.link({class: {active: route.active}}, 'My Post on Blah');
```

## Bind the Model

You can bind your model onto a route, so when the model changes, the URL changes, and when the URL changes, the model changes:

```js
var search = router.route('/search');

function renderSearch(model) {
  return search({q: [model, 'search']}, function () {
    h('label', 'Search', h('input', {binding: [model, 'search']}))
  });
}
```

When you type `asdf` into the search box, the URL will become `/search?q=asdf`. If you go to `/search?q=bobo` the search box will contain `bobo`.

## Setting up the Model

You can set your model up when you arrive at a route by setting `onarrival`. If it returns a promise, it will re-render the page when the promise resolves:

```js
var routes = {
  var posts = router.route('/posts'),
  var post = router.route('/posts/:postId')
};

function renderPosts(model) {
  function loadPosts() {
    // return a promise, so we re-render when the posts have loaded
    return httpism.get('/api/posts').then(function (response) {
      model.posts = response.body;
    })
  }

  return routes.posts({onarrival: loadPosts}, function () {
    h('ul',
      model.posts.map(function (post) {
        // render a link to each post
        return h('li', routes.post({postId: post.id}).link(post.title));
      })
    )
  });
}
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

router.start();

function render(model) {
  return h('div',
    renderLinks(),

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
      return h('div',
        h('h1', 'search'),
        h('input', {type: 'text', binding: [model, 'query']}),
        h('ol.results',
          model.searchDocuments(model.query).map(function (d) {
            return h('li', routes.document({documentId: d.id}).a(d.title));
          })
        )
      );
    })
  );
}

var model = {
  documents: [
    {id: 0, title: 'One', content: 'With just one polka dot, nothing can be achieved...'},
    {id: 1, title: 'Two', content: 'Sometimes I am two people. Johnny is the nice one...'},
    {id: 2, title: 'Three', content: 'To be stupid, selfish, and have good health are three requirements for happiness...'}
  ],
  searchDocuments: function (q) {
    var query = q? q.toLowerCase(): undefined;

    return this.documents.filter(function (d) {
      return query && d.title.toLowerCase().indexOf(query) >= 0 || d.content.toLowerCase().indexOf(query) >= 0;
    });
  }
};

function renderLinks() {
  return [
    routes.root().a('Home'),
    ' | ',
    routes.search().a('Search')
    ' | ',
    h('a', {href: 'https://github.com/featurist/plastiq-router'}, 'Github')
  ];
}

function renderDocument(d) {
  return h('.document',
    h('h1', d.title),
    h('.content', d.content)
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

* `options.history` - a history driver, currently two supported: `router.historyApi` (the default) and `router.hash`.

## stop

```js
router.stop();
```

Stops the router, removing event handlers for navigation. However does not remove existing routes, for that see `router.clear()`. This is particularly useful in test teardown.

## clear

```js
router.clear();
```

Clears all routes, removes event handlers. This is a complete teardown of the router, unlike `router.stop()`.

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

* `params` - the parameters taken from the route, these can be from `:param` elements in the route pattern or query string parameters.

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

    When these parameters change, by default, the URL will replace the old URL. If you want to ensure that changing a parameter moves the browser forward in history, you can name the parameter in the `push` array:

    ```js
    {
      param1: [model, 'param1'],
      param2: [model, 'param2'],
      push: ['param1']
    }
    ```

    Here, if `param2` changes, the URL will be replaced. But if `param1` changes the URL will be pushed, and you can go back to the previous value.

### onarrival, ondeparture

You can setup or cleanup your model on the events `onarrival` and `ondeparture`:

```js
route(
  {
    onarrival: function (params) {
      // setup model
    },

    ondeparture: function () {
      // cleanup model
    }
  },
  functon () {
    return vdom;
  }
);
```

* `params` - the parameters taken from the route, these can be from `:param` elements in the route pattern or query string parameters.

### under

Hierarchies of routes can be made by using `route.under(render)`, which executes the **render function** if the current location is on or under the route.

Let's say we have a route:

```js
var posts = router.route('/posts');
```

You can use `posts.under()` to match on URLs like `/posts` or `/posts/1` or `/posts/1/comments`, etc.

```js
function render() {
  return h('div',
    posts.under(function () {
      return h('div',
        posts(function () {
          // show all posts
        }),
        post(function (params) {
          // show just one post
        })
      });
    })
  );
}
```

If you don't pass a function to `route.under()` it will return an object with an `active` field, set to `true` if the current URL is on or under the route, or `false` otherwise.

## pattern

You can access the route's pattern. Compatible with express, so they're useful if you're trying to match routes on the server-side.

```js
var posts = router.route('/posts/:id');

app.get(posts.pattern, function (req, res) { ... });
```

## route instances

```js
var routeInstance = route([params]);
```

* `params` - an optional object containing the parameters of the form:

    ```js
    {param1: 'param1 value', param2: 'param2 value'}
    ```

Routes can be used from the server-side too! Although really only `href` works or makes any sense.

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
routeInstance.link([options], contents, ...)
routeInstance.a([options], contents, ...)
```

Generates virtual DOM for an anchor for the route, passing the arguments to `h('a', options, contents, ...)`, but with the correct `href` and `onclick` properties set.

var plastiq = require('plastiq');
var h = plastiq.html;
var router = require('plastiq-router');

var baseUrl = '/plastiq-router/example';

var routes = {
  root: router.route(baseUrl + '/'),
  document: router.route(baseUrl + '/document/:documentId'),
  search: router.route(baseUrl + '/search')
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
    routes.search().a('Search'),
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

(function() {
  'use strict';

  angular
    .module('gcloud')
    .config(docsRoutes);

  /** @ngInject */
  function docsRoutes($stateProvider, $urlRouterProvider, $urlMatcherFactoryProvider, manifest) {
    // source: https://github.com/sindresorhus/semver-regex
    var regSemver = '\\bv?(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)(?:-[\\da-z\-]+(?:\\.[\\da-z\\-]+)*)?(?:\\+[\\da-z\\-]+(?:\\.[\\da-z\\-]+)*)?\\b';
    var latestVersion = manifest.versions[0];

    $urlMatcherFactoryProvider.type('nonURIEncoded', {
      encode: toString,
      decode: toString,
      is: function() { return true; }
    });

    $stateProvider
      .state('docs', {
        // ui-router allows one to optionally use a regular expressions to
        // match uri parameters against. In this instance we're only allowing
        // the version value to be "master" OR a valid semver version.
        // If we receive a route that does NOT match one of these two values
        // then we'll end up in the $urlRouterProvier.otherwise(...) block
        // which will look for version alias's or the absense of a version
        // and redirect the user appropriately
        url: '/docs/{version:master|' + regSemver + '}',
        templateUrl: 'app/docs/docs.html',
        controller: 'DocsCtrl',
        controllerAs: 'docs',
        resolve: {
          lastBuiltDate: getLastBuiltDate
        },
        params: {
          version: latestVersion
        },
        redirectTo: 'docs.service'
      })
      .state('docs.guides', {
        url: '/guides/:guideId?section',
        templateUrl: 'app/guide/guide.html',
        controller: 'GuideCtrl',
        controllerAs: 'guide',
        resolve: { guideObject: getGuide }
      })
      .state('docs.service', {
        url: '/{serviceId:nonURIEncoded}?method',
        templateUrl: 'app/service/service.html',
        controller: 'ServiceCtrl',
        controllerAs: 'service',
        resolve: { serviceObject: getService },
        params: {
          serviceId: 'gcloud'
        }
      });

    $urlRouterProvider.when('/docs', goToGcloud);

    $urlRouterProvider.otherwise(function($injector, $location) {
      var path = $location.path();
      var docsBaseUrl = '/docs/';
      var isUnknownRoute = path.indexOf(docsBaseUrl) === -1;

      if (isUnknownRoute) {
        return '/';
      }

      var versions = $injector.get('manifest').versions;
      var params = path.replace(docsBaseUrl, '').split('/');
      var isValidVersion = versions.indexOf(params[0]) !== -1;

      // could be a bad service name
      if (isValidVersion) {
        return docsBaseUrl + params[0];
      }

      // could be a version alias
      if (params[0] === 'latest' || params[0] === 'stable') {
        params[0] = latestVersion;
      } else {
        // otherwise let's assume the version was omitted entirely
        params.unshift(latestVersion);
      }

      return docsBaseUrl + params.join('/');
    });
  }

  /** @ngInject */
  function getLastBuiltDate($http, manifest) {
    var url = 'https://api.github.com/repos/GoogleCloudPlatform/gcloud-' +
      manifest.lang + '/commits?sha=gh-pages&per_page=1';

    return $http({
      method: 'get',
      url: url,
      cache: true
    })
    .then(function(resp) {
      return resp.data[0].commit.committer.date;
    })
    .then(null, angular.noop);
  }

  /** @ngInject */
  function getGuide($state, $stateParams, util, manifest) {
    var guideId = $stateParams.guideId.replace(/\-/g, ' ');
    var guide = util.findWhere(manifest.guides, { id: guideId });

    if (!guide) {
      return $state.go('docs.service');
    }

    return guide;
  }

  /** @ngInject */
  function getService($state, $stateParams, $interpolate, $http, manifest, util) {
    var ids = $stateParams.serviceId.split('/');
    var serviceId = ids.shift();
    var pageId = ids.join('/');
    var service = util.findWhere(manifest.services, { id: serviceId });
    var pageTitle = service && service.title ? [service.title] : null;
    var resource = service.contents;

    if (service && pageId) {
      var page = util.findWhere(service.nav, { id: pageId });
      if (page) {
        resource = page.contents;
        pageTitle.push(page.title);
      } else {
        resource = $stateParams.serviceId + '.json';
      }
    }

    var json = $interpolate('{{content}}/{{version}}/{{resource}}')({
      content: manifest.content,
      version: $stateParams.version,
      resource: resource
    });

    return $http.get(json).then(function(response) {
      var data = response.data;
      if (typeof data.metadata.title === 'undefined') {
        data.metadata.title = pageTitle;
      }
      return data;
    });
  }

  /** @ngInject */
  function goToGcloud($state, $stateParams) {
    $state.go('docs.service', {
      version: $stateParams.version,
      serviceId: 'gcloud'
    });
  }

  function toString(val) {
    return val ? val.toString() : null;
  }

}());

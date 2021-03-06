// Copyright (C) 2012 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Google API taming tests.
 *
 * This file tests the taming framework, not the taming of specific Google APIs.
 * For those tests, see tests/com/google/caja/apitaming.
 *
 * @author ihab.awad@gmail.com
 * @requires caja, jsunitRun, readyToTest, basicCajaConfig
 */


////////////////////////////////////////////////////////////////////////
// A dummy "Google API" for testing

(function() {
  "use strict";

  // Miscellaneous functions
  function getValue(a) { return 'foo' + a; }
  function getValueProhibited(a) { return 'fooProhibited' + a; }
  function advisedBA(a) { return 'v' + a + 'v'; }
  function advisedAround(a) { return 'x' + a + 'x'; }

  function Sup(x) { this.x = x; }
  Sup.someStatic = function(x) { return x + 19; };
  Sup.prototype.getX = function() { return this.x; };
  Sup.prototype.setX = function(x) { this.x = x; };

  function Sub(x, y) { Sup.apply(this, [x]); this.y = y; }
  Sub.prototype = new Sup(0);
  Sub.prototype.getY = function() { return this.y; };
  Sub.prototype.setY = function(y) { this.y = y; };

  window.google = {
    foo: {
      getValue: getValue,
      getValueProhibited: getValueProhibited,
      advisedBA: advisedBA,
      advisedAround: advisedAround,
      Sup: Sup,
      Sub: Sub
    },
    bar: {
      customGoogleLoadCalled: false,
      getValue: function(a) { return 'bar' + a; },
      isCustomGoogleLoadCalled: function() {
        return window.google.bar.customGoogleLoadCalled;
      }
    },
    load: function(name, opt_version, opt_info) {
      window.setTimeout(opt_info.callback, 0);
    }
  };
})();


////////////////////////////////////////////////////////////////////////
// Insert taming framework scripts

(function() {
  "use strict";
  function loadScript(url, cb) {
    var s = document.createElement('script');
    s.setAttribute('src', url);
    s.onload = cb;  // TODO(ihab.awad): Will not work on IE
    document.head.appendChild(s);
  }

  loadScript('../apitaming/cajaTamingGoogleLoader.js', function() {
    loadScript('../apitaming/google.load.loaderFactory.js', function() {
      runtests();
    });
  });
})();


////////////////////////////////////////////////////////////////////////
// Tests

function runtests() {
  "use strict";

  caja.initialize(basicCajaConfig);

  var uriPolicy = {
    rewrite: function (uri, uriEffect, loaderType, hints) { return uri; }
  };

  caja.tamingGoogleLoader.addPolicyFactoryUrl(
      'google.foo',
      './google.foo.policyFactory.js');
  caja.tamingGoogleLoader.addPolicyFactoryUrl(
      'google.bar',
      './google.bar.policyFactory.js');

  var goArray = [];

  ///////////////////////////////////////////////////////////////////////
  // Test guest "0". Whitelisted for both APIs "foo" and "bar". Should
  // demonstrate that it has access to both.

  caja.load(createDiv(), uriPolicy, function (frame) {

    var t = caja.tamingGoogleLoader.applyToFrame(frame, {
      google: {
        initialObj: frame.markReadOnlyRecord({
          initialFcn: frame.markFunction(function(x) {
            return x + 19;
          })
        })
      }
    });

    t.whitelistApi('google.foo');
    t.whitelistApi('google.bar');

    frame.code('test-apitaming-guest-0.html')
         .api(createExtraImportsForTesting(caja, frame))
         .run(function (_) { goArray[0] = t; });
  });

  ///////////////////////////////////////////////////////////////////////
  // Test guest "1". Whitelisted for only API "foo". Should demonstrate
  // that it only has access to what it's allowed to have.

  caja.load(createDiv(), uriPolicy, function (frame) {

    var t = caja.tamingGoogleLoader.applyToFrame(frame);
    t.whitelistApi('google.foo');

    frame.code('test-apitaming-guest-1.html')
         .api(createExtraImportsForTesting(caja, frame))
         .run(function (_) { goArray[1] = t; });
  });

  ///////////////////////////////////////////////////////////////////////
  // Startup code, waits till both guests loaded before proceeding. This
  // ensures that the API "bar" is already loaded into guest "0"; otherwise
  // guest "1" could be failing to get "bar" because it hasn't been loaded
  // yet, and not due to the success of the selective whitelisting. :)

  function check() {
    window.setTimeout(function() {
      if (goArray[0] && goArray[1]) {
        goArray[0].signalOnload();
        goArray[1].signalOnload();
        readyToTest();
        jsunitRun();
      } else {
        check();
      }
    }, 250);
  }

  check();
}

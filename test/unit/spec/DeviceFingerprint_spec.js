define([
  'helpers/util/Expect',
  'sandbox',
  'util/DeviceFingerprint'
],
function (Expect, $sandbox, DeviceFingerprint) {

  Expect.describe('DeviceFingerprint', function () {

    function mockIFrameMessages (success, errorMessage) {
      var message = success ? {
        type: 'FingerprintAvailable',
        fingerprint: 'thisIsTheFingerprint'
      } : errorMessage;
      window.postMessage(JSON.stringify(message), '*');
    }

    function mockUserAgent (userAgent) {
      spyOn(DeviceFingerprint, 'getUserAgent').and.callFake(function () {
        return userAgent;
      });
    }

    function bypassMessageSourceCheck () {
      // since we mock the Iframe messages the check to see if the message
      // sent from right iframe would fail.
      spyOn(DeviceFingerprint, 'isMessageFromCorrectSource').and.callFake(function () {
        return true;
      });
    }

    var baseUrl = window.origin || 'file://';

    it('iframe is created with the right src and it is hidden', function () {
      spyOn(window, 'addEventListener');
      DeviceFingerprint.generateDeviceFingerprint('baseUrl', $sandbox);
      var $iFrame = $sandbox.find('iframe');
      expect($iFrame).toExist();
      expect($iFrame.attr('src')).toBe('baseUrl/auth/services/devicefingerprint');
      expect($iFrame.is(':visible')).toBe(false);
      expect(window.addEventListener).toHaveBeenCalledWith('message', jasmine.any(Function), false);
    });

    it('returns a fingerprint if the communication with the iframe is successfull', function () {
      // Test fails in PhantomJS
      if (window.top.callPhantom) {
        return;
      }
      mockIFrameMessages(true);
      bypassMessageSourceCheck();
      return DeviceFingerprint.generateDeviceFingerprint(baseUrl, $sandbox)
        .then(function (fingerprint) {
          expect(fingerprint).toBe('thisIsTheFingerprint');
        });
    });

    it('fails if there is a problem with communicating with the iframe', function (done) {
      mockIFrameMessages(false);
      bypassMessageSourceCheck();
      DeviceFingerprint.generateDeviceFingerprint(baseUrl, $sandbox)
        .then(function () {
          done.fail('Fingerprint promise should have been rejected');
        })
        .catch(function (reason) {
          expect(reason).toBe('no data');
          var $iFrame = $sandbox.find('iframe');
          expect($iFrame).not.toExist();
          done();
        });
    });

    it('fails if there iframe sends and invalid message content', function (done) {
      mockIFrameMessages(false, { type: 'InvalidMessageType' });
      bypassMessageSourceCheck();
      DeviceFingerprint.generateDeviceFingerprint(baseUrl, $sandbox)
        .then(function () {
          done.fail('Fingerprint promise should have been rejected');
        })
        .catch(function (reason) {
          expect(reason).toBe('no data');
          var $iFrame = $sandbox.find('iframe');
          expect($iFrame).not.toExist();
          done();
        });
    });

    it('fails if user agent is not defined', function (done) {
      mockUserAgent();
      mockIFrameMessages(true);
      DeviceFingerprint.generateDeviceFingerprint(baseUrl, $sandbox)
        .then(function () {
          done.fail('Fingerprint promise should have been rejected');
        })
        .catch(function (reason) {
          var $iFrame = $sandbox.find('iframe');
          expect($iFrame).not.toExist();
          expect(reason).toBe('user agent is not defined');
          done();
        });
    });

    it('fails if it is called from a Windows phone', function (done) {
      mockUserAgent('Windows Phone');
      mockIFrameMessages(true);
      DeviceFingerprint.generateDeviceFingerprint(baseUrl, $sandbox)
        .then(function () {
          done.fail('Fingerprint promise should have been rejected');
        })
        .catch(function (reason) {
          expect(reason).toBe('device fingerprint is not supported on Windows phones');
          var $iFrame = $sandbox.find('iframe');
          expect($iFrame).not.toExist();
          done();
        });
    });

    it('ignores if message is not from right iframe', function (done) {
      spyOn(DeviceFingerprint, 'isMessageFromCorrectSource').and.callFake(() => {
        return false;
      });
      mockIFrameMessages(true);
      const messageHandler = () => {
        expect(DeviceFingerprint.isMessageFromCorrectSource).toHaveBeenCalled();

        // When promise either resolved or rejected, the iframe will be removed.
        // Verify the exists of iframe implies promise is neither resolved nor rejected
        var $iFrame = $sandbox.find('iframe');
        expect($iFrame).toExist();
        expect($iFrame.attr('src')).toBe(baseUrl + '/auth/services/devicefingerprint');
        expect($iFrame.is(':visible')).toBe(false);

        window.removeEventListener('message', messageHandler, false);
        done();
      };

      DeviceFingerprint.generateDeviceFingerprint(baseUrl, $sandbox);
      expect(DeviceFingerprint.isMessageFromCorrectSource).not.toHaveBeenCalled();

      window.addEventListener('message', messageHandler, false);
    });

  });
});

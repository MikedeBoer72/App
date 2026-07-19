/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'YourLevel Widget',
  deploymentTarget: '16.4',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.yourlevel.app'],
  },
};

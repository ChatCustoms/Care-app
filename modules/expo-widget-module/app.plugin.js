const { withAndroidManifest } = require('expo/config-plugins');

// Registers the widget's GlanceAppWidgetReceiver in the app's manifest.
// The receiver's own AndroidManifest.xml (in this local module) is left
// empty deliberately — a widget receiver is inherently app-specific
// configuration (intent-filters, meta-data pointing at a resource that
// must exist in the final merged resource set), so it's declared here via
// an explicit config plugin, the same way targets/widget/expo-target.config.js
// explicitly wires up the iOS widget target rather than relying on any
// kind of automatic merging.
function withCareWidgetReceiver(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    if (!application.receiver) application.receiver = [];

    const alreadyRegistered = application.receiver.some(
      (receiver) => receiver.$?.['android:name'] === '.CareWidgetReceiver'
    );
    if (alreadyRegistered) return config;

    application.receiver.push({
      $: {
        'android:name': 'expo.modules.widgetmodule.CareWidgetReceiver',
        'android:exported': 'false',
        'android:label': 'Care App',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
          ],
        },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.appwidget.provider',
            'android:resource': '@xml/care_widget_info',
          },
        },
      ],
    });

    return config;
  });
}

module.exports = withCareWidgetReceiver;

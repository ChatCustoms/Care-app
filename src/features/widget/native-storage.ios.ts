import { ExtensionStorage } from '@bacons/apple-targets';

import { WidgetPayload } from './logic';

// Must match app.config.ts's ios.entitlements App Group and
// targets/widget/widgets.swift's appGroupId — there's no way to thread a
// single TS constant into the Swift source, so this is a second,
// unavoidable place the group id has to be kept in sync by hand.
const APP_GROUP_ID = 'group.com.stephanochatham.careapp';
const WIDGET_PAYLOAD_KEY = 'widgetPayload';

export function writeWidgetPayload(payload: WidgetPayload): void {
  const storage = new ExtensionStorage(APP_GROUP_ID);
  storage.set(WIDGET_PAYLOAD_KEY, JSON.stringify(payload));
  ExtensionStorage.reloadWidget();
}

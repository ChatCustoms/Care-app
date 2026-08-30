import { WidgetPayload } from './logic';

// Bare (no platform extension) fallback — resolved for web, where there's
// no Home Screen widget concept. A no-op, not an error: this file exists
// so the sync hook can call writeWidgetPayload() unconditionally without
// caring which platform it's on.
export function writeWidgetPayload(_payload: WidgetPayload): void {}

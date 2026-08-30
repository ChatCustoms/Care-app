import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoWidgetModule extends NativeModule<{}> {
  updateWidgetPayload(json: string): Promise<void>;
}

export default requireNativeModule<ExpoWidgetModule>('ExpoWidgetModule');

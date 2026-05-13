interface LocalNotification {
  id: number;
  title: string;
  text: string;
  trigger: { at: Date };
}

interface LocalNotificationPlugin {
  requestPermission(callback: (granted: boolean) => void): void;
  schedule(notifications: LocalNotification[]): void;
  cancelAll(callback?: () => void): void;
  cancel(ids: number[]): void;
}

interface CordovaPlugins {
  notification?: {
    local?: LocalNotificationPlugin;
  };
}

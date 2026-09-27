import { Alert } from 'react-native';

let currentAlertListener = null;

export const registerAlertListener = (listener) => {
  currentAlertListener = listener;
};

export const unregisterAlertListener = () => {
  currentAlertListener = null;
};

const nativeAlert = Alert.alert.bind(Alert);

export const showCustomAlert = (title, message, buttons, options) => {
  if (currentAlertListener) {
    currentAlertListener({ title, message, buttons, options });
  } else {
    nativeAlert(title, message, buttons, options);
  }
};

// Monkey-patch React Native's Alert.alert to intercept all alert popups globally
Alert.alert = showCustomAlert;

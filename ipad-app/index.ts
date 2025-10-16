import { registerRootComponent } from 'expo';
import { Buffer } from 'buffer';

// Set up Buffer polyfill for React Native
global.Buffer = Buffer;

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

import { render } from 'solid-js/web';
import { App } from './App';
import { installColorMixPolyfill } from './utils/colorMixPolyfill';
import './styles/main.scss';

installColorMixPolyfill();

const root = document.getElementById('root');

if (root) {
  render(() => <App />, root);
}

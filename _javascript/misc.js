import { showPage } from './modules/effects';
import { basic, initSidebar, initTopbar } from './modules/layouts';
import { initLocaleDatetime } from './modules/plugins';

initSidebar();
initTopbar();
initLocaleDatetime();
basic();
showPage();
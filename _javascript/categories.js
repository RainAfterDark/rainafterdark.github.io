import { showPage } from './modules/effects';
import { basic, initSidebar, initTopbar } from './modules/layouts';
import { categoryCollapse } from './modules/plugins';

basic();
initSidebar();
initTopbar();
categoryCollapse();
showPage();
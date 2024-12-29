import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';

import 'hammerjs'; //used for swiping


platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));

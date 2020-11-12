import { APP_INITIALIZER, Injectable, Injector, ModuleWithProviders, NgModule, NgModuleFactoryLoader } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TranslocoModule } from '@ngneat/transloco';
import { TranslocoRouterService } from './transloco-router.service';
import { DummyLocalizeParser, TranslocoRouterParser } from './transloco-router.parser';
import { TranslocoRouterConfigLoader } from './transloco-router.config-loader';
import { TranslocoRouterPipe } from './transloco-router.pipe';
import { TranslocoRouterDetection } from './transloco-router.detection';
import { ALWAYS_SET_PREFIX, RAW_ROUTES, TranslocoRouterSettings } from './transloco-router.config';


@Injectable()
export class ParserInitializer {
  parser: TranslocoRouterParser;
  routes: Routes;

  constructor(private injector: Injector) {}

  appInitializer(): Promise<any> {
    const res = this.parser.load(this.routes);
    res.then(() => {
      const localize: TranslocoRouterService = this.injector.get(TranslocoRouterService);
      localize.init();
    });

    return res;
  }

  generateInitializer(parser: TranslocoRouterParser, routes: Routes[]): () => Promise<any> {
    this.parser = parser;
    this.routes = routes.reduce((a, b) => a.concat(b));
    return this.appInitializer;
  }
}

export function getAppInitializer(p: ParserInitializer, parser: TranslocoRouterParser, routes: Routes[]): any {
  return p.generateInitializer(parser, routes).bind(p);
}



@NgModule({
  imports: [
    RouterModule,
    TranslocoModule,
  ],
  declarations: [TranslocoRouterPipe],
  exports: [TranslocoRouterPipe],
})
export class TranslocoRouterModule {

  static forRoot(routes: Routes, config: any = {}): ModuleWithProviders {
    return {
      ngModule: TranslocoRouterModule,
      providers: [
        { provide: ALWAYS_SET_PREFIX, useValue: config.alwaysSetPrefix },
        {
          provide: RAW_ROUTES,
          multi: true,
          useValue: routes
        },
        TranslocoRouterSettings,
        config.parser || { provide: TranslocoRouterParser, useClass: DummyLocalizeParser },
        TranslocoRouterService,
        TranslocoRouterDetection,
        ParserInitializer,
        { provide: NgModuleFactoryLoader, useClass: TranslocoRouterConfigLoader },
        {
          provide: APP_INITIALIZER,
          multi: true,
          useFactory: getAppInitializer,
          deps: [ParserInitializer, TranslocoRouterParser, RAW_ROUTES]
        }
      ],
    };
  }

  static forChild(routes: Routes): ModuleWithProviders {
    return {
      ngModule: TranslocoRouterModule,
      providers: [{
        provide: RAW_ROUTES,
        multi: true,
        useValue: routes
      }]
    };
  }
}

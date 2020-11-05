import { ROUTES } from '@angular/router';
import {
  SystemJsNgModuleLoader, NgModuleFactory, Injector,
  SystemJsNgModuleLoaderConfig, Optional, Compiler, Injectable, Inject, forwardRef
} from '@angular/core';
import { TranslocoRouterParser } from './transloco-router.parser';

/**
 * Extension of SystemJsNgModuleLoader to enable localization of route on lazy load
 */
@Injectable()
export class TranslocoRouterConfigLoader extends SystemJsNgModuleLoader {

  constructor(@Inject(forwardRef(() => TranslocoRouterParser)) private localize: TranslocoRouterParser,
              compiler: Compiler,
              @Optional() config?: SystemJsNgModuleLoaderConfig) {
    super(compiler, config);
  }

  load(path: string): Promise<NgModuleFactory<any>> {
    return super.load(path).then((factory: NgModuleFactory<any>) => {
      return {
        moduleType: factory.moduleType,
        create: (parentInjector: Injector) => {
          const module = factory.create(parentInjector);
          const getMethod = module.injector.get.bind(module.injector);

          module.injector.get = (token: any, notFoundValue: any) => {
            const getResult = getMethod(token, notFoundValue);

            if (token === ROUTES) {
              // translate lazy routes
              return this.localize.initChildRoutes([].concat(...getResult));
            } else {
              return getResult;
            }
          };
          return module;
        }
      };
    });
  }
}

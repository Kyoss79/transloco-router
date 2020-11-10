import { Inject } from '@angular/core';
import { Route, Routes } from '@angular/router';
import { TranslocoService } from '@ngneat/transloco';
import { TranslocoRouterSettings } from './transloco-router.config';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TranslocoRouterDetection } from './transloco-router.detection';


export abstract class TranslocoRouterParser {
  locales: Array<string>;
  currentLang: string;
  routes: Routes;
  defaultLang: string;

  protected prefix: string;

  private _translationObject: any;
  private _cachedLang: any;
  private wildcardRoute: Route;
  private languageRoute: Route;
  private baseRoute: Route;

  constructor(
    @Inject(TranslocoService) private translate: TranslocoService,
    @Inject(TranslocoRouterDetection) public detection: TranslocoRouterDetection,
    @Inject(TranslocoRouterSettings) private settings: TranslocoRouterSettings
  ) {}

  /**
   * Load routes and fetch necessary data
   */
  abstract load(routes: Routes): Promise<any>;


  /**
   * Initialize language and routes
   */
  protected init(routes: Routes): Promise<any> {
    this.routes = routes;

    if (!this.locales || !this.locales.length) {
      return Promise.resolve();
    }

    /** detect current language */
    const detectedLanguage = this.detection.detect(this.locales);
    this.defaultLang = 'en';

    const selectedLanguage = detectedLanguage || this.defaultLang;
    this.translate.setDefaultLang(selectedLanguage);
    this.translate.setActiveLang(selectedLanguage);

    let children: Routes = [];

    /** if set prefix is enforced */
    if (this.settings.alwaysSetPrefix) {
      this.baseRoute = { path: '', redirectTo: this.defaultLang, pathMatch: 'full' };

      /** extract potential wildcard route */
      const wildcardIndex = routes.findIndex((route: Route) => route.path === '**');
      if (wildcardIndex !== -1) {
        this.wildcardRoute = routes.splice(wildcardIndex, 1)[0];
      }
      children = this.routes.splice(0, this.routes.length, this.baseRoute);
    } else {
      children = this.routes.splice(0, this.routes.length);
    }

    /** exclude certain routes */
    for (let i = children.length - 1; i >= 0; i--) {
      if (children[i].data && children[i].data.skipRouteLocalization) {
        this.routes.push(children[i]);
        children.splice(i, 1);
      }
    }

    /** append children routes */
    if (children && children.length) {
      if (this.locales.length > 1 || this.settings.alwaysSetPrefix) {
        this.languageRoute = { children };
        this.routes.unshift(this.languageRoute);
      } else {
        this.routes.unshift(...children);
      }
    }

    /** ...and potential wildcard route */
    if (this.wildcardRoute && this.settings.alwaysSetPrefix) {
      this.routes.push(this.wildcardRoute);
    }

    /** translate routes */
    return this.translateRoutes(selectedLanguage).toPromise();
  }

  initChildRoutes(routes: Routes) {
    this._translateRouteTree(routes);
    return routes;
  }

  mutateRouterRootRoute(currentLanguage: string, previousLanguage: string, routes: Routes) {
    const previousTranslatedLanguage = this.settings.alwaysSetPrefix || previousLanguage !== this.defaultLang ?
      previousLanguage : '';
    const currentTranslatedLanguage = this.settings.alwaysSetPrefix || currentLanguage !== this.defaultLang ?
      currentLanguage : '';

    const baseRoute = routes.find(route => route.path === previousTranslatedLanguage);

    if (baseRoute) {
      baseRoute.path = currentTranslatedLanguage;
      baseRoute.path = currentTranslatedLanguage;
    }

    // if there's an empty path being redirected to the language root, we have to change the redirectTo parameter
    const baseRedirectRoute = routes.find( route => route.redirectTo === previousTranslatedLanguage && route.path === '');

    if (baseRedirectRoute) {
      baseRedirectRoute.redirectTo = currentLanguage;
    }
  }

  /**
   * Translate routes to selected language
   */
  translateRoutes(language: string): Observable<any> {
    this.setRootLanguage(language);

    return this.translate.selectTranslation(language)
      .pipe(
        map(translations => {
          this._translationObject = translations;
          this.currentLang = language;

          if (this.languageRoute) {
            this._translateRouteTree(this.languageRoute.children);

            // if there is wildcard route
            if (this.wildcardRoute && this.wildcardRoute.redirectTo) {
              this._translateProperty(this.wildcardRoute, 'redirectTo', true);
            }
          } else {
            this._translateRouteTree(this.routes);
          }
        })
      );
  }

  private setRootLanguage(language: string) {
    this._cachedLang = language;

    if (this.languageRoute) {
      const newPath = this.settings.alwaysSetPrefix || language !== this.defaultLang ?
        language : '';
      this.languageRoute.path = newPath;
    }
    if (this.baseRoute) {
      this.baseRoute.redirectTo = language;
    }
  }

  /**
   * Translate the route node and recursively call for all it's children
   */
  private _translateRouteTree(routes: Routes): void {
    routes.forEach((route: Route) => {
      if (route.path && route.path !== '**') {
        this._translateProperty(route, 'path');
      }
      if (route.redirectTo) {
        this._translateProperty(route, 'redirectTo', !route.redirectTo.indexOf('/'));
      }
      if (route.children) {
        this._translateRouteTree(route.children);
      }
      if (route.loadChildren && (route as any)._loadedConfig) {
        this._translateRouteTree((route as any)._loadedConfig.routes);
      }
    });
  }

  /**
   * Translate property
   * If first time translation then add original to route data object
   */
  private _translateProperty(route: Route, property: string, prefixLang?: boolean): void {
    // set property to data if not there yet
    const routeData: any = route.data = route.data || {};
    if (!routeData.localizeRouter) {
      routeData.localizeRouter = {};
    }
    if (!routeData.localizeRouter[property]) {
      routeData.localizeRouter[property] = (route as any)[property];
    }

    const result = this.translateRoute(routeData.localizeRouter[property]);
    (route as any)[property] = prefixLang ? `/${this.urlPrefix}${result}` : result;
  }

  get urlPrefix() {
    return this.settings.alwaysSetPrefix || this.currentLang !== this.defaultLang ? this.currentLang : '';
  }

  /**
   * Translate route and return observable
   */
  translateRoute(path: string): string {
    const queryParts = path.split('?');
    if (queryParts.length > 2) {
      throw 'There should be only one query parameter block in the URL';
    }
    const pathSegments = queryParts[0].split('/');

    /** collect observables  */
    return pathSegments
        .map((part: string) => part.length ? this.translateText(part) : part)
        .join('/') +
      (queryParts.length > 1 ? `?${queryParts[1]}` : '');
  }

  /**
   * Get translated value
   */
  private translateText(key: string): string {
    if (!this._translationObject) {
      console.info('TranslocoRouterParser::translateText => no translationObject');
      return key;
    }

    const prefixedKey = this.prefix + key;

    const res = this.translate.translate('routes.' + key, null);
    // ignore non-translated text like 'ROUTES.home'
    if (res === prefixedKey) {
      return key;
    }

    return res || key;
  }
}

export class ManualParserLoader extends TranslocoRouterParser {
  constructor(
    translate: TranslocoService,
    detection: TranslocoRouterDetection,
    settings: TranslocoRouterSettings,
    locales: string[] = ['en'],
    prefix: string = 'ROUTES.'
  ) {
    super(translate, detection, settings);
    this.locales = locales;
    this.prefix = prefix || '';
  }

  load(routes: Routes): Promise<any> {
    return new Promise( (resolve: any) => {
      this.init(routes).then(resolve);
    });
  }
}

export class DummyLocalizeParser extends TranslocoRouterParser {
  load(routes: Routes): Promise<any> {
    return new Promise((resolve: any) => {
      this.init(routes).then(resolve);
    });
  }
}

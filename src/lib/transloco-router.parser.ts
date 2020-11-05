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
  private _wildcardRoute: Route;
  private _languageRoute: Route;

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
    console.log('TranslocoRouterParser::init', this.locales);

    this.routes = routes;
    console.log('Routes are', routes); // JSON.parse(JSON.stringify(this.routes)));

    if (!this.locales || !this.locales.length) {
      return Promise.resolve();
    }

    /** detect current language */
    const detectedLanguage = this.detection.detect(this.locales);
    console.log('Detected language is', detectedLanguage);

    this.defaultLang = 'en';

    const selectedLanguage = detectedLanguage || this.defaultLang;
    this.translate.setDefaultLang(selectedLanguage);
    this.translate.setActiveLang(selectedLanguage);

    let children: Routes = [];

    /** if set prefix is enforced */
    if (this.settings.alwaysSetPrefix) {
      const baseRoute = { path: '', redirectTo: this.defaultLang, pathMatch: 'full' };

      /** extract potential wildcard route */
      const wildcardIndex = routes.findIndex((route: Route) => route.path === '**');
      if (wildcardIndex !== -1) {
        this._wildcardRoute = routes.splice(wildcardIndex, 1)[0];
      }
      children = this.routes.splice(0, this.routes.length, baseRoute);
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
        this._languageRoute = { children };
        this.routes.unshift(this._languageRoute);
      } else {
        this.routes.unshift(...children);
      }
    }

    /** ...and potential wildcard route */
    if (this._wildcardRoute && this.settings.alwaysSetPrefix) {
      this.routes.push(this._wildcardRoute);
    }

    console.log('Routes are', JSON.parse(JSON.stringify(this.routes)));

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
    }
  }

  /**
   * Translate routes to selected language
   */
  translateRoutes(language: string): Observable<any> {
    console.log('TranslocoRouterParser::translateRoutes', language);
    this.setRootLanguage(language);

    return this.translate.selectTranslation(language)
      .pipe(
        map(translations => {
          console.info(translations);
          this._translationObject = translations;
          this.currentLang = language;

          if (this._languageRoute) {
            this._translateRouteTree(this._languageRoute.children);

            // if there is wildcard route
            if (this._wildcardRoute && this._wildcardRoute.redirectTo) {
              this._translateProperty(this._wildcardRoute, 'redirectTo', true);
            }
          } else {
            this._translateRouteTree(this.routes);
          }
        })
      );
  }

  private setRootLanguage(language: string) {
    this._cachedLang = language;
    if (this._languageRoute) {
      this._languageRoute.path = this.settings.alwaysSetPrefix || language !== this.defaultLang ?
        language : '';
    }
  }

  /**
   * Translate the route node and recursively call for all it's children
   */
  private _translateRouteTree(routes: Routes): void {
    console.log('TranslocoRouterParser::_translateRouteTree', routes);

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
    console.info('TranslocoRouterParser::translateRoute', path);

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
    console.info('TranslocoRouterParser::translateText', key);
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

    console.log('res is', res);

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

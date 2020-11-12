import { Subject } from 'rxjs';
import { ActivatedRouteSnapshot, NavigationExtras, NavigationStart, PRIMARY_OUTLET, Router, UrlSegment } from '@angular/router';
import { Inject, Injectable } from '@angular/core';
import { TranslocoRouterSettings } from './transloco-router.config';
import { TranslocoRouterParser } from './transloco-router.parser';
import { filter, pairwise, tap } from 'rxjs/operators';

@Injectable()
export class TranslocoRouterService {
  routerEvents: Subject<string>;

  constructor(
    @Inject(TranslocoRouterParser) public parser: TranslocoRouterParser,
    @Inject(TranslocoRouterSettings) public settings: TranslocoRouterSettings,
    @Inject(Router) private router: Router
  ) {
    this.routerEvents = new Subject<string>();
  }

  init(): void {
    this.router.resetConfig(this.parser.routes);

    this.router.events
      .pipe(
        filter( event => event instanceof NavigationStart),
        pairwise()
      )
      .subscribe(this._routeChanged());
  }

  changeLanguage(lang: string): void {
    if (lang !== this.parser.currentLang) {
      const rootSnapshot: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;

      this.parser.translateRoutes(lang)
        .pipe(
          // set new routes to router
          tap(() => this.router.resetConfig(this.parser.routes))
        )
        .subscribe(() => {
          const urlSegments = this.traverseSnapshot(rootSnapshot, true)
            .filter((path: string, i: number) => {
              return !i || path; // filter out empty paths
            });

          const navigationExtras: NavigationExtras = {
            ...rootSnapshot.queryParamMap.keys.length ? { queryParams: rootSnapshot.queryParams } : {},
            ...rootSnapshot.fragment ? { fragment: rootSnapshot.fragment } : {}
          };

          // use navigate to keep extras unchanged
          this.router.navigate(urlSegments, navigationExtras);
        });
    }
  }

  private traverseSnapshot(
    snapshot: ActivatedRouteSnapshot,
    isRoot: boolean = false
  ): any[] {
    if (isRoot) {
      if (!snapshot.firstChild) {
        return [''];
      }
      if (snapshot.firstChild.firstChild) {
        if (this.settings.alwaysSetPrefix || this.parser.currentLang !== this.parser.defaultLang) {
          return [`/${this.parser.currentLang}`, ...this.traverseSnapshot(snapshot.firstChild.firstChild)];
        } else {
          return [...this.traverseSnapshot(snapshot.firstChild.firstChild)];
        }
      }
    }

    const urlPart = this.parseSegmentValue(snapshot);

    const outletChildren = snapshot.children
      .filter(child => child.outlet !== PRIMARY_OUTLET);

    const outlets = outletChildren
      .reduce((acc, cur) => ({
        outlets: {
          ...acc.outlets,
          [cur.outlet]: this.parseSegmentValue(cur)
        }
      }), { outlets: {} });

    const primaryChild = snapshot.children.find(child => child.outlet === PRIMARY_OUTLET);

    return [
      urlPart,
      ...Object.keys(snapshot.params).length ? [snapshot.params] : [],
      ...outletChildren.length ? [outlets] : [],
      ...primaryChild ? this.traverseSnapshot(primaryChild) : []
    ];
  }

  private parseSegmentValue(snapshot: ActivatedRouteSnapshot): string {
    if (snapshot && snapshot.routeConfig) {
      if (snapshot.routeConfig.path === '**') {
        return this.parser.translateRoute(snapshot.url
          .filter((segment: UrlSegment) => segment.path)
          .map((segment: UrlSegment) => segment.path)
          .join('/'));
      } else if (snapshot.routeConfig.data) {
        const subPathSegments = snapshot.routeConfig.data.localizeRouter.path.split('/');
        return subPathSegments
          .map((s: string, i: number) => s.indexOf(':') === 0 ?
            snapshot.url[i].path :
            this.parser.translateRoute(s))
          .join('/');
      }
    }
    return '';
  }

  translateRoute(path: string | any[]): string | any[] {
    console.log('TranslateRoute', path);
    if (!path) {
      return path;
    }

    if (typeof path === 'string') {
      const url = this.parser.translateRoute(path);
      // const transformed = !path.indexOf('/') ? `/${this.parser.urlPrefix}${url}` : url;
      // console.log('TranslateRoute ->', transformed);
      return url;
    }
  }

  private _routeChanged(): (eventPair: [NavigationStart, NavigationStart]) => void {
    return ([previousEvent, currentEvent]: [NavigationStart, NavigationStart]) => {
      const previousLang = this.parser.detection.getLocationLang(previousEvent.url) || this.parser.defaultLang;

      // if navigating to a slash '/', assume previous language
      const currentLang = currentEvent.url === '/' ? previousLang :
        this.parser.detection.getLocationLang(currentEvent.url) || this.parser.defaultLang;

      if (currentLang !== previousLang) {
        this.parser.mutateRouterRootRoute(currentLang, previousLang, this.router.config);
      }

      this.routerEvents.next(currentLang);
    };
  }
}

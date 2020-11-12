import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslocoRouterService } from './transloco-router.service';
import { equals } from './utils';
import { TranslocoRouterParser } from './transloco-router.parser';

@Pipe({
  name: 'localize',
  pure: false
})
export class TranslocoRouterPipe implements PipeTransform, OnDestroy {
  private value: string | any[] = '';
  private lastKey: string | any[];
  private lastLanguage: string;
  private readonly subscription: Subscription;

  constructor(private localize: TranslocoRouterService,
              private parser: TranslocoRouterParser,
              private cd: ChangeDetectorRef) {
    this.subscription = this.localize.routerEvents.subscribe( () => {
      this.transform(this.lastKey);
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  transform(query: string | any[]): string | any[] {
    if (!query || query.length === 0 || !this.localize.parser.currentLang) {
      return query;
    }

    if (equals(query, this.lastKey) && equals(this.lastLanguage, this.localize.parser.currentLang)) {
      return this.value;
    }

    this.lastKey = query;
    this.lastLanguage = this.localize.parser.currentLang;

    this.value = '/' + this.parser.urlPrefix + '/' + this.localize.translateRoute(query);
    this.lastKey = query;

    // tslint:disable-next-line:no-bitwise
    if ( (this.cd as any).destroyed) {
      return this.value;
    }

    this.cd.detectChanges();

    return this.value;
  }
}

import { Inject, Injectable } from '@angular/core';
import { CacheMechanism, TranslocoRouterSettings } from './transloco-router.config';
import { Location } from '@angular/common';

const COOKIE_EXPIRY = 30; // 1 month

@Injectable()
export class TranslocoRouterDetection {
  locales: string[];

  constructor(
    @Inject(TranslocoRouterSettings) private settings: TranslocoRouterSettings,
    @Inject(Location) private location: Location,
  ) {}

  detect(locales: string[]): string {
    this.locales = locales;

    const locationLang = this.getLocationLang();
    const browserLang = this.getBrowserLang();

    const cachedLang = this.cachedLanguage;

    return cachedLang || locationLang || browserLang;
  }

  private get cachedLanguage(): string {
    if (!this.settings.useCachedLang) {
      return;
    }

    if (this.settings.cacheMechanism === CacheMechanism.LocalStorage) {
      return this.inLocales(this.cacheWithLocalStorage());
    }

    if (this.settings.cacheMechanism === CacheMechanism.Cookie) {
      return this.inLocales(this.cacheWithCookies());
    }
  }

  private set cachedLanguage(value: string) {
    if (this.settings.cacheMechanism === CacheMechanism.LocalStorage) {
      this.cacheWithLocalStorage(value);
    }
    if (this.settings.cacheMechanism === CacheMechanism.Cookie) {
      this.cacheWithCookies(value);
    }
  }

  private cacheWithLocalStorage(value?: string) {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return;
    }
    try {
      if (value) {
        window.localStorage.setItem(this.settings.cacheName, value);
        return;
      }
      return window.localStorage.getItem(this.settings.cacheName);
    } catch (e) {
      // weird Safari issue in private mode, where LocalStorage is defined but throws error on access
      return;
    }
  }

  private cacheWithCookies(value?: string): string {
    if (typeof document === 'undefined' || typeof document.cookie === 'undefined') {
      return;
    }
    try {
      const name = encodeURIComponent(this.settings.cacheName);
      if (value) {
        const d: Date = new Date();
        d.setTime(d.getTime() + COOKIE_EXPIRY * 86400000); // * days
        document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()}`;
        return;
      }
      const regexp = new RegExp('(?:^' + name + '|;\\s*' + name + ')=(.*?)(?:;|$)', 'g');
      const result = regexp.exec(document.cookie);
      return decodeURIComponent(result[1]);
    } catch (e) {
      return; // should not happen but better safe than sorry
    }
  }

  public getLocationLang(url?: string): string {
    const pathSlices = (url || this.location.path() || '')
      .split('#')[0]
      .split('?')[0]
      .split('/');
    if (pathSlices.length > 1 && this.locales.indexOf(pathSlices[1]) !== -1) {
      return pathSlices[1];
    }
    if (pathSlices.length && this.locales.indexOf(pathSlices[0]) !== -1) {
      return pathSlices[0];
    }
    return null;
  }

  private getBrowserLang(): string {
    const browserLang = navigator.languages
      ? navigator.languages[0]
      : (navigator.language);

    return browserLang.indexOf('-') !== -1 ? browserLang.substr(0, browserLang.indexOf('-')) : browserLang;
  }

  private inLocales(value: string): string {
    if (value && this.locales.indexOf(value) !== -1) {
      return value;
    }
    return null;
  }
}

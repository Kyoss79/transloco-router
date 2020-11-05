import { Inject, InjectionToken } from '@angular/core';
import { Routes } from '@angular/router';


export const RAW_ROUTES: InjectionToken<Routes[]> = new InjectionToken<Routes[]>('RAW_ROUTES');
export const ALWAYS_SET_PREFIX = new InjectionToken<boolean>('ALWAYS_SET_PREFIX');

export type CacheMechanism = 'LocalStorage' | 'Cookie';

export namespace CacheMechanism {
  export const LocalStorage: CacheMechanism = 'LocalStorage';
  export const Cookie: CacheMechanism = 'Cookie';
}

export const USE_CACHED_LANG = new InjectionToken<boolean>('USE_CACHED_LANG');
export const CACHE_MECHANISM = new InjectionToken<CacheMechanism>('CACHE_MECHANISM');
export const CACHE_NAME = new InjectionToken<string>('CACHE_NAME');

export interface TranslocoRouterConfig {
  alwaysSetPrefix?: boolean;
  useCachedLang?: boolean;
  cacheMechanism?: CacheMechanism;
  cacheName?: string;
}

const LOCALIZE_CACHE_NAME = 'LOCALIZE_DEFAULT_LANGUAGE';

export class TranslocoRouterSettings implements TranslocoRouterConfig {
  constructor(
    @Inject(USE_CACHED_LANG) public useCachedLang: boolean = true,
    @Inject(ALWAYS_SET_PREFIX) public alwaysSetPrefix: boolean = true,
    @Inject(CACHE_MECHANISM) public cacheMechanism: CacheMechanism = CacheMechanism.LocalStorage,
    @Inject(CACHE_NAME) public cacheName: string = LOCALIZE_CACHE_NAME,
  ) {}
}

import type * as PiSdkType from '@earendil-works/pi-coding-agent'

let sdkPromise: Promise<typeof PiSdkType> | null = null

/**
 * Dynamically loads the ESM-only @earendil-works/pi-coding-agent package
 * using /* @vite-ignore *\/ so Vite/Rollup preserves native ESM import() at runtime.
 */
export function getPiSdk(): Promise<typeof PiSdkType> {
  if (!sdkPromise) {
    const pkgName = '@earendil-works/pi-coding-agent'
    sdkPromise = import(/* @vite-ignore */ pkgName)
  }
  return sdkPromise
}

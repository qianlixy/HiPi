/// <reference types="vite/client" />
import type { HipiApi } from '../../preload'

declare global {
  interface Window {
    hipiApi: HipiApi
  }
}

import { HipiApi, SystemApi } from './index'

export type { SystemApi }

declare global {
  interface Window {
    hipiApi: HipiApi
  }
}

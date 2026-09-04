import { HipiApi } from './index'

declare global {
  interface Window {
    hipiApi: HipiApi
  }
}

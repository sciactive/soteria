// @ts-ignore
// import events from 'node:events';

class CustomEvent extends Event {
  private _detail: any;

  constructor(type: string, eventInitDict: CustomEventInit = {}) {
    super(type, eventInitDict);

    if (eventInitDict.detail != null) {
      this._detail = eventInitDict.detail;
    }
  }

  initCustomEvent(
    type: string,
    bubbles = false,
    cancelable = false,
    detail: any = null
  ) {
    this.initEvent(type, bubbles, cancelable);
    this._detail = detail;
  }

  get detail() {
    return this._detail;
  }
}

global.CustomEvent = CustomEvent;
